import type { ICommand } from './Command'
import type { TrackProperty, EasingType } from '../../types/project'
import { useProjectStore } from '../projectStore'

interface KeyframeSnapshot {
  layerId: string
  property: TrackProperty
  frame: number
  value: number
  easing: EasingType
}

export class UpdateKeyframeCommand implements ICommand {
  description: string
  private before: KeyframeSnapshot[]
  private after: KeyframeSnapshot[]

  constructor(before: KeyframeSnapshot[], after: KeyframeSnapshot[]) {
    this.before = before
    this.after = after
    this.description = 'Update keyframes'
  }

  execute(): void {
    const state = useProjectStore.getState()
    for (const kf of this.after) {
      state.setKeyframeDirect(kf.layerId, kf.property, kf.frame, kf.value, kf.easing)
    }
  }

  undo(): void {
    const state = useProjectStore.getState()
    // Remove after-keyframes that didn't exist before
    for (const kf of this.after) {
      const existed = this.before.find(
        (b) => b.layerId === kf.layerId && b.property === kf.property && b.frame === kf.frame
      )
      if (!existed) {
        state.removeKeyframeDirect(kf.layerId, kf.property, kf.frame)
      }
    }
    // Restore before values
    for (const kf of this.before) {
      state.setKeyframeDirect(kf.layerId, kf.property, kf.frame, kf.value, kf.easing)
    }
  }
}
