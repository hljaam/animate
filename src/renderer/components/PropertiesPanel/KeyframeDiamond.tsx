import React from 'react'
import type { TrackProperty, EasingType } from '../../types/project'
import { DEFAULT_EASING } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  layerId: string
  property: TrackProperty
  currentValue: number
  hasKeyframe: boolean
}

export default function KeyframeDiamond({ layerId, property, currentValue, hasKeyframe }: Props): React.ReactElement {
  function handleClick(): void {
    const state = useProjectStore.getState()
    const { currentFrame } = useEditorStore.getState()

    if (hasKeyframe) {
      state.mutateProject((draft) => {
        const layer = draft.layers.find((l) => l.id === layerId)
        if (!layer) return
        const track = layer.tracks.find((t) => t.property === property)
        if (!track) return
        track.keyframes = track.keyframes.filter((kf) => kf.frame !== currentFrame)
      })
    } else {
      state.applyAction(`Add keyframe on ${property} at frame ${currentFrame}`, (draft) => {
        const layer = draft.layers.find((l) => l.id === layerId)
        if (!layer) return
        let track = layer.tracks.find((t) => t.property === property)
        if (!track) {
          track = { property, keyframes: [] }
          layer.tracks.push(track)
        }
        const kfIdx = track.keyframes.findIndex((kf) => kf.frame === currentFrame)
        if (kfIdx === -1) {
          track.keyframes.push({ frame: currentFrame, value: currentValue, easing: DEFAULT_EASING })
          track.keyframes.sort((a, b) => a.frame - b.frame)
        } else {
          track.keyframes[kfIdx].value = currentValue
        }
      })
    }
  }

  return (
    <button
      onClick={handleClick}
      title={hasKeyframe ? 'Remove keyframe' : 'Add keyframe'}
      style={{
        background: 'none',
        border: 'none',
        padding: '2px',
        cursor: 'pointer',
        color: hasKeyframe ? 'var(--accent)' : 'var(--text-muted)',
        display: 'flex',
        alignItems: 'center',
        minHeight: 'auto',
        minWidth: 'auto'
      }}
    >
      <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
        <rect
          x="6"
          y="1"
          width="7.07"
          height="7.07"
          rx="1"
          transform="rotate(45 6 1)"
          fill={hasKeyframe ? 'currentColor' : 'none'}
          stroke="currentColor"
          strokeWidth="1.2"
        />
      </svg>
    </button>
  )
}
