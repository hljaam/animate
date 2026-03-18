import { create } from 'zustand'

interface EditorState {
  selectedLayerId: string | null
  currentFrame: number
  isPlaying: boolean
  zoom: number
  showNewProjectDialog: boolean
  isExporting: boolean
  exportProgress: number

  setSelectedLayerId: (id: string | null) => void
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  setZoom: (zoom: number) => void
  setShowNewProjectDialog: (show: boolean) => void
  setIsExporting: (exporting: boolean) => void
  setExportProgress: (progress: number) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedLayerId: null,
  currentFrame: 0,
  isPlaying: false,
  zoom: 1,
  showNewProjectDialog: true, // show on startup
  isExporting: false,
  exportProgress: 0,

  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setZoom: (zoom) => set({ zoom }),
  setShowNewProjectDialog: (show) => set({ showNewProjectDialog: show }),
  setIsExporting: (exporting) => set({ isExporting: exporting }),
  setExportProgress: (progress) => set({ exportProgress: progress })
}))
