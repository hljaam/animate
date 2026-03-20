import { create } from 'zustand'

interface EditorState {
  selectedLayerId: string | null
  currentFrame: number
  isPlaying: boolean
  zoom: number
  panX: number
  panY: number
  fitZoom: number
  showNewProjectDialog: boolean
  isExporting: boolean
  exportProgress: number
  showCommandConsole: boolean

  setSelectedLayerId: (id: string | null) => void
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  setViewport: (zoom: number, panX: number, panY: number) => void
  setFitZoom: (zoom: number) => void
  setShowNewProjectDialog: (show: boolean) => void
  setIsExporting: (exporting: boolean) => void
  setExportProgress: (progress: number) => void
  setShowCommandConsole: (show: boolean) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedLayerId: null,
  currentFrame: 0,
  isPlaying: false,
  zoom: 0,
  panX: 0,
  panY: 0,
  fitZoom: 0,
  showNewProjectDialog: true, // show on startup
  isExporting: false,
  exportProgress: 0,
  showCommandConsole: false,

  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom }),
  setViewport: (zoom, panX, panY) => set({ zoom, panX, panY }),
  setFitZoom: (fitZoom) => set({ fitZoom }),
  setShowNewProjectDialog: (show) => set({ showNewProjectDialog: show }),
  setIsExporting: (exporting) => set({ isExporting: exporting }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
  setShowCommandConsole: (show) => set({ showCommandConsole: show })
}))
