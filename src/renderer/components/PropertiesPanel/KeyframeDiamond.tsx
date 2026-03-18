import React from 'react'
import type { TrackProperty, EasingType } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { AddKeyframeCommand } from '../../store/commands/AddKeyframeCommand'

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
      // Remove keyframe
      state.removeKeyframeDirect(layerId, property, currentFrame)
    } else {
      // Add keyframe via command (undoable)
      const cmd = new AddKeyframeCommand(layerId, property, currentFrame, currentValue, 'linear')
      state.history.push(cmd)
    }
  }

  return (
    <button
      onClick={handleClick}
      title={hasKeyframe ? 'Remove keyframe' : 'Add keyframe'}
      style={{
        background: 'none',
        border: 'none',
        padding: '2px 4px',
        cursor: 'pointer',
        color: hasKeyframe ? 'var(--accent)' : 'var(--text-muted)',
        fontSize: 12,
        display: 'flex',
        alignItems: 'center'
      }}
    >
      ◆
    </button>
  )
}
