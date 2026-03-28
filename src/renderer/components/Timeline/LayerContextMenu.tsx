import React, { useRef } from 'react'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { copyLayers, getClipboard, getClipboardCenter } from '../../store/clipboardStore'
import { generateId } from '../../utils/idGenerator'
import { getLayerType, getLayerSymbolId } from '../../utils/layerContent'
import { useContextMenuPosition } from '../../hooks/useContextMenuPosition'
import { useClickOutside } from '../../hooks/useClickOutside'
import { PopoverMenu, MenuItem, MenuSeparator } from '../ui/popover-menu'

interface Props {
  layer: Layer
  x: number
  y: number
  onClose: () => void
}

export default function LayerContextMenu({ layer, x, y, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useContextMenuPosition(ref, x, y)
  const history = useProjectStore((s) => s.history)
  useClickOutside(ref, onClose)

  function handleCopy(): void {
    const selectedIds = useEditorStore.getState().selectedLayerIds
    if (selectedIds.length > 1) {
      const layers = selectedIds
        .map((id) => useProjectStore.getState().getLayer(id))
        .filter((l): l is NonNullable<typeof l> => l != null)
      copyLayers(layers)
    } else {
      copyLayers([layer])
    }
    onClose()
  }

  function handlePaste(): void {
    const clipboard = getClipboard()
    if (clipboard.length > 0) {
      const project = useProjectStore.getState().project
      const maxOrder = project ? Math.max(...project.layers.map((l) => l.order), 0) : 0
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
            cloneIds.push(clone.id)
            draft.layers.push(clone)
          }
          draft.layers.sort((a, b) => a.order - b.order)
        }
      )
      useEditorStore.getState().setSelectedLayerIds(cloneIds)
    }
    onClose()
  }

  function handleDelete(): void {
    const selectedIds = useEditorStore.getState().selectedLayerIds
    const idsToDelete = selectedIds.length > 1
      ? selectedIds
      : [layer.id]
    const desc = idsToDelete.length === 1
      ? `Remove layer "${layer.name}"`
      : `Remove ${idsToDelete.length} layers`
    useProjectStore.getState().applyAction(desc, (draft) => {
      const idSet = new Set(idsToDelete)
      draft.layers = draft.layers.filter((l) => !idSet.has(l.id))
    })
    useEditorStore.getState().setSelectedLayerIds([])
    onClose()
  }

  function handleConvertToSymbol(): void {
    const state = useProjectStore.getState()
    const project = state.project
    if (!project) return

    const symbolId = generateId()
    const symbolLayerId = generateId()
    const contentItemId = generateId()
    const name = layer.name
    const originalLayer = JSON.parse(JSON.stringify(layer))

    state.applyAction(`Convert to symbol "${name}"`, (draft) => {
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

      draft.layers.push({
        id: symbolLayerId,
        name,
        type: 'symbol' as any,
        symbolId,
        visible: true,
        locked: false,
        order: originalLayer.order,
        startFrame: originalLayer.startFrame,
        endFrame: originalLayer.endFrame,
        tracks: JSON.parse(JSON.stringify(originalLayer.tracks)),
        contentItems: [{ id: contentItemId, name, content: { type: 'symbol' as const, symbolId } }],
        contentKeyframes: [{ frame: originalLayer.startFrame, contentItemId }]
      })
      draft.layers.sort((a, b) => a.order - b.order)
    })
    onClose()
  }

  function handleToggleVisibility(): void {
    useProjectStore.getState().updateLayer(layer.id, { visible: !layer.visible })
    onClose()
  }

  function handleToggleLock(): void {
    useProjectStore.getState().updateLayer(layer.id, { locked: !layer.locked })
    onClose()
  }

  function handleEditSymbol(): void {
    const symId = getLayerSymbolId(layer, 0)
    if (getLayerType(layer) === 'symbol' && symId) {
      useEditorStore.getState().setEditingSymbolId(symId)
    }
    onClose()
  }

  function handleCreateObject(): void {
    const selectedIds = useEditorStore.getState().selectedLayerIds
    const project = useProjectStore.getState().project
    if (!project) return
    const shapeLayerIds = selectedIds.filter((id) => {
      const l = project.layers.find((ly) => ly.id === id)
      return l ? getLayerType(l) === 'shape' : false
    })
    const ids = shapeLayerIds.length > 0 ? shapeLayerIds : (getLayerType(layer) === 'shape' ? [layer.id] : [])
    if (ids.length > 0) {
      useEditorStore.getState().setShowCreateObjectDialog({ layerIds: ids })
    }
    onClose()
  }

  const hasShapeLayers = (() => {
    const selectedIds = useEditorStore.getState().selectedLayerIds
    const project = useProjectStore.getState().project
    if (!project) return getLayerType(layer) === 'shape'
    const anySelected = selectedIds.some((id) => {
      const l = project.layers.find((ly) => ly.id === id)
      return l ? getLayerType(l) === 'shape' : false
    })
    return anySelected || getLayerType(layer) === 'shape'
  })()

  return (
    <PopoverMenu ref={ref} x={x} y={y}>
      <MenuItem onClick={handleCopy}>Copy</MenuItem>
      <MenuItem onClick={handlePaste}>Paste</MenuItem>
      <MenuItem onClick={handleDelete}>Delete</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={handleToggleVisibility}>{layer.visible ? 'Hide' : 'Show'}</MenuItem>
      <MenuItem onClick={handleToggleLock}>{layer.locked ? 'Unlock' : 'Lock'}</MenuItem>
      <MenuSeparator />
      {getLayerType(layer) !== 'symbol' ? (
        <MenuItem onClick={handleConvertToSymbol}>Convert to Symbol</MenuItem>
      ) : (
        <MenuItem onClick={handleEditSymbol}>Edit Symbol</MenuItem>
      )}
      {hasShapeLayers && (
        <MenuItem onClick={handleCreateObject}>Save to Objects</MenuItem>
      )}
    </PopoverMenu>
  )
}
