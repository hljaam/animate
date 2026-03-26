import React, { useRef } from 'react'
import type { Layer, EasingType } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { DEFAULT_LAYER_PROPS, ALL_TRACK_PROPERTIES, DEFAULT_EASING } from '../../types/project'
import { getInterpolatedProps } from '../../pixi/interpolation'
import { copyLayers, getClipboard } from '../../store/clipboardStore'
import { generateId } from '../../utils/idGenerator'
import { useContextMenuPosition } from '../../hooks/useContextMenuPosition'
import { useClickOutside } from '../../hooks/useClickOutside'
import { PopoverMenu, MenuItem, MenuSeparator, MenuLabel } from '../ui/popover-menu'

interface Props {
  layer: Layer
  frame: number
  x: number
  y: number
  onClose: () => void
}

const TWEEN_TYPES: { label: string; value: EasingType }[] = [
  { label: 'Linear', value: 'linear' },
  { label: 'Ease In', value: 'easeIn' },
  { label: 'Ease Out', value: 'easeOut' },
  { label: 'Ease In-Out', value: 'easeInOut' },
]

function findSpanStartFrame(layer: Layer, frame: number): number | null {
  const allFrames = new Set<number>()
  for (const track of layer.tracks) {
    for (const kf of track.keyframes) allFrames.add(kf.frame)
  }
  const sorted = [...allFrames].sort((a, b) => a - b)
  for (let i = sorted.length - 1; i >= 0; i--) {
    if (sorted[i] <= frame) return sorted[i]
  }
  return null
}

function getSpanEasing(layer: Layer, spanStart: number): EasingType {
  for (const track of layer.tracks) {
    const kf = track.keyframes.find((k) => k.frame === spanStart)
    if (kf) return kf.easing
  }
  return DEFAULT_EASING
}

