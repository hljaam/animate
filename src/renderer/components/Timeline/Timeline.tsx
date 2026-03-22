import React, { useRef, useState, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import PlaybackControls from './PlaybackControls'
import TimeRuler from './TimeRuler'
import LayerRow from './LayerRow'
import { AddLayerCommand } from '../../store/commands/AddLayerCommand'
import { createTextLayer, createRectangleLayer, createEllipseLayer } from '../../utils/layerFactory'

const LABEL_WIDTH = 160
const PIXELS_PER_FRAME = 6

export default function Timeline(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  const { currentFrame, setCurrentFrame, setIsPlaying } = useEditorStore()
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)
  const editingSymbolId = useEditorStore((s) => s.editingSymbolId)
  const setEditingSymbolId = useEditorStore((s) => s.setEditingSymbolId)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const shapeMenuRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!showShapeMenu) return
    function handleClickOutside(e: MouseEvent): void {
      if (shapeMenuRef.current && !shapeMenuRef.current.contains(e.target as Node)) {
        setShowShapeMenu(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showShapeMenu])

  function handleAddShape(kind: 'rectangle' | 'ellipse'): void {
    if (!project) return
    const layer = kind === 'rectangle' ? createRectangleLayer(project) : createEllipseLayer(project)
    history.push(new AddLayerCommand(layer))
    setSelectedLayerId(layer.id)
    setShowShapeMenu(false)
  }

  function handleTrackMouseDown(e: React.MouseEvent): void {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - rect.left + el.scrollLeft - LABEL_WIDTH
    if (relX < 0) return // click was in the label area

    setIsPlaying(false)
    setCurrentFrame(Math.max(0, Math.min(Math.round(relX / PIXELS_PER_FRAME), totalFrames - 1)))

    function onMove(me: MouseEvent): void {
      const r = el!.getBoundingClientRect()
      const rx = me.clientX - r.left + el!.scrollLeft - LABEL_WIDTH
      setCurrentFrame(Math.max(0, Math.min(Math.round(rx / PIXELS_PER_FRAME), totalFrames - 1)))
    }
    function onUp(): void {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalFrames = project?.durationFrames ?? 0
  const totalWidth = totalFrames * PIXELS_PER_FRAME + LABEL_WIDTH

  // When editing a symbol, show its internal layers; otherwise show project layers
  const editingSymbol = editingSymbolId
    ? project?.symbols?.find((s) => s.id === editingSymbolId)
    : null
  const sourceLayers = editingSymbol ? editingSymbol.layers : (project?.layers ?? [])

  // Sort layers by order (reversed so top layer is at top of timeline)
  const layers = [...sourceLayers].sort((a, b) => b.order - a.order)

  function handleAddText(): void {
    if (!project) return
    const layer = createTextLayer(project)
    history.push(new AddLayerCommand(layer))
    setSelectedLayerId(layer.id)
  }

  // Playhead line in track area
  const playheadX = LABEL_WIDTH + currentFrame * PIXELS_PER_FRAME

  return (
    <div className="panel" style={styles.panel}>
      {/* Symbol editing breadcrumb */}
      {editingSymbol && (
        <div style={styles.breadcrumb}>
          <button
            className="icon-btn"
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => setEditingSymbolId(null)}
          >
            Scene 1
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>&gt;</span>
          <span style={{ fontSize: 11, color: 'var(--accent)' }}>{editingSymbol.name}</span>
        </div>
      )}

      {/* Toolbar row */}
      <div style={styles.toolbar}>
        <PlaybackControls />
        <div style={styles.toolbarRight}>
          <div ref={shapeMenuRef} style={{ position: 'relative', display: 'inline-block' }}>
            <button
              className="icon-btn"
              onClick={() => setShowShapeMenu((v) => !v)}
              disabled={!project}
            >
              + Shape
            </button>
            {showShapeMenu && (
              <div style={styles.shapeDropdown}>
                <button style={styles.shapeDropdownItem} onClick={() => handleAddShape('rectangle')}>
                  Rectangle
                </button>
                <button style={styles.shapeDropdownItem} onClick={() => handleAddShape('ellipse')}>
                  Ellipse
                </button>
              </div>
            )}
          </div>
          <button className="icon-btn" onClick={handleAddText} disabled={!project}>
            + Text
          </button>
        </div>
      </div>

      {/* Timeline content */}
      <div style={styles.timelineBody}>
        {/* Fixed ruler */}
        <TimeRuler
          pixelsPerFrame={PIXELS_PER_FRAME}
          totalFrames={totalFrames}
          labelOffset={LABEL_WIDTH}
        />

        {/* Scrollable layer rows */}
        <div ref={scrollRef} style={styles.layerScroll} onMouseDown={handleTrackMouseDown}>
          <div style={{ width: totalWidth, position: 'relative', minWidth: '100%' }}>
            {/* Playhead vertical line */}
            <div
              style={{
                position: 'absolute',
                left: playheadX,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(74, 158, 255, 0.5)',
                pointerEvents: 'none',
                zIndex: 10
              }}
            />

            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                pixelsPerFrame={PIXELS_PER_FRAME}
                totalFrames={totalFrames}
              />
            ))}

            {layers.length === 0 && (
              <div style={styles.empty}>
                {project ? 'No layers. Import an image or add text.' : 'Create a project to begin.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--border)',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  toolbarRight: {
    marginLeft: 'auto',
    padding: '0 8px'
  },
  timelineBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  layerScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    position: 'relative'
  },
  empty: {
    padding: 20,
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center'
  },
  breadcrumb: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '4px 8px',
    background: 'rgba(74, 158, 255, 0.08)',
    borderBottom: '1px solid var(--border)'
  },
  shapeDropdown: {
    position: 'absolute' as const,
    top: '100%',
    right: 0,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    zIndex: 100,
    minWidth: 120,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)'
  },
  shapeDropdownItem: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: 12,
    textAlign: 'left' as const,
    cursor: 'pointer'
  }
}
