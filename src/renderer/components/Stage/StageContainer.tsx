import React, { useRef, useEffect, memo } from 'react'
import { usePixiStage } from '../../hooks/usePixiStage'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { createTextLayer, createImageLayer } from '../../utils/layerFactory'
import { AddLayerCommand } from '../../store/commands/AddLayerCommand'

const StageContainer = memo(function StageContainer(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = usePixiStage(containerRef)
  const project = useProjectStore((s) => s.project)
  const layerCount = useProjectStore((s) => s.project?.layers.length ?? 0)

  // Handle container resize — update PixiJS renderer dimensions and recompute fitZoom
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      const renderer = rendererRef.current
      if (!renderer || width === 0 || height === 0) return

      renderer.resize(width, height)
      const proj = useProjectStore.getState().project
      if (!proj) return

      const fitZoom = Math.min(width / proj.width, height / proj.height)
      useEditorStore.getState().setFitZoom(fitZoom)

      const { zoom, panX, panY } = useEditorStore.getState()
      const effectiveZoom = zoom === 0 ? fitZoom : zoom
      if (zoom === 0) useEditorStore.getState().setViewport(fitZoom, 0, 0)
      renderer.applyViewport(width, height, proj.width, proj.height, effectiveZoom, panX, panY)
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Ctrl/Cmd + wheel → zoom centered on cursor
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    function handleWheel(e: WheelEvent): void {
      if (!e.ctrlKey && !e.metaKey) return
      e.preventDefault()
      const rect = el!.getBoundingClientRect()
      const cursorX = e.clientX - rect.left
      const cursorY = e.clientY - rect.top
      const { zoom, panX, panY, fitZoom } = useEditorStore.getState()
      const { project } = useProjectStore.getState()
      if (!project || zoom === 0) return
      const W = rect.width
      const H = rect.height
      const cx = (W - project.width * zoom) / 2 + panX
      const cy = (H - project.height * zoom) / 2 + panY
      const worldX = (cursorX - cx) / zoom
      const worldY = (cursorY - cy) / zoom
      const factor = e.deltaY < 0 ? 1.1 : 1 / 1.1
      const newZoom = Math.max(fitZoom * 0.1, Math.min(8, zoom * factor))
      const newCx = (W - project.width * newZoom) / 2
      const newCy = (H - project.height * newZoom) / 2
      const newPanX = cursorX - worldX * newZoom - newCx
      const newPanY = cursorY - worldY * newZoom - newCy
      useEditorStore.getState().setViewport(newZoom, newPanX, newPanY)
    }

    el.addEventListener('wheel', handleWheel, { passive: false })
    return () => el.removeEventListener('wheel', handleWheel)
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  // Space + drag / middle-mouse drag → pan
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    let spaceDown = false
    let isPanning = false
    let panStart = { x: 0, y: 0 }
    let mouseStart = { x: 0, y: 0 }

    function onKeyDown(e: KeyboardEvent): void {
      if (e.code === 'Space' && !spaceDown) {
        spaceDown = true
        el!.style.cursor = 'grab'
      }
    }

    function onKeyUp(e: KeyboardEvent): void {
      if (e.code === 'Space') {
        spaceDown = false
        if (!isPanning) el!.style.cursor = ''
      }
    }

    function onPointerDown(e: PointerEvent): void {
      if (e.button === 1 || (e.button === 0 && spaceDown)) {
        isPanning = true
        const { panX, panY } = useEditorStore.getState()
        panStart = { x: panX, y: panY }
        mouseStart = { x: e.clientX, y: e.clientY }
        el!.style.cursor = 'grabbing'
        el!.setPointerCapture(e.pointerId)
        e.preventDefault()
      }
    }

    function onPointerMove(e: PointerEvent): void {
      if (!isPanning) return
      const { zoom } = useEditorStore.getState()
      const newPanX = panStart.x + (e.clientX - mouseStart.x)
      const newPanY = panStart.y + (e.clientY - mouseStart.y)
      useEditorStore.getState().setViewport(zoom, newPanX, newPanY)
    }

    function onPointerUp(): void {
      if (isPanning) {
        isPanning = false
        el!.style.cursor = spaceDown ? 'grab' : ''
      }
    }

    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)

    return () => {
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  async function handleImport(): Promise<void> {
    if (!project) return
    const results = await window.electronAPI.importAsset(project.id)
    if (!results) return

    const state = useProjectStore.getState()

    for (const assetData of results) {
      const asset = {
        id: assetData.id,
        type: 'image' as const,
        name: assetData.name,
        localBundlePath: assetData.localBundlePath,
        width: assetData.width,
        height: assetData.height
      }
      state.addAsset(asset)
      const layer = createImageLayer(asset, project)
      state.history.push(new AddLayerCommand(layer))
      useEditorStore.getState().setSelectedLayerId(layer.id)
    }
  }

  function handleAddText(): void {
    if (!project) return
    const layer = createTextLayer(project)
    useProjectStore.getState().history.push(new AddLayerCommand(layer))
    useEditorStore.getState().setSelectedLayerId(layer.id)
  }

  return (
    <div
      ref={containerRef}
      style={styles.container}
    >
      {!project && (
        <div style={styles.empty}>
          <span style={styles.emptyText}>No project open</span>
          <span style={styles.emptyHint}>Create a new project to get started</span>
        </div>
      )}

      {project && (
        <div style={styles.dimensionChip}>
          {project.width} × {project.height}
        </div>
      )}

      {project && layerCount === 0 && (
        <div style={styles.emptyOverlay}>
          <div style={styles.emptyCard}>
            <h2 style={styles.emptyHeadline}>Start your animation</h2>
            <div style={styles.emptyActions}>
              <button className="primary" onClick={handleImport} style={styles.emptyBtn}>
                Import Image
              </button>
              <button onClick={handleAddText} style={styles.emptyBtn}>
                Add Text
              </button>
            </div>
            <p style={styles.emptyDragHint}>
              Drag and drop PNG, JPG, or SVG here to begin
            </p>
            <div style={styles.stepGuide}>
              <span>1. Import asset</span><span style={styles.stepArrow}>→</span>
              <span>2. Place on stage</span><span style={styles.stepArrow}>→</span>
              <span>3. Move playhead</span><span style={styles.stepArrow}>→</span>
              <span>4. Add keyframe</span><span style={styles.stepArrow}>→</span>
              <span>5. Export MP4</span>
            </div>
          </div>
        </div>
      )}
    </div>
  )
})

