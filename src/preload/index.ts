import { contextBridge, ipcRenderer } from 'electron'

export interface ElectronAPI {
  importAsset: (projectId: string) => Promise<AssetResult[] | null>
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

const api: ElectronAPI = {
  importAsset: (projectId) => ipcRenderer.invoke('import-asset', projectId),
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
