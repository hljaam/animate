import React, { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useExport } from '../../hooks/useExport'

function resetViewToCenter(): void {
  useEditorStore.getState().setViewport(1, 0, 0)
}

export default function TopBar(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  useProjectStore((s) => s.historyVersion) // subscribe to history changes for undo/redo button state
  const { setShowNewProjectDialog } = useEditorStore()
  const { exportProject } = useExport()
  const zoom = useEditorStore((s) => s.zoom)
  const fitZoom = useEditorStore((s) => s.fitZoom)
  const editingSymbolId = useEditorStore((s) => s.editingSymbolId)

  const [fileMenuOpen, setFileMenuOpen] = useState(false)
  const fileMenuRef = useRef<HTMLDivElement>(null)

  const effectiveZoom = zoom || fitZoom
  const zoomPercent = Math.round(effectiveZoom * 100)

  // Close file menu on outside click
  useEffect(() => {
    if (!fileMenuOpen) return
    function handleClick(e: MouseEvent): void {
      if (fileMenuRef.current && !fileMenuRef.current.contains(e.target as Node)) {
        setFileMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [fileMenuOpen])

  function clampZoom(z: number): number {
    return Math.max(fitZoom * 0.1, Math.min(8, z))
  }

  async function handleSave(): Promise<void> {
    if (!project) return
    const json = JSON.stringify(project, null, 2)
    await window.electronAPI.saveProject(json)
  }

  async function handleOpen(): Promise<void> {
    setFileMenuOpen(false)
    const result = await window.electronAPI.openProject()
    if (!result) return
    const parsed = JSON.parse(result.data)
    useProjectStore.getState().setProject(parsed)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
    resetViewToCenter()
  }

  async function handleOpenSwf(): Promise<void> {
    setFileMenuOpen(false)
    const result = await window.electronAPI.importSwf()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
    resetViewToCenter()
  }

  async function handleOpenPsd(): Promise<void> {
    setFileMenuOpen(false)
    const result = await window.electronAPI.importPsd()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
    resetViewToCenter()
  }

  const editingSymbol = editingSymbolId
    ? project?.symbols?.find((s) => s.id === editingSymbolId)
    : null

  return (
    <div style={styles.topbar}>
      {/* Left: Logo + Menu + Breadcrumb */}
      <div style={styles.left}>
        <span style={styles.logo}>ANIMATEPRO</span>

        <div style={styles.menuBar}>
          <div ref={fileMenuRef} style={{ position: 'relative' }}>
            <button className="icon-btn" style={styles.menuItem} onClick={() => setFileMenuOpen((o) => !o)}>File</button>
            {fileMenuOpen && (
              <div style={styles.dropdown}>
                <button style={styles.dropdownItem} onClick={() => { setFileMenuOpen(false); setShowNewProjectDialog(true) }}>New Project</button>
                <button style={styles.dropdownItem} onClick={handleOpen}>Open Project</button>
                <button style={styles.dropdownItem} onClick={handleSave} disabled={!project}>Save Project</button>
                <div style={styles.dropdownSep} />
                <button style={styles.dropdownItem} onClick={handleOpenSwf}>Import SWF...</button>
                <button style={styles.dropdownItem} onClick={handleOpenPsd}>Import PSD...</button>
                <div style={styles.dropdownSep} />
                <button style={styles.dropdownItem} onClick={() => { setFileMenuOpen(false); exportProject() }} disabled={!project}>Export MP4</button>
              </div>
            )}
          </div>
          <button className="icon-btn" style={styles.menuItem} onClick={handleOpen}>Edit</button>
          <button className="icon-btn" style={styles.menuItem}>View</button>
          <button className="icon-btn" style={styles.menuItem}>Modify</button>
        </div>

        <div style={styles.sep} />

        <div style={styles.breadcrumb}>
          <span style={styles.breadcrumbMuted}>Project</span>
          <span style={styles.breadcrumbArrow}>&gt;</span>
          <span style={styles.breadcrumbActive}>
            {editingSymbol ? editingSymbol.name : (project?.name ?? 'Untitled')}
          </span>
        </div>
      </div>

      {/* Center: Viewport + Zoom + Console hint */}
      <div style={styles.center}>
        {project && (
          <>
            <span style={styles.infoLabel}>Viewport: {project.width} x {project.height}</span>
            <span style={styles.infoLabel}>Zoom: {zoomPercent}%</span>
          </>
        )}
        <span style={styles.consoleHint}>Press &apos;Ctrl+K&apos; for Command Console</span>
      </div>

      {/* Right: Status + Undo/Redo + Export */}
      <div style={styles.right}>
        <span style={styles.statusLabel}>Status:</span>
        <span style={styles.statusValue}>Saved</span>

        <div style={styles.sep} />

        <button
          className="icon-btn"
          title="Undo (Ctrl+Z)"
          onClick={() => history.undo()}
          disabled={!history.canUndo()}
          style={styles.undoRedoBtn}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M3 8l3-3M3 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>
        <button
          className="icon-btn"
          title="Redo (Ctrl+Y)"
          onClick={() => history.redo()}
          disabled={!history.canRedo()}
          style={styles.undoRedoBtn}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M13 8l-3-3M13 8l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </button>

        <button
          onClick={exportProject}
          disabled={!project}
          style={styles.exportBtn}
        >
          Export
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
    padding: '0 16px',
    background: 'var(--bg-secondary)',
    borderBottom: '1px solid var(--border)',
    height: '100%',
    gap: 16
  },
  left: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    flexShrink: 0
  },
  logo: {
    fontWeight: 800,
    fontSize: 14,
    color: 'var(--text-primary)',
    letterSpacing: 1.5,
    whiteSpace: 'nowrap'
  },
  menuBar: {
    display: 'flex',
    alignItems: 'center',
    gap: 0,
    marginLeft: 8
  },
  menuItem: {
    fontSize: 13,
    color: 'var(--text-secondary)',
    padding: '4px 10px',
    minWidth: 'auto',
    minHeight: 'auto'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6
  },
  breadcrumbMuted: {
    fontSize: 13,
    color: 'var(--text-muted)'
  },
  breadcrumbArrow: {
    fontSize: 11,
    color: 'var(--text-muted)'
  },
  breadcrumbActive: {
    fontSize: 13,
    fontWeight: 600,
    color: 'var(--text-primary)'
  },
  center: {
    display: 'flex',
    alignItems: 'center',
    gap: 16,
    flex: 1,
    justifyContent: 'center'
  },
  infoLabel: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    whiteSpace: 'nowrap'
  },
  consoleHint: {
    fontSize: 11,
    color: 'var(--text-muted)',
    whiteSpace: 'nowrap'
  },
  right: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    flexShrink: 0
  },
  statusLabel: {
    fontSize: 12,
    color: 'var(--text-muted)'
  },
  statusValue: {
    fontSize: 12,
    color: 'var(--success)',
    fontWeight: 500
  },
  sep: {
    width: 1,
    height: 24,
    background: 'var(--border)',
    flexShrink: 0
  },
  undoRedoBtn: {
    padding: '4px 6px',
    minWidth: 32,
    minHeight: 32
  },
  exportBtn: {
    background: 'var(--export-btn)',
    border: 'none',
    borderRadius: 6,
    padding: '6px 20px',
    color: '#fff',
    fontSize: 13,
    fontWeight: 600,
    cursor: 'pointer',
    minHeight: 32
  },
  dropdown: {
    position: 'absolute',
    top: '100%',
    left: 0,
    marginTop: 4,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 6,
    padding: '4px 0',
    minWidth: 180,
    zIndex: 1000,
    boxShadow: '0 4px 16px rgba(0,0,0,0.4)'
  },
  dropdownItem: {
    display: 'block',
    width: '100%',
    padding: '6px 14px',
    border: 'none',
    background: 'none',
    color: 'var(--text-secondary)',
    fontSize: 13,
    textAlign: 'left' as const,
    cursor: 'pointer',
    whiteSpace: 'nowrap' as const
  },
  dropdownSep: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0'
  }
}
