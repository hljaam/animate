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

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
