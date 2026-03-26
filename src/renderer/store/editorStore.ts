import { create } from 'zustand'

export type ActiveTool = 'select' | 'hand'

interface EditorState {
  selectedLayerIds: string[]
  /** Convenience getter — first selected layer, or null */
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
  editingObjectId: string | null
  canvasContextMenu: { x: number; y: number; layerId: string | null } | null
  showCreateObjectDialog: { layerIds: string[] } | null
  showSaveToUnitDialog: { itemType: 'symbol' | 'shapeObject'; itemId: string } | null

  // Timeline features
  loopPlayback: boolean
  onionSkinEnabled: boolean
  onionSkinBefore: number
  onionSkinAfter: number
  timelineZoom: number
  selectedSpan: { layerId: string; startFrame: number; endFrame: number } | null
  layerRowHeight: 'short' | 'medium' | 'tall'

  setSelectedLayerIds: (ids: string[]) => void
  /** Select a single layer (or deselect all with null) */
  setSelectedLayerId: (id: string | null) => void
  /** Toggle a layer in/out of the selection (for Shift+click) */
  toggleLayerSelection: (id: string) => void
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
  setEditingObjectId: (id: string | null) => void
  setCanvasContextMenu: (menu: { x: number; y: number; layerId: string | null } | null) => void
  setShowCreateObjectDialog: (data: { layerIds: string[] } | null) => void
  setShowSaveToUnitDialog: (data: { itemType: 'symbol' | 'shapeObject'; itemId: string } | null) => void
  setLoopPlayback: (loop: boolean) => void
  setOnionSkinEnabled: (enabled: boolean) => void
  setOnionSkinBefore: (count: number) => void
  setOnionSkinAfter: (count: number) => void
  setTimelineZoom: (zoom: number) => void
  setSelectedSpan: (span: { layerId: string; startFrame: number; endFrame: number } | null) => void
  setLayerRowHeight: (height: 'short' | 'medium' | 'tall') => void
}

export const useEditorStore = create<EditorState>((set) => ({
  selectedLayerIds: [],
  get selectedLayerId(): string | null {
    // This is overridden by the computed value in setters below
    return null
  },
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
  editingObjectId: null,
  canvasContextMenu: null,
  showCreateObjectDialog: null,
  showSaveToUnitDialog: null,

  // Timeline features
  loopPlayback: true,
  onionSkinEnabled: false,
  onionSkinBefore: 2,
  onionSkinAfter: 2,
  timelineZoom: 1.0,
  selectedSpan: null,
  layerRowHeight: 'medium',

  setSelectedLayerIds: (ids) => set({ selectedLayerIds: ids, selectedLayerId: ids[0] ?? null }),
  setSelectedLayerId: (id) => set({ selectedLayerIds: id ? [id] : [], selectedLayerId: id }),
  toggleLayerSelection: (id) => set((state) => {
    const ids = state.selectedLayerIds.includes(id)
      ? state.selectedLayerIds.filter((i) => i !== id)
      : [...state.selectedLayerIds, id]
    return { selectedLayerIds: ids, selectedLayerId: ids[0] ?? null }
  }),
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
  setEditingSymbolId: (id) => set({ editingSymbolId: id, selectedLayerIds: [], selectedLayerId: null }),
  setEditingObjectId: (id) => set({ editingObjectId: id, selectedLayerIds: [], selectedLayerId: null }),
  setCanvasContextMenu: (menu) => set({ canvasContextMenu: menu }),
  setShowCreateObjectDialog: (data) => set({ showCreateObjectDialog: data }),
  setShowSaveToUnitDialog: (data) => set({ showSaveToUnitDialog: data }),
  setLoopPlayback: (loop) => set({ loopPlayback: loop }),
  setOnionSkinEnabled: (enabled) => set({ onionSkinEnabled: enabled }),
  setOnionSkinBefore: (count) => set({ onionSkinBefore: count }),
  setOnionSkinAfter: (count) => set({ onionSkinAfter: count }),
  setTimelineZoom: (zoom) => set({ timelineZoom: Math.max(0.5, Math.min(4.0, zoom)) }),
  setSelectedSpan: (span) => set({ selectedSpan: span }),
  setLayerRowHeight: (height) => set({ layerRowHeight: height })
}))
