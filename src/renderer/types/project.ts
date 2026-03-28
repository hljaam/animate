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

// ── Content System (unified content palette + timeline) ──────────────────

export type ContentType = 'shape' | 'shapeObject' | 'symbol' | 'image'

export type ContentPayload =
  | { type: 'shape'; shapeData: ShapeData }
  | { type: 'shapeObject'; shapeObjectId: string }
  | { type: 'symbol'; symbolId: string }
  | { type: 'image'; assetId: string }

/** A content item in the layer's palette of available content */
export interface ContentItem {
  id: string
  name: string
  content: ContentPayload
}

/** Which content item is active at a given frame (hold-by-default) */
export interface ContentKeyframe {
  frame: number
  contentItemId: string   // references ContentItem.id in this layer's contentItems
}

// ── Legacy types (kept for migration of old .animate files) ──────────────

/** @deprecated Use contentItems/contentKeyframes instead */
export interface AssetSwap {
  startFrame: number
  endFrame: number
  assetId: string
}

/** @deprecated Use contentItems/contentKeyframes instead */
export interface ShapeObjectSwap {
  frame: number
  shapeObjectId: string
  shapeData: ShapeData
  tracks?: PropertyTrack[]
  offsetX?: number
  offsetY?: number
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
  /** Associated symbol ID for objects with independent animation */
  symbolId?: string
}

// ── Unit Definition (grouping of objects/symbols) ─────────────────────────

export interface UnitDef {
  id: string
  name: string
  shapeObjectIds: string[]
  symbolIds: string[]
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
  visible: boolean
  locked: boolean
  order: number
  startFrame: number
  endFrame: number
  tracks: PropertyTrack[]

  // ── Content system ──
  contentItems: ContentItem[]
  contentKeyframes: ContentKeyframe[]

  // Text stays as direct property (not content-swappable)
  textData?: TextData

  // ── Appearance ──
  blendMode?: string
  tintColor?: string
  tintAmount?: number
  filters?: FilterConfig[]

  // ── Masking ──
  isMask?: boolean
  maskLayerId?: string

  // ── Shape morphing ──
  shapeKeyframes?: ShapeKeyframe[]

  // ── Display modes ──
  outlineMode?: boolean
  outlineColor?: string
  semiTransparent?: boolean

  // ── Legacy fields (kept for migration of old .animate files) ──
  /** @deprecated Derived from contentItems — use getLayerType() */
  type?: LayerType
  /** @deprecated Use contentItems with type:'image' */
  assetId?: string
  /** @deprecated Use contentItems with type:'shape' */
  shapeData?: ShapeData
  /** @deprecated Use contentItems with type:'symbol' */
  symbolId?: string
  /** @deprecated Use contentItems with type:'shapeObject' */
  shapeObjectId?: string
  /** @deprecated Use contentItems/contentKeyframes */
  assetSwaps?: AssetSwap[]
  /** @deprecated Use contentItems/contentKeyframes */
  shapeObjectSwaps?: ShapeObjectSwap[]
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
  units?: UnitDef[]
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
