import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  importAsset: (projectId: string) => Promise<AssetResult[] | null>
  importFla: () => Promise<FlaProjectResult | null>
  importXfl: () => Promise<FlaProjectResult | null>
  importSwf: () => Promise<FlaProjectResult | null>
  importAnimate: () => Promise<FlaProjectResult | null>
  saveProject: (projectJson: string) => Promise<{ success: boolean; filePath?: string }>
  openProject: () => Promise<{ filePath: string; data: string } | null>
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

interface FlaShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  bitmapFillAssetId?: string
  points: Array<{ x: number; y: number }>
}

interface FlaShapeData {
  paths: FlaShapePath[]
  originX: number
  originY: number
}

interface FlaProjectResult {
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
    type: 'image' | 'shape'
    assetId?: string
    shapeData?: FlaShapeData
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
  importFla: () => ipcRenderer.invoke('import-fla'),
  importXfl: () => ipcRenderer.invoke('import-xfl'),
  importSwf: () => ipcRenderer.invoke('import-swf'),
  importAnimate: () => ipcRenderer.invoke('import-animate'),
  saveProject: (projectJson) => ipcRenderer.invoke('save-project', projectJson),
  openProject: () => ipcRenderer.invoke('open-project'),
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
