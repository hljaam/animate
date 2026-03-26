import React, { useRef, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { copyLayers, getClipboard, getClipboardCenter } from '../../store/clipboardStore'
import { generateId } from '../../utils/idGenerator'
import { useContextMenuPosition } from '../../hooks/useContextMenuPosition'
import { useClickOutside } from '../../hooks/useClickOutside'
import { PopoverMenu, MenuItem, MenuSeparator } from '../ui/popover-menu'
import type { Layer, PropertyTrack } from '../../types/project'

export default function CanvasContextMenu(): React.ReactElement | null {
  const menu = useEditorStore((s) => s.canvasContextMenu)
  const setMenu = useEditorStore((s) => s.setCanvasContextMenu)
  const ref = useRef<HTMLDivElement>(null)
  useContextMenuPosition(ref, menu?.x ?? 0, menu?.y ?? 0)
  const closeMenu = useCallback(() => setMenu(null), [setMenu])
  useClickOutside(ref, menu ? closeMenu : null)

  if (!menu) return null

  const { layerId, x, y } = menu

  function close(): void {
    setMenu(null)
  }

  function handleCopy(): void {
    if (!layerId) return
    const selectedIds = useEditorStore.getState().selectedLayerIds
    if (selectedIds.length > 1) {
      const layers = selectedIds
        .map((id) => useProjectStore.getState().getLayer(id))
        .filter((l): l is NonNullable<typeof l> => l != null)
      copyLayers(layers)
    } else {
      const layer = useProjectStore.getState().getLayer(layerId)
      if (layer) copyLayers([layer])
    }
    close()
  }

  function screenToWorld(screenX: number, screenY: number): { x: number; y: number } {
    const project = useProjectStore.getState().project
    if (!project) return { x: screenX, y: screenY }
    const { zoom, panX, panY, fitZoom } = useEditorStore.getState()
    const effectiveZoom = zoom === 0 ? fitZoom : zoom
    const stageEl = document.querySelector('[data-stage-container]') as HTMLElement | null
    if (!stageEl) return { x: screenX, y: screenY }
    const rect = stageEl.getBoundingClientRect()
    const localX = screenX - rect.left
    const localY = screenY - rect.top
    const cx = (rect.width - project.width * effectiveZoom) / 2 + panX
    const cy = (rect.height - project.height * effectiveZoom) / 2 + panY
    return {
      x: (localX - cx) / effectiveZoom,
      y: (localY - cy) / effectiveZoom
    }
  }

  function handlePaste(): void {
    const clipboard = getClipboard()
    if (clipboard.length === 0) return
    const worldPos = screenToWorld(x, y)
    const project = useProjectStore.getState().project
    const maxOrder = project ? Math.max(...project.layers.map((l) => l.order), 0) : 0
    const center = getClipboardCenter()
    const offsetX = worldPos.x - center.x
    const offsetY = worldPos.y - center.y
    const cloneIds: string[] = []

    useProjectStore.getState().applyAction(
      clipboard.length === 1 ? `Paste layer "${clipboard[0].name}"` : `Paste ${clipboard.length} layers`,
      (draft) => {
        for (let i = 0; i < clipboard.length; i++) {
          const clone: Layer = {
            ...JSON.parse(JSON.stringify(clipboard[i])),
            id: generateId(),
            name: `${clipboard[i].name} copy`,
            order: maxOrder + 1 + i
          }
          if (offsetX !== 0 || offsetY !== 0) {
            for (const track of clone.tracks) {
              if (track.property === 'x') {
                for (const kf of track.keyframes) kf.value += offsetX
              } else if (track.property === 'y') {
                for (const kf of track.keyframes) kf.value += offsetY
              }
            }
          }
          cloneIds.push(clone.id)
          draft.layers.push(clone)
        }
        draft.layers.sort((a, b) => a.order - b.order)
      }
    )
    useEditorStore.getState().setSelectedLayerIds(cloneIds)
    close()
  }

  function handleDelete(): void {
    if (!layerId) return
    const selectedIds = useEditorStore.getState().selectedLayerIds
    const idsToDelete = selectedIds.length > 1 ? selectedIds : [layerId]
    const layers = idsToDelete
      .map((id) => useProjectStore.getState().getLayer(id))
      .filter((l): l is NonNullable<typeof l> => l != null)
    if (layers.length === 0) return
    const idSet = new Set(idsToDelete)
    const desc = layers.length === 1 ? `Remove layer "${layers[0].name}"` : `Remove ${layers.length} layers`
    useProjectStore.getState().applyAction(desc, (draft) => {
      draft.layers = draft.layers.filter((l) => !idSet.has(l.id))
    })
    useEditorStore.getState().setSelectedLayerIds([])
    close()
  }

  function handleBringToFront(): void {
    if (!layerId) return
    const project = useProjectStore.getState().project
    if (!project) return
    const maxOrder = Math.max(...project.layers.map((l) => l.order))
    useProjectStore.getState().applyAction('Bring to Front', (draft) => {
      const layer = draft.layers.find((l) => l.id === layerId)
      if (layer) layer.order = maxOrder + 1
    })
    close()
  }

  function handleSendToBack(): void {
    if (!layerId) return
    const project = useProjectStore.getState().project
    if (!project) return
    const minOrder = Math.min(...project.layers.map((l) => l.order))
    useProjectStore.getState().applyAction('Send to Back', (draft) => {
      const layer = draft.layers.find((l) => l.id === layerId)
      if (layer) layer.order = minOrder - 1
    })
    close()
  }

  function handleSelectAll(): void {
    const project = useProjectStore.getState().project
    if (!project) return
    useEditorStore.getState().setSelectedLayerIds(project.layers.map((l) => l.id))
    close()
  }

  function handleCreateObject(): void {
    const ids = useEditorStore.getState().selectedLayerIds
    if (ids.length > 0) {
      useEditorStore.getState().setShowCreateObjectDialog({ layerIds: ids })
    }
    close()
  }

  const selectedIds = useEditorStore.getState().selectedLayerIds
  const hasMultipleSelected = selectedIds.length > 1
  const hasShapeLayers = (() => {
    if (selectedIds.length === 0) return false
    const project = useProjectStore.getState().project
    if (!project) return false
    return selectedIds.some((id) => {
      const l = project.layers.find((layer) => layer.id === id)
      return l?.type === 'shape'
    })
  })()

  function handleSaveToUnit(): void {
    if (!layerId) return
    const project = useProjectStore.getState().project
    if (!project) return
    const layer = project.layers.find((l) => l.id === layerId)
    if (!layer) return

    // Already a symbol — save directly
    if (layer.type === 'symbol' && layer.symbolId) {
      useEditorStore.getState().setShowSaveToUnitDialog({ itemType: 'symbol', itemId: layer.symbolId })
      close()
      return
    }

    // Already a shape object — save directly
    if (layer.shapeObjectId) {
      useEditorStore.getState().setShowSaveToUnitDialog({ itemType: 'shapeObject', itemId: layer.shapeObjectId })
      close()
      return
    }

    // Convert layer to symbol first, then open save-to-unit dialog
    const symbolId = generateId()
    const symbolLayerId = generateId()
    const name = layer.name
    const originalLayer = JSON.parse(JSON.stringify(layer))

    useProjectStore.getState().applyAction(`Convert to symbol "${name}"`, (draft) => {
      const idx = draft.layers.findIndex((l) => l.id === layer.id)
      if (idx === -1) return
      draft.layers.splice(idx, 1)

      const symbolDef = {
        id: symbolId,
        name,
        libraryItemName: name,
        fps: draft.fps,
        durationFrames: draft.durationFrames,
        layers: [originalLayer]
      }
      if (!draft.symbols) draft.symbols = []
      draft.symbols.push(symbolDef)

      const defaultTracks: PropertyTrack[] = [
        { property: 'x', keyframes: [{ frame: 0, value: 0, easing: 'step' }] },
        { property: 'y', keyframes: [{ frame: 0, value: 0, easing: 'step' }] },
        { property: 'scaleX', keyframes: [{ frame: 0, value: 1, easing: 'step' }] },
        { property: 'scaleY', keyframes: [{ frame: 0, value: 1, easing: 'step' }] },
        { property: 'rotation', keyframes: [{ frame: 0, value: 0, easing: 'step' }] },
        { property: 'opacity', keyframes: [{ frame: 0, value: 1, easing: 'step' }] }
      ]

      draft.layers.push({
        id: symbolLayerId,
        name,
        type: 'symbol' as const,
        symbolId,
        visible: true,
        locked: false,
        order: originalLayer.order,
        startFrame: originalLayer.startFrame,
        endFrame: originalLayer.endFrame,
        tracks: defaultTracks
      } as any)
      draft.layers.sort((a, b) => a.order - b.order)
    })

    useEditorStore.getState().setSelectedLayerId(symbolLayerId)
    useEditorStore.getState().setShowSaveToUnitDialog({ itemType: 'symbol', itemId: symbolId })
    close()
  }

  return (
    <PopoverMenu ref={ref} x={x} y={y}>
      {layerId ? (
        <>
          <MenuItem onClick={handleCopy}>Copy</MenuItem>
          <MenuItem onClick={handlePaste}>Paste</MenuItem>
          <MenuItem onClick={handleDelete}>Delete</MenuItem>
          <MenuSeparator />
          {(hasShapeLayers || hasMultipleSelected) && (
            <MenuItem onClick={handleCreateObject}>Save to Objects</MenuItem>
          )}
          <MenuItem onClick={handleSaveToUnit}>Save to Unit</MenuItem>
          <MenuSeparator />
          <MenuItem onClick={handleBringToFront}>Bring to Front</MenuItem>
          <MenuItem onClick={handleSendToBack}>Send to Back</MenuItem>
        </>
      ) : (
        <>
          <MenuItem onClick={handlePaste}>Paste</MenuItem>
          {(hasShapeLayers || hasMultipleSelected) && (
            <>
              <MenuSeparator />
              <MenuItem onClick={handleCreateObject}>Save to Objects</MenuItem>
            </>
          )}
          <MenuSeparator />
          <MenuItem onClick={handleSelectAll}>Select All</MenuItem>
        </>
      )}
    </PopoverMenu>
  )
}
