import React, { useEffect, useRef } from 'react'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { copyLayers, getClipboard, getClipboardCenter } from '../../store/clipboardStore'
import { generateId } from '../../utils/idGenerator'

interface Props {
  layer: Layer
  x: number
  y: number
  onClose: () => void
}

export default function LayerContextMenu({ layer, x, y, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const history = useProjectStore((s) => s.history)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

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
    const name = layer.name
    const originalLayer = JSON.parse(JSON.stringify(layer))

    state.applyAction(`Convert to symbol "${name}"`, (draft) => {
      // Remove original layer
      const idx = draft.layers.findIndex((l) => l.id === layer.id)
      if (idx === -1) return
      draft.layers.splice(idx, 1)

      // Add symbol definition
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

      // Add symbol layer
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
        tracks: JSON.parse(JSON.stringify(originalLayer.tracks))
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
    if (layer.type === 'symbol' && layer.symbolId) {
      useEditorStore.getState().setEditingSymbolId(layer.symbolId)
    }
    onClose()
  }

  function handleCreateObject(): void {
    const selectedIds = useEditorStore.getState().selectedLayerIds
    const project = useProjectStore.getState().project
    if (!project) return
    const shapeLayerIds = selectedIds.filter((id) => {
      const l = project.layers.find((ly) => ly.id === id)
      return l?.type === 'shape'
    })
    // If no multi-select, use the current layer
    const ids = shapeLayerIds.length > 0 ? shapeLayerIds : (layer.type === 'shape' ? [layer.id] : [])
    if (ids.length > 0) {
      useEditorStore.getState().setShowCreateObjectDialog({ layerIds: ids })
    }
    onClose()
  }

  const hasShapeLayers = (() => {
    const selectedIds = useEditorStore.getState().selectedLayerIds
    const project = useProjectStore.getState().project
    if (!project) return layer.type === 'shape'
    const anySelected = selectedIds.some((id) => {
      const l = project.layers.find((ly) => ly.id === id)
      return l?.type === 'shape'
    })
    return anySelected || layer.type === 'shape'
  })()

  const items = [
    { label: 'Copy', action: handleCopy },
    { label: 'Paste', action: handlePaste },
    { label: 'Delete', action: handleDelete },
    { label: '---' },
    { label: layer.visible ? 'Hide' : 'Show', action: handleToggleVisibility },
    { label: layer.locked ? 'Unlock' : 'Lock', action: handleToggleLock },
    { label: '---' },
    ...(layer.type !== 'symbol'
      ? [{ label: 'Convert to Symbol', action: handleConvertToSymbol }]
      : [{ label: 'Edit Symbol', action: handleEditSymbol }]),
    ...(hasShapeLayers
      ? [{ label: 'Save to Objects', action: handleCreateObject }]
      : [])
  ]

  return (
    <div ref={ref} style={{ ...styles.menu, left: x, top: y }}>
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} style={styles.separator} />
        ) : (
          <button key={i} style={styles.item} onClick={item.action}>
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'fixed',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '4px 0',
    zIndex: 1000,
    minWidth: 160,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
  },
  item: {
    display: 'block',
    width: '100%',
    padding: '5px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer'
  },
  separator: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0'
  }
}
