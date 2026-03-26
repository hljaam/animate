import React, { useRef, useState, useEffect, useCallback } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import PlaybackControls from './PlaybackControls'
import TimeRuler from './TimeRuler'
import LayerRow from './LayerRow'
import { createTextLayer, createRectangleLayer, createEllipseLayer } from '../../utils/layerFactory'

const LABEL_WIDTH = 160
const BASE_PPF = 6

const ROW_HEIGHTS: Record<'short' | 'medium' | 'tall', number> = {
  short: 24,
  medium: 36,
  tall: 52
}

type TimelineTab = 'keyframes' | 'layers'

export default function Timeline(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const { currentFrame, setCurrentFrame, setIsPlaying } = useEditorStore()
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)
  const editingSymbolId = useEditorStore((s) => s.editingSymbolId)
  const setEditingSymbolId = useEditorStore((s) => s.setEditingSymbolId)
  const editingObjectId = useEditorStore((s) => s.editingObjectId)
  const setEditingObjectId = useEditorStore((s) => s.setEditingObjectId)
  const timelineZoom = useEditorStore((s) => s.timelineZoom)
  const setTimelineZoom = useEditorStore((s) => s.setTimelineZoom)
  const layerRowHeight = useEditorStore((s) => s.layerRowHeight)
  const setLayerRowHeight = useEditorStore((s) => s.setLayerRowHeight)
  const onionSkinEnabled = useEditorStore((s) => s.onionSkinEnabled)
  const onionSkinBefore = useEditorStore((s) => s.onionSkinBefore)
  const onionSkinAfter = useEditorStore((s) => s.onionSkinAfter)
  const setOnionSkinBefore = useEditorStore((s) => s.setOnionSkinBefore)
  const setOnionSkinAfter = useEditorStore((s) => s.setOnionSkinAfter)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [showShapeMenu, setShowShapeMenu] = useState(false)
  const shapeMenuRef = useRef<HTMLDivElement>(null)
  const [activeTab, setActiveTab] = useState<TimelineTab>('keyframes')
  const [showHamburger, setShowHamburger] = useState(false)
  const hamburgerRef = useRef<HTMLDivElement>(null)
  const [dragReorder, setDragReorder] = useState<{
    dragLayerId: string
    insertIndex: number
  } | null>(null)

  // Bulk toggle drag state (for eye/lock/outline column drag)
  const [dragToggle, setDragToggle] = useState<{
    column: 'visible' | 'locked' | 'outlineMode'
    value: boolean
    startLayerId: string
  } | null>(null)

  const PIXELS_PER_FRAME = BASE_PPF * timelineZoom

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

  useEffect(() => {
    if (!showHamburger) return
    function handleClickOutside(e: MouseEvent): void {
      if (hamburgerRef.current && !hamburgerRef.current.contains(e.target as Node)) {
        setShowHamburger(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [showHamburger])

  // End bulk toggle drag on pointer up
  useEffect(() => {
    if (!dragToggle) return
    function onUp(): void {
      setDragToggle(null)
    }
    window.addEventListener('pointerup', onUp)
    return () => window.removeEventListener('pointerup', onUp)
  }, [dragToggle])

  function handleAddShape(kind: 'rectangle' | 'ellipse'): void {
    if (!project) return
    const layer = kind === 'rectangle' ? createRectangleLayer(project) : createEllipseLayer(project)
    useProjectStore.getState().applyAction(`Add layer "${layer.name}"`, (draft) => {
      draft.layers.push(layer)
      draft.layers.sort((a, b) => a.order - b.order)
    })
    setSelectedLayerId(layer.id)
    setShowShapeMenu(false)
  }

  function handleTrackMouseDown(e: React.MouseEvent): void {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - rect.left + el.scrollLeft - LABEL_WIDTH
    if (relX < 0) return

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

  // Timeline zoom via Ctrl+Wheel
  function handleWheel(e: React.WheelEvent): void {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault()
      const delta = e.deltaY > 0 ? -0.2 : 0.2
      setTimelineZoom(timelineZoom + delta)
    }
  }

  const totalFrames = project?.durationFrames ?? 0
  const totalWidth = totalFrames * PIXELS_PER_FRAME + LABEL_WIDTH

  const editingSymbol = editingSymbolId
    ? project?.symbols?.find((s) => s.id === editingSymbolId)
    : null
  const editingObject = editingObjectId
    ? project?.shapeObjects?.find((o) => o.id === editingObjectId)
    : null
  const sourceLayers = editingSymbol
    ? editingSymbol.layers
    : editingObject?.layers
      ? editingObject.layers
      : (project?.layers ?? [])

  const layers = [...sourceLayers].sort((a, b) => b.order - a.order)

  function handleAddText(): void {
    if (!project) return
    const layer = createTextLayer(project)
    useProjectStore.getState().applyAction(`Add layer "${layer.name}"`, (draft) => {
      draft.layers.push(layer)
      draft.layers.sort((a, b) => a.order - b.order)
    })
    setSelectedLayerId(layer.id)
  }

  const rowHeight = ROW_HEIGHTS[layerRowHeight]

  const handleLayerDragStart = useCallback((layerId: string, e: React.PointerEvent) => {
    e.preventDefault()

    setDragReorder({ dragLayerId: layerId, insertIndex: layers.findIndex((l) => l.id === layerId) })

    function onMove(ev: PointerEvent): void {
      if (!scrollRef.current) return
      const rect = scrollRef.current.getBoundingClientRect()
      const relY = ev.clientY - rect.top + scrollRef.current.scrollTop
      const idx = Math.max(0, Math.min(layers.length, Math.round(relY / rowHeight)))
      setDragReorder((prev) => prev ? { ...prev, insertIndex: idx } : null)
    }

    function onUp(): void {
      setDragReorder((prev) => {
        if (prev && project) {
          const dragIdx = layers.findIndex((l) => l.id === prev.dragLayerId)
          if (dragIdx !== -1 && dragIdx !== prev.insertIndex && dragIdx !== prev.insertIndex - 1) {
            const reordered = [...layers]
            const [moved] = reordered.splice(dragIdx, 1)
            const targetIdx = prev.insertIndex > dragIdx ? prev.insertIndex - 1 : prev.insertIndex
            reordered.splice(targetIdx, 0, moved)

            const newOrders = reordered.map((l, i) => ({
              layerId: l.id,
              order: reordered.length - 1 - i
            }))

            useProjectStore.getState().applyAction('Reorder layers', (draft) => {
              for (const entry of newOrders) {
                const draftLayer = draft.layers.find((l) => l.id === entry.layerId)
                if (draftLayer) draftLayer.order = entry.order
              }
            })
          }
        }
        return null
      })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [layers, project, rowHeight])

  // Bulk toggle drag handlers
  function handleToggleDragStart(layerId: string, column: 'visible' | 'locked' | 'outlineMode', value: boolean): void {
    setDragToggle({ column, value, startLayerId: layerId })
  }

  function handleToggleDragEnter(layerId: string): void {
    if (!dragToggle || layerId === dragToggle.startLayerId) return
    const col = dragToggle.column
    const val = dragToggle.value
    if (col === 'outlineMode') {
      useProjectStore.getState().updateLayer(layerId, { [col]: val })
    } else {
      useProjectStore.getState().updateLayer(layerId, { [col]: val })
    }
  }

  const playheadX = LABEL_WIDTH + currentFrame * PIXELS_PER_FRAME

  return (
    <div className="panel" style={styles.panel} onWheel={handleWheel}>
      {/* Symbol / Object editing breadcrumb */}
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
      {editingObject && (
        <div style={styles.breadcrumb}>
          <button
            className="icon-btn"
            style={{ fontSize: 11, padding: '2px 8px' }}
            onClick={() => setEditingObjectId(null)}
          >
            Scene 1
          </button>
          <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>&gt;</span>
          <span style={{ fontSize: 11, color: '#e89b4e' }}>{editingObject.name}</span>
        </div>
      )}

      {/* Toolbar row */}
      <div style={styles.toolbar}>
        <PlaybackControls />

        {/* Right side: tabs + zoom + hamburger */}
        <div style={styles.toolbarRight}>
          {/* Timeline Zoom */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              className="icon-btn"
              style={{ padding: '2px 4px', minWidth: 20, minHeight: 20, fontSize: 14, color: 'var(--text-secondary)' }}
              onClick={() => setTimelineZoom(timelineZoom - 0.25)}
              title="Zoom out timeline"
            >-</button>
            <span style={{ fontSize: 10, color: 'var(--text-muted)', minWidth: 32, textAlign: 'center' }}>
              {Math.round(timelineZoom * 100)}%
            </span>
            <button
              className="icon-btn"
              style={{ padding: '2px 4px', minWidth: 20, minHeight: 20, fontSize: 14, color: 'var(--text-secondary)' }}
              onClick={() => setTimelineZoom(timelineZoom + 0.25)}
              title="Zoom in timeline"
            >+</button>
          </div>

          {/* KEYFRAMES / LAYERS tabs */}
          <div style={styles.tabGroup}>
            <button
              style={{
                ...styles.tabBtn,
                color: activeTab === 'keyframes' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'keyframes' ? '2px solid var(--accent)' : '2px solid transparent'
              }}
              onClick={() => setActiveTab('keyframes')}
            >
              KEYFRAMES
            </button>
            <button
              style={{
                ...styles.tabBtn,
                color: activeTab === 'layers' ? 'var(--text-primary)' : 'var(--text-muted)',
                borderBottom: activeTab === 'layers' ? '2px solid var(--accent)' : '2px solid transparent'
              }}
              onClick={() => setActiveTab('layers')}
            >
              LAYERS
            </button>
          </div>

          {/* Hamburger menu */}
          <div style={{ position: 'relative' }} ref={hamburgerRef}>
            <button
              className="icon-btn"
              style={{ padding: '4px 6px', minWidth: 28, minHeight: 28, color: 'var(--text-secondary)' }}
              onClick={() => setShowHamburger(!showHamburger)}
              title="Timeline settings"
            >
              <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
                <path d="M2 4h10M2 7h10M2 10h10" stroke="currentColor" strokeWidth="1.3" strokeLinecap="round"/>
              </svg>
            </button>
            {showHamburger && (
              <div style={styles.hamburgerMenu}>
                {/* Layer height */}
                <div style={{ padding: '2px 12px', fontSize: 10, color: 'var(--text-muted)' }}>Layer Height</div>
                {(['short', 'medium', 'tall'] as const).map((h) => (
                  <button
                    key={h}
                    style={{
                      ...styles.hamburgerItem,
                      fontWeight: layerRowHeight === h ? 600 : 400,
                      color: layerRowHeight === h ? 'var(--accent)' : 'var(--text)'
                    }}
                    onClick={() => { setLayerRowHeight(h); setShowHamburger(false) }}
                  >
                    <span style={{ width: 16, display: 'inline-block' }}>{layerRowHeight === h ? '\u2713' : ''}</span>
                    {h.charAt(0).toUpperCase() + h.slice(1)}
                  </button>
                ))}
                <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
                {/* Onion skin settings */}
                <div style={{ padding: '2px 12px', fontSize: 10, color: 'var(--text-muted)' }}>Onion Skin Range</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '4px 12px' }}>
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>Before:</span>
                  <input
                    type="number" min={0} max={10} value={onionSkinBefore}
                    onChange={(e) => setOnionSkinBefore(parseInt(e.target.value) || 0)}
                    style={{ width: 40, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', padding: '2px 4px', fontSize: 11 }}
                  />
                  <span style={{ fontSize: 11, color: 'var(--text-secondary)' }}>After:</span>
                  <input
                    type="number" min={0} max={10} value={onionSkinAfter}
                    onChange={(e) => setOnionSkinAfter(parseInt(e.target.value) || 0)}
                    style={{ width: 40, background: 'var(--bg-primary)', border: '1px solid var(--border)', borderRadius: 3, color: 'var(--text)', padding: '2px 4px', fontSize: 11 }}
                  />
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Timeline content */}
      <div style={styles.timelineBody}>
        <TimeRuler
          pixelsPerFrame={PIXELS_PER_FRAME}
          totalFrames={totalFrames}
          labelOffset={LABEL_WIDTH}
        />

        <div ref={scrollRef} style={styles.layerScroll} onMouseDown={handleTrackMouseDown}>
          <div style={{ width: totalWidth, position: 'relative', minWidth: '100%' }}>
            {/* Playhead vertical line */}
            <div
              style={{
                position: 'absolute',
                left: playheadX,
                top: 0,
                bottom: 0,
                width: 2,
                background: 'var(--accent)',
                pointerEvents: 'none',
                zIndex: 10,
                opacity: 0.7
              }}
            />

            {layers.map((layer, idx) => (
              <React.Fragment key={layer.id}>
                {dragReorder && dragReorder.insertIndex === idx && dragReorder.dragLayerId !== layer.id && (
                  <div style={{ height: 2, background: 'var(--accent)', margin: '-1px 0', position: 'relative', zIndex: 20 }} />
                )}
                <LayerRow
                  layer={layer}
                  pixelsPerFrame={PIXELS_PER_FRAME}
                  totalFrames={totalFrames}
                  onDragStart={handleLayerDragStart}
                  isDragging={dragReorder?.dragLayerId === layer.id}
                  rowHeight={rowHeight}
                  onToggleDragStart={handleToggleDragStart}
                  onToggleDragEnter={handleToggleDragEnter}
                />
              </React.Fragment>
            ))}
            {dragReorder && dragReorder.insertIndex === layers.length && (
              <div style={{ height: 2, background: 'var(--accent)', margin: '-1px 0', position: 'relative', zIndex: 20 }} />
            )}

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
    overflow: 'hidden',
    height: '100%'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    height: 48,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  toolbarRight: {
    marginLeft: 'auto',
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '0 12px'
  },
  tabGroup: {
    display: 'flex',
    alignItems: 'center',
    gap: 0
  },
  tabBtn: {
    background: 'none',
    border: 'none',
    padding: '4px 12px',
    fontSize: 10,
    fontWeight: 600,
    letterSpacing: 1,
    cursor: 'pointer',
    minHeight: 'auto',
    minWidth: 'auto',
    transition: 'color 0.15s'
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
    background: 'var(--accent-dim)',
    borderBottom: '1px solid var(--border)'
  },
  hamburgerMenu: {
    position: 'absolute',
    top: '100%',
    right: 0,
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    zIndex: 100,
    minWidth: 220,
    boxShadow: '0 4px 12px rgba(0,0,0,0.3)',
    padding: '4px 0'
  },
  hamburgerItem: {
    display: 'block',
    width: '100%',
    padding: '6px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer'
  }
}
