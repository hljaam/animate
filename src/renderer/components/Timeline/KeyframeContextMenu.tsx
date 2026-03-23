import React, { useEffect, useRef } from 'react'
import type { Layer, EasingType } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { DEFAULT_LAYER_PROPS, ALL_TRACK_PROPERTIES, DEFAULT_EASING } from '../../types/project'
import { getInterpolatedProps } from '../../pixi/interpolation'

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

/** Find the keyframe at or before a given frame — this is the span's start keyframe */
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

/** Get the easing of the span starting at a given keyframe frame */
function getSpanEasing(layer: Layer, spanStart: number): EasingType {
  for (const track of layer.tracks) {
    const kf = track.keyframes.find((k) => k.frame === spanStart)
    if (kf) return kf.easing
  }
  return DEFAULT_EASING
}

export default function KeyframeContextMenu({ layer, frame, x, y, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose()
      }
    }
    const id = setTimeout(() => document.addEventListener('mousedown', handleClick), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('mousedown', handleClick)
    }
  }, [onClose])

  const hasKeyframe = layer.tracks.some((t) => t.keyframes.some((k) => k.frame === frame))
  const spanStart = findSpanStartFrame(layer, frame)
  const spanEasing = spanStart !== null ? getSpanEasing(layer, spanStart) : DEFAULT_EASING
  const isTweened = spanEasing !== 'step'

  // --- Handlers ---

  function handleInsertKeyframe(): void {
    if (hasKeyframe) { onClose(); return }
    const interpolated = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
    // Inherit easing from the span we're splitting
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
    useProjectStore.getState().applyAction(`Remove frame at ${frame}`, (draft) => {
      const draftLayer = draft.layers.find((l) => l.id === layer.id)
      if (!draftLayer) return
      for (const track of draftLayer.tracks) {
        track.keyframes = track.keyframes.filter((kf) => kf.frame !== frame)
        for (const kf of track.keyframes) {
          if (kf.frame > frame) kf.frame -= 1
        }
      }
      if (draftLayer.endFrame > 0) draftLayer.endFrame -= 1
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
        minWidth: 200,
        zIndex: 1000,
        boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
      }}
    >
      {/* --- Span context (non-keyframe frame) --- */}
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
          <Separator />
        </>
      )}

      {/* Tween type submenu — shown when span is tweened */}
      {isTweened && (
        <>
          <div style={{ padding: '2px 16px', fontSize: 10, color: 'var(--text-muted)' }}>
            Tween Type
          </div>
          {TWEEN_TYPES.map((opt) => (
            <MenuItem
              key={opt.value}
              onClick={() => handleSetTweenType(opt.value)}
              active={spanEasing === opt.value}
            >
              {opt.label}
            </MenuItem>
          ))}
          <Separator />
        </>
      )}

      {/* Insert options */}
      {!hasKeyframe && (
        <MenuItem onClick={handleInsertKeyframe}>
          Insert Keyframe (F6)
        </MenuItem>
      )}
      <MenuItem onClick={handleInsertBlankKeyframe}>
        Insert Blank Keyframe (F7)
      </MenuItem>

      {/* Keyframe-specific options */}
      {hasKeyframe && (
        <>
          <Separator />
          <MenuItem onClick={handleClearKeyframe}>
            Clear Keyframe
          </MenuItem>
        </>
      )}

      <Separator />
      <MenuItem onClick={handleRemoveFrame}>
        Remove Frame
      </MenuItem>
    </div>
  )
}

// --- Reusable menu item ---

function MenuItem({ children, onClick, active }: {
  children: React.ReactNode
  onClick: () => void
  active?: boolean
}): React.ReactElement {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'block',
        width: '100%',
        padding: '6px 16px',
        background: 'none',
        border: 'none',
        color: active ? 'var(--accent)' : 'var(--text)',
        fontSize: 12,
        fontWeight: active ? 600 : 400,
        textAlign: 'left',
        cursor: 'pointer'
      }}
      onMouseEnter={(e) => { (e.target as HTMLElement).style.background = 'var(--accent-dim)' }}
      onMouseLeave={(e) => { (e.target as HTMLElement).style.background = 'none' }}
    >
      {children}
    </button>
  )
}

function Separator(): React.ReactElement {
  return <div style={{ height: 1, background: 'var(--border)', margin: '4px 0' }} />
}
