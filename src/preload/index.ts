import { contextBridge, ipcRenderer } from 'electron'

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
  projectId: string
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
  segments: SwfShapeSegment[]
  subPaths?: SwfShapeSegment[][]
}

interface SwfShapeData {
  paths: SwfShapePath[]
  originX: number
  originY: number
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
  layers: Array<{
    id: string
    name: string
    type: 'image' | 'shape' | 'text'
    assetId?: string
    shapeData?: SwfShapeData
    visible: boolean
    locked: boolean
    order: number
    startFrame: number
    endFrame: number
    tracks: Array<{
      property: string
      keyframes: Array<{ frame: number; value: number; easing: string }>
    }>
  }>
}

const api: ElectronAPI = {
  importAsset: (projectId) => ipcRenderer.invoke('import-asset', projectId),
  importSwf: () => ipcRenderer.invoke('import-swf'),
  saveProject: (projectJson) => ipcRenderer.invoke('save-project', projectJson),
  openProject: () => ipcRenderer.invoke('open-project'),
  openScript: () => ipcRenderer.invoke('open-script'),
  importPsd: () => ipcRenderer.invoke('import-psd'),
  exportStart: (payload) => ipcRenderer.invoke('export-start', payload),
  exportFrame: (payload) => ipcRenderer.invoke('export-frame', payload),
  exportFinalize: (payload) => ipcRenderer.invoke('export-finalize', payload),
  onExportProgress: (callback) => {
    const listener = (_event: Electron.IpcRendererEvent, percent: number): void => callback(percent)
    ipcRenderer.on('export-progress', listener)
    return () => ipcRenderer.removeListener('export-progress', listener)
  }
}

contextBridge.exposeInMainWorld('electronAPI', api)
