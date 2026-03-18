import React from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useExport } from '../../hooks/useExport'

export default function TopBar(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  const { setShowNewProjectDialog } = useEditorStore()
  const { exportProject } = useExport()

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

  return (
    <div style={styles.topbar}>
      {/* Logo / Project Name */}
      <div style={styles.left}>
        <span style={styles.logo}>▶ Animate</span>
        {project && (
          <span style={styles.projectName}>{project.name}</span>
        )}
      </div>

      {/* Center: File actions */}
      <div style={styles.center}>
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
        <button className="icon-btn" title="Save Project" onClick={handleSave} disabled={!project}>
          Save
        </button>
      </div>

      {/* Right: Undo/Redo + Export */}
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
  }
}
