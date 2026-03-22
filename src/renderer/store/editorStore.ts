import { create } from 'zustand'

export type ActiveTool = 'select' | 'hand'

interface EditorState {
  selectedLayerId: string | null
  currentFrame: number
  isPlaying: boolean
  activeTool: ActiveTool
  zoom: number
  panX: number
  panY: number
  fitZoom: number
  showNewProjectDialog: boolean
  isExporting: boolean
  exportProgress: number
  showCommandConsole: boolean
  editingSymbolId: string | null

  setSelectedLayerId: (id: string | null) => void
  setCurrentFrame: (frame: number) => void
  setIsPlaying: (playing: boolean) => void
  setActiveTool: (tool: ActiveTool) => void
  setZoom: (zoom: number) => void
  setViewport: (zoom: number, panX: number, panY: number) => void
  setFitZoom: (zoom: number) => void
  setShowNewProjectDialog: (show: boolean) => void
  setIsExporting: (exporting: boolean) => void
  setExportProgress: (progress: number) => void
  setShowCommandConsole: (show: boolean) => void
  setEditingSymbolId: (id: string | null) => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedLayerId: null,
  currentFrame: 0,
  isPlaying: false,
  activeTool: 'select',
  zoom: 0,
  panX: 0,
  panY: 0,
  fitZoom: 0,
  showNewProjectDialog: true, // show on startup
  isExporting: false,
  exportProgress: 0,
  showCommandConsole: false,
  editingSymbolId: null,

  setSelectedLayerId: (id) => set({ selectedLayerId: id }),
  setCurrentFrame: (frame) => set({ currentFrame: frame }),
  setIsPlaying: (playing) => set({ isPlaying: playing }),
  setActiveTool: (activeTool) => set({ activeTool }),
  setZoom: (zoom) => set({ zoom }),
  setViewport: (zoom, panX, panY) => set({ zoom, panX, panY }),
  setFitZoom: (fitZoom) => set({ fitZoom }),
  setShowNewProjectDialog: (show) => set({ showNewProjectDialog: show }),
  setIsExporting: (exporting) => set({ isExporting: exporting }),
  setExportProgress: (progress) => set({ exportProgress: progress }),
  setShowCommandConsole: (show) => set({ showCommandConsole: show }),
  setEditingSymbolId: (id) => set({ editingSymbolId: id, selectedLayerId: null })
}))
