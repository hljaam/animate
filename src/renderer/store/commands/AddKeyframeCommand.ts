import type { ICommand } from './Command'
import type { TrackProperty, EasingType } from '../../types/project'
import { useProjectStore } from '../projectStore'

export class AddKeyframeCommand implements ICommand {
  description: string
  private layerId: string
  private property: TrackProperty
  private frame: number
  private value: number
  private easing: EasingType

  constructor(
    layerId: string,
    property: TrackProperty,
    frame: number,
    value: number,
    easing: EasingType = 'linear'
  ) {
    this.layerId = layerId
    this.property = property
    this.frame = frame
    this.value = value
    this.easing = easing
    this.description = `Add keyframe on ${property} at frame ${frame}`
  }

  execute(): void {
    useProjectStore.getState().setKeyframeDirect(
      this.layerId,
      this.property,
      this.frame,
      this.value,
      this.easing
    )
  }

  undo(): void {
    useProjectStore.getState().removeKeyframeDirect(this.layerId, this.property, this.frame)
  }
}
