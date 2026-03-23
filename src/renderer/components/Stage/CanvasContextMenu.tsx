import React, { useEffect, useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { copyLayers, getClipboard, getClipboardCenter } from '../../store/clipboardStore'
import { generateId } from '../../utils/idGenerator'
import type { Layer } from '../../types/project'

export default function CanvasContextMenu(): React.ReactElement | null {
  const menu = useEditorStore((s) => s.canvasContextMenu)
  const setMenu = useEditorStore((s) => s.setCanvasContextMenu)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!menu) return
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        setMenu(null)
      }
    }
    // Delay to avoid immediate close from the same pointerdown
    const id = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [menu, setMenu])

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
    // Find the stage container element
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
          // Offset x/y keyframes
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

  // Check if multiple layers are selected (for Create Object option)
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

  const items: Array<{ label: string; action: () => void; disabled?: boolean } | 'separator'> = []

  if (layerId) {
    items.push({ label: 'Copy', action: handleCopy })
    items.push({ label: 'Paste', action: handlePaste })
    items.push({ label: 'Delete', action: handleDelete })
    items.push('separator')
    if (hasShapeLayers || hasMultipleSelected) {
      items.push({ label: 'Save to Objects', action: handleCreateObject })
      items.push('separator')
    }
    items.push({ label: 'Bring to Front', action: handleBringToFront })
    items.push({ label: 'Send to Back', action: handleSendToBack })
  } else {
    items.push({ label: 'Paste', action: handlePaste })
    if (hasShapeLayers || hasMultipleSelected) {
      items.push('separator')
      items.push({ label: 'Save to Objects', action: handleCreateObject })
    }
    items.push('separator')
    items.push({ label: 'Select All', action: handleSelectAll })
  }

  return (
    <div
      ref={ref}
      style={{
        position: 'fixed',
        left: x,
        top: y,
        background: 'var(--bg-secondary)',
        border: '1px solid var(--border)',
        borderRadius: 4,
        padding: '4px 0',
        minWidth: 160,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
      }}
    >
      {items.map((item, i) => {
        if (item === 'separator') {
          return <div key={i} style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
        }
        return (
          <button
            key={item.label}
            onClick={item.action}
            disabled={item.disabled}
            style={{
              display: 'block',
              width: '100%',
              padding: '6px 16px',
              background: 'none',
              border: 'none',
              color: item.disabled ? 'var(--text-muted)' : 'var(--text)',
              fontSize: 12,
              textAlign: 'left',
              cursor: item.disabled ? 'default' : 'pointer'
            }}
            onMouseEnter={(e) => { if (!item.disabled) (e.target as HTMLElement).style.background = 'var(--accent-dim)' }}
            onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none' }}
          >
            {item.label}
          </button>
        )
      })}
    </div>
  )
}
