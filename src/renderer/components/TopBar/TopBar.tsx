import React from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useExport } from '../../hooks/useExport'

export default function TopBar(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  const { setShowNewProjectDialog } = useEditorStore()
  const { exportProject } = useExport()
  const zoom = useEditorStore((s) => s.zoom)
  const fitZoom = useEditorStore((s) => s.fitZoom)
  const activeTool = useEditorStore((s) => s.activeTool)

  const effectiveZoom = zoom || fitZoom
  const zoomPercent = Math.round(effectiveZoom * 100)
  const presets = [25, 50, 75, 100, 150, 200]

  function clampZoom(z: number): number {
    return Math.max(fitZoom * 0.1, Math.min(8, z))
  }

  async function handleSave(): Promise<void> {
    if (!project) return
    const json = JSON.stringify(project, null, 2)
    await window.electronAPI.saveProject(json)
  }

  async function handleOpen(): Promise<void> {
    const result = await window.electronAPI.openProject()
    if (!result) return
    const parsed = JSON.parse(result.data)
    useProjectStore.getState().setProject(parsed)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
  }

  async function handleOpenFla(): Promise<void> {
    const result = await window.electronAPI.importFla()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
  }

  async function handleOpenXfl(): Promise<void> {
    const result = await window.electronAPI.importXfl()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
  }

  async function handleOpenSwf(): Promise<void> {
    const result = await window.electronAPI.importSwf()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
  }

  async function handleImportAnimate(): Promise<void> {
    const result = await window.electronAPI.importAnimate()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
  }

  return (
    <div style={styles.topbar}>
      {/* Logo / Project Name */}
      <div style={styles.left}>
        <span style={styles.logo}>▶ Animate</span>
        {project && (
          <span style={styles.projectName}>{project.name}</span>
        )}
      </div>

      {/* Center: Tools + File actions */}
      <div style={styles.center}>
        <button
          className="icon-btn"
          title="Select Tool (V)"
          onClick={() => useEditorStore.getState().setActiveTool('select')}
          style={activeTool === 'select' ? styles.toolActive : undefined}
        >
          V
        </button>
        <button
          className="icon-btn"
          title="Hand/Pan Tool (H)"
          onClick={() => useEditorStore.getState().setActiveTool('hand')}
          style={activeTool === 'hand' ? styles.toolActive : undefined}
        >
          H
        </button>
        <div style={styles.sep} />
        <button
          className="icon-btn"
          title="New Project"
          onClick={() => setShowNewProjectDialog(true)}
        >
          New
        </button>
        <button className="icon-btn" title="Open Project" onClick={handleOpen}>
          Open
        </button>
        <button className="icon-btn" title="Open FLA File" onClick={handleOpenFla}>
          FLA
        </button>
        <button className="icon-btn" title="Open XFL Folder" onClick={handleOpenXfl}>
          XFL
        </button>
        <button className="icon-btn" title="Open SWF File" onClick={handleOpenSwf}>
          SWF
        </button>
        <button className="icon-btn" title="Import from Adobe Animate (FLA/XFL + SWF)" onClick={handleImportAnimate}>
          Import
        </button>
        <button className="icon-btn" title="Save Project" onClick={handleSave} disabled={!project}>
          Save
        </button>
      </div>

      {/* Right: Undo/Redo + Zoom + Export */}
      <div style={styles.right}>
        <button
          className="icon-btn"
          title="Undo (Ctrl+Z)"
          onClick={() => history.undo()}
          disabled={!history.canUndo()}
        >
          ↩ Undo
        </button>
        <button
          className="icon-btn"
          title="Redo (Ctrl+Y)"
          onClick={() => history.redo()}
          disabled={!history.canRedo()}
        >
          ↪ Redo
        </button>
        <div style={styles.sep} />
        {project && (
          <>
            <button
              className="icon-btn"
              title="Zoom out"
              onClick={() => useEditorStore.getState().setViewport(clampZoom(effectiveZoom / 1.25), 0, 0)}
            >
              −
            </button>
            <select
              value={zoomPercent}
              onChange={(e) => useEditorStore.getState().setViewport(Number(e.target.value) / 100, 0, 0)}
              style={styles.zoomSelect}
              title="Zoom level"
            >
              {!presets.includes(zoomPercent) && (
                <option value={zoomPercent}>{zoomPercent}%</option>
              )}
              {presets.map((p) => (
                <option key={p} value={p}>{p}%</option>
              ))}
            </select>
            <button
              className="icon-btn"
              title="Zoom in"
              onClick={() => useEditorStore.getState().setViewport(clampZoom(effectiveZoom * 1.25), 0, 0)}
            >
              +
            </button>
            <button
              className="icon-btn"
              title="Fit to window (Ctrl+0)"
              onClick={() => useEditorStore.getState().setViewport(fitZoom, 0, 0)}
            >
              Fit
            </button>
            <div style={styles.sep} />
          </>
        )}
        <button
          className="primary"
          onClick={exportProject}
          disabled={!project}
          style={{ padding: '4px 16px' }}
        >
          Export MP4
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  topbar: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '0 12px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    height: '100%'
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    minWidth: 200
  },
  logo: {
    fontWeight: 700,
    fontSize: 15,
    color: 'var(--accent)',
    letterSpacing: 1
  },
  projectName: {
    color: 'var(--text-secondary)',
    fontSize: 13,
    maxWidth: 180,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    minWidth: 200,
    justifyContent: 'flex-end'
  },
  sep: {
    width: 1,
    height: 24,
    background: 'var(--border)',
    margin: '0 4px'
  },
  toolActive: {
    background: 'var(--accent)',
    color: '#fff',
    borderRadius: 4
  },
  zoomSelect: {
    background: 'var(--bg-tertiary)',
    color: 'var(--text-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '2px 4px',
    fontSize: 12,
    cursor: 'pointer'
  }
}
