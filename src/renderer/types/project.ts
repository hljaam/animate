export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step'

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

export interface ShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  bitmapFillAssetId?: string
  points: Array<{ x: number; y: number }>
  /** Additional sub-paths for the same fill — used for even-odd holes (ring/donut shapes). */
  subPaths?: Array<Array<{ x: number; y: number }>>
}

export interface ShapeData {
  paths: ShapePath[]
  originX: number // shape center X offset for anchor
  originY: number // shape center Y offset for anchor
}

// ── Filter Config ──────────────────────────────────────────────────────────

export interface FilterConfig {
  type: 'blur' | 'dropShadow' | 'glow'
  enabled: boolean
  blurX?: number
  blurY?: number
  shadowColor?: string
  shadowAlpha?: number
  shadowBlur?: number
  shadowDistance?: number
  shadowAngle?: number
  glowColor?: string
  glowOuterStrength?: number
}

// ── Asset Swap (frame-by-frame symbol swapping) ───────────────────────────

export interface AssetSwap {
  startFrame: number
  endFrame: number
  assetId: string
}

// ── Shape Keyframe (morph shapes) ─────────────────────────────────────────

export interface ShapeKeyframe {
  frame: number
  shapeData: ShapeData
}

// ── Symbol Definition (nested timelines) ──────────────────────────────────

export interface SymbolDef {
  id: string
  name: string
  libraryItemName: string
  fps: number
  durationFrames: number
  layers: Layer[]
}

// ── Layer ──────────────────────────────────────────────────────────────────

export type LayerType = 'image' | 'text' | 'shape' | 'symbol'

export interface Layer {
  id: string
  name: string
  type: LayerType
  assetId?: string
  textData?: TextData
  shapeData?: ShapeData
  visible: boolean
  locked: boolean
  order: number
  startFrame: number
  endFrame: number
  tracks: PropertyTrack[]

  // Blend mode
  blendMode?: string

  // Color transform / tint
  tintColor?: string
  tintAmount?: number

  // Filters
  filters?: FilterConfig[]

  // Frame-by-frame asset swapping
  assetSwaps?: AssetSwap[]

  // Masking
  isMask?: boolean
  maskLayerId?: string

  // Morph shapes
  shapeKeyframes?: ShapeKeyframe[]

  // Nested symbol timeline
  symbolId?: string
}

export interface Asset {
  id: string
  type: 'image' | 'sound' | 'font'
  name: string
  localBundlePath: string
  width: number
  height: number
  format?: string
  duration?: number
  fontFamily?: string
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
  symbols?: SymbolDef[]
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
