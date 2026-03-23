export type EasingType = 'linear' | 'easeIn' | 'easeOut' | 'easeInOut' | 'step'

/** Default easing for new keyframes — 'step' = hold (Adobe Animate model) */
export const DEFAULT_EASING: EasingType = 'step'

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

export type ShapeSegment =
  | { type: 'move'; x: number; y: number }
  | { type: 'line'; x: number; y: number }
  | { type: 'cubic'; cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number }
  | { type: 'quadratic'; cx: number; cy: number; x: number; y: number }
  | { type: 'close' }

export interface ShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  bitmapFillAssetId?: string
  segments: ShapeSegment[]
  /** Additional sub-paths for the same fill — used for even-odd holes (ring/donut shapes). */
  subPaths?: ShapeSegment[][]
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

// ── Shape Object Definition (reusable shape objects) ──────────────────────

export interface ShapeObjectDef {
  id: string
  name: string
  paths: ShapePath[]
  originX: number
  originY: number
  layers?: Layer[]
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

  // Shape object reference (for object layers)
  shapeObjectId?: string

  // Outline mode (show layer as colored outline)
  outlineMode?: boolean
  outlineColor?: string

  // Semi-transparent view mode (Shift+click eye)
  semiTransparent?: boolean
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
  shapeObjects?: ShapeObjectDef[]
  frameLabels?: Record<number, string>
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