export default function KeyframeContextMenu({ layer, frame, x, y, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useContextMenuPosition(ref, x, y)
  useClickOutside(ref, onClose)

  const hasKeyframe = layer.tracks.some((t) => t.keyframes.some((k) => k.frame === frame))
  const spanStart = findSpanStartFrame(layer, frame)
  const spanEasing = spanStart !== null ? getSpanEasing(layer, spanStart) : DEFAULT_EASING
  const isTweened = spanEasing !== 'step'

  function handleInsertKeyframe(): void {
    if (hasKeyframe) { onClose(); return }
    const interpolated = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
    const inheritEasing = spanStart !== null ? getSpanEasing(layer, spanStart) : DEFAULT_EASING
    useProjectStore.getState().applyAction(`Insert keyframe at frame ${frame}`, (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const prop of ALL_TRACK_PROPERTIES) {
        let track = draftLayer.tracks.find((t) => t.property === prop)
        if (!track) {
          track = { property: prop, keyframes: [] }
          draftLayer.tracks.push(track)
        }
        if (!track.keyframes.some((k) => k.frame === frame)) {
          track.keyframes.push({ frame, value: interpolated[prop], easing: inheritEasing })
          track.keyframes.sort((a, b) => a.frame - b.frame)
        }
      }
      if (draftLayer.endFrame < frame + 1) draftLayer.endFrame = frame + 1
      const maxEnd = Math.max(...draft.layers.map((l) => l.endFrame))
      if (maxEnd >= draft.durationFrames) draft.durationFrames = maxEnd + 1
    })
    onClose()
  }

  function handleInsertBlankKeyframe(): void {
    useProjectStore.getState().applyAction(`Insert blank keyframe at frame ${frame}`, (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const prop of ALL_TRACK_PROPERTIES) {
        let track = draftLayer.tracks.find((t) => t.property === prop)
        if (!track) {
          track = { property: prop, keyframes: [] }
          draftLayer.tracks.push(track)
        }
        track.keyframes = track.keyframes.filter((k) => k.frame !== frame)
        track.keyframes.push({ frame, value: DEFAULT_LAYER_PROPS[prop], easing: DEFAULT_EASING })
        track.keyframes.sort((a, b) => a.frame - b.frame)
      }
      if (draftLayer.endFrame < frame + 1) draftLayer.endFrame = frame + 1
      const maxEnd = Math.max(...draft.layers.map((l) => l.endFrame))
      if (maxEnd >= draft.durationFrames) draft.durationFrames = maxEnd + 1
    })
    onClose()
  }

  function handleClearKeyframe(): void {
    useProjectStore.getState().applyAction(`Clear keyframe at frame ${frame}`, (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const track of draftLayer.tracks) {
        track.keyframes = track.keyframes.filter((kf) => kf.frame !== frame)
      }
    })
    onClose()
  }

  function handleRemoveFrame(): void {
    useProjectStore.getState().applyAction(`Remove frame`, (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      if (draftLayer.endFrame > draftLayer.startFrame) draftLayer.endFrame -= 1
      for (const track of draftLayer.tracks) {
        track.keyframes = track.keyframes.filter((kf) => kf.frame <= draftLayer.endFrame)
      }
    })
    onClose()
  }

  function handleCreateTween(easing: EasingType = 'linear'): void {
    if (spanStart === null) { onClose(); return }
    useProjectStore.getState().applyAction('Create Classic Tween', (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const track of draftLayer.tracks) {
        const kf = track.keyframes.find((k) => k.frame === spanStart)
        if (kf) kf.easing = easing
      }
    })
    onClose()
  }

  function handleRemoveTween(): void {
    if (spanStart === null) { onClose(); return }
    useProjectStore.getState().applyAction('Remove Tween', (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const track of draftLayer.tracks) {
        const kf = track.keyframes.find((k) => k.frame === spanStart)
        if (kf) kf.easing = 'step'
      }
    })
    onClose()
  }

  function handleSetTweenType(easing: EasingType): void {
    if (spanStart === null) { onClose(); return }
    useProjectStore.getState().applyAction(`Set tween to ${easing}`, (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const track of draftLayer.tracks) {
        const kf = track.keyframes.find((k) => k.frame === spanStart)
        if (kf) kf.easing = easing
      }
    })
    onClose()
  }

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
    const idsToDelete = selectedIds.length > 1 ? selectedIds : [layer.id]
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

  function handleToggleVisibility(): void {
    useProjectStore.getState().updateLayer(layer.id, { visible: !layer.visible })
    onClose()
  }

  function handleToggleLock(): void {
    useProjectStore.getState().updateLayer(layer.id, { locked: !layer.locked })
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

  return (
    <PopoverMenu ref={ref} x={x} y={y} className="min-w-[200px]">
      {/* Frame / keyframe section */}
      {!hasKeyframe && (
        <>
          {!isTweened ? (
            <MenuItem onClick={() => handleCreateTween('linear')}>
              Create Classic Tween
            </MenuItem>
          ) : (
            <MenuItem onClick={handleRemoveTween}>
              Remove Tween
            </MenuItem>
          )}
          <MenuSeparator />
        </>
      )}

      {isTweened && (
        <>
          <MenuLabel>Tween Type</MenuLabel>
          {TWEEN_TYPES.map((opt) => (
            <MenuItem
              key={opt.value}
              onClick={() => handleSetTweenType(opt.value)}
              active={spanEasing === opt.value}
            >
              {opt.label}
            </MenuItem>
          ))}
          <MenuSeparator />
        </>
      )}

      {!hasKeyframe && (
        <MenuItem onClick={handleInsertKeyframe}>
          Insert Keyframe (F6)
        </MenuItem>
      )}
      <MenuItem onClick={handleInsertBlankKeyframe}>
        Insert Blank Keyframe (F7)
      </MenuItem>

      {hasKeyframe && (
        <>
          <MenuSeparator />
          <MenuItem onClick={handleClearKeyframe}>
            Clear Keyframe
          </MenuItem>
        </>
      )}

      <MenuSeparator />
      <MenuItem onClick={handleRemoveFrame}>Remove Frame</MenuItem>

      {/* Layer section */}
      <MenuSeparator />
      <MenuItem onClick={handleCopy}>Copy</MenuItem>
      <MenuItem onClick={handlePaste}>Paste</MenuItem>
      <MenuItem onClick={handleDelete}>Delete</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={handleToggleVisibility}>{layer.visible ? 'Hide' : 'Show'}</MenuItem>
      <MenuItem onClick={handleToggleLock}>{layer.locked ? 'Unlock' : 'Lock'}</MenuItem>
      <MenuSeparator />
      {layer.type !== 'symbol' ? (
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
