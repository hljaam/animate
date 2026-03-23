export interface ElectronAPI {
  importAsset: (projectId: string) => Promise<AssetResult[] | null>
  importSwf: () => Promise<SwfProjectResult | null>
  saveProject: (projectJson: string) => Promise<{ success: boolean; filePath?: string }>
  openProject: () => Promise<{ filePath: string; data: string } | null>
  openScript: () => Promise<{ filePath: string; content: string } | null>
  importPsd: () => Promise<any | null>
  exportStart: (payload: ExportStartPayload) => Promise<{ success: boolean }>
  exportFrame: (payload: ExportFramePayload) => Promise<{ success: boolean }>
  exportFinalize: (payload: { projectId: string; totalFrames: number }) => Promise<ExportFinalizeResult>
  onExportProgress: (callback: (percent: number) => void) => () => void
}

interface AssetResult {
  id: string
  type: 'image'
  name: string
  localBundlePath: string
  width: number
  height: number
}

interface ExportStartPayload {
  projectId: string
  fps: number
  width: number
  height: number
}

interface ExportFramePayload {
  frame: number
  pixels: number[]
  width: number
  height: number
}

interface ExportFinalizeResult {
  success: boolean
  filePath?: string
  error?: string
}

type SwfShapeSegment =
  | { type: 'move'; x: number; y: number }
  | { type: 'line'; x: number; y: number }
  | { type: 'cubic'; cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number }
  | { type: 'quadratic'; cx: number; cy: number; x: number; y: number }
  | { type: 'close' }

interface SwfShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  bitmapFillAssetId?: string
  segments: SwfShapeSegment[]
  subPaths?: SwfShapeSegment[][]
}

interface SwfShapeData {
  paths: SwfShapePath[]
  originX: number
  originY: number
}

interface SwfSymbolDef {
  id: string
  name: string
  libraryItemName: string
  fps: number
  durationFrames: number
  layers: Array<SwfLayerResult>
}

interface SwfLayerResult {
  id: string
  name: string
  type: 'image' | 'shape' | 'text' | 'symbol'
  assetId?: string
  shapeData?: SwfShapeData
  symbolId?: string
  visible: boolean
  locked: boolean
  order: number
  startFrame: number
  endFrame: number
  tracks: Array<{
    property: string
    keyframes: Array<{ frame: number; value: number; easing: string }>
  }>
}

interface SwfProjectResult {
  id: string
  name: string
  width: number
  height: number
  fps: number
  durationFrames: number
  backgroundColor: string
  assets: AssetResult[]
  layers: SwfLayerResult[]
  symbols?: SwfSymbolDef[]
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