export default StageContainer

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    background: '#111',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none'
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: 18
  },
  emptyHint: {
    color: 'var(--text-muted)',
    fontSize: 13
  },
  dimensionChip: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    background: 'rgba(0,0,0,0.6)',
    color: '#aaa',
    fontSize: 11,
    padding: '3px 8px',
    borderRadius: 4,
    pointerEvents: 'none',
    fontFamily: 'monospace',
    zIndex: 10
  },
  emptyOverlay: {
    position: 'absolute',
    inset: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 5
  },
  emptyCard: {
    background: 'rgba(30, 30, 30, 0.92)',
    borderRadius: 12,
    padding: '32px 40px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 16,
    border: '1px solid var(--border-light)'
  },
  emptyHeadline: {
    fontSize: 20,
    fontWeight: 600,
    color: 'var(--text-primary)',
    margin: 0
  },
  emptyActions: {
    display: 'flex',
    gap: 12
  },
  emptyBtn: {
    minWidth: 140,
    height: 40
  },
  emptyDragHint: {
    color: 'var(--text-muted)',
    fontSize: 12,
    margin: 0
  },
  stepGuide: {
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    color: 'var(--text-muted)',
    fontSize: 11,
    marginTop: 4
  },
  stepArrow: {
    color: 'var(--text-muted)',
    opacity: 0.5
  }
}
