export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut'

export type TrackProperty = 'x' | 'y' | 'scaleX' | 'scaleY' | 'rotation' | 'opacity'

export interface Keyframe {
  frame: number
  value: number
  easing: EasingType
}

export interface PropertyTrack {
  property: TrackProperty
  keyframes: Keyframe[]
}

export interface TextData {
  text: string
  font: string
  color: string
  size: number
}

export type LayerType = 'image' | 'text'

export interface Layer {
  id: string
  name: string
  type: LayerType
  assetId?: string
  textData?: TextData
  visible: boolean
  locked: boolean
  order: number
  startFrame: number
  endFrame: number
  tracks: PropertyTrack[]
}

export interface Asset {
  id: string
  type: 'image'
  name: string
  localBundlePath: string
  width: number
  height: number
}

export interface Project {
  id: string
  name: string
  width: number
  height: number
  fps: number
  durationFrames: number
  backgroundColor: string
  assets: Asset[]
  layers: Layer[]
}

// Default property values for new layers
export const DEFAULT_LAYER_PROPS: Record<TrackProperty, number> = {
  x: 0,
  y: 0,
  scaleX: 1,
  scaleY: 1,
  rotation: 0,
  opacity: 1
}

export const ALL_TRACK_PROPERTIES: TrackProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']
