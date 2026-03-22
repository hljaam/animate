import { create } from 'zustand'
import type { Project, Layer, Asset, PropertyTrack, TrackProperty, EasingType, Keyframe, SymbolDef } from '../types/project'
import { CommandHistory } from './commands/Command'

interface ProjectState {
  project: Project | null
  history: CommandHistory

  // Project-level
  setProject: (project: Project) => void
  updateProjectSettings: (settings: Partial<Pick<Project, 'name' | 'width' | 'height' | 'fps' | 'durationFrames' | 'backgroundColor'>>) => void

  // Assets
  addAsset: (asset: Asset) => void

  // Layer operations (direct - called by commands)
  addLayerDirect: (layer: Layer) => void
  removeLayerDirect: (layerId: string) => void
  updateLayer: (layerId: string, changes: Partial<Layer>) => void

  // Keyframe operations (direct - called by commands)
  setKeyframeDirect: (layerId: string, property: TrackProperty, frame: number, value: number, easing: EasingType) => void
  removeKeyframeDirect: (layerId: string, property: TrackProperty, frame: number) => void

  // Symbol operations (direct - called by commands)
  addSymbolDirect: (symbol: SymbolDef) => void
  removeSymbolDirect: (symbolId: string) => void

  // Computed helpers
  getLayer: (layerId: string) => Layer | undefined
}

export const useProjectStore = create<ProjectState>((set, get) => ({
  project: null,
  history: new CommandHistory(),

  setProject: (project) => {
    get().history.clear()
    set({ project })
  },

  updateProjectSettings: (settings) => {
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, ...settings } }
    })
  },

  addAsset: (asset) => {
    set((state) => {
      if (!state.project) return state
      return { project: { ...state.project, assets: [...state.project.assets, asset] } }
    })
  },

  addLayerDirect: (layer) => {
    set((state) => {
      if (!state.project) return state
      const layers = [...state.project.layers, layer].sort((a, b) => a.order - b.order)
      return { project: { ...state.project, layers } }
    })
  },

  removeLayerDirect: (layerId) => {
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          layers: state.project.layers.filter((l) => l.id !== layerId)
        }
      }
    })
  },

  updateLayer: (layerId, changes) => {
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          layers: state.project.layers.map((l) => (l.id === layerId ? { ...l, ...changes } : l))
        }
      }
    })
  },

  setKeyframeDirect: (layerId, property, frame, value, easing) => {
    set((state) => {
      if (!state.project) return state
      const layers = state.project.layers.map((layer) => {
        if (layer.id !== layerId) return layer

        let tracks = layer.tracks
        const trackIndex = tracks.findIndex((t) => t.property === property)

        if (trackIndex === -1) {
          // Create new track
          const newTrack: PropertyTrack = {
            property,
            keyframes: [{ frame, value, easing }]
          }
          tracks = [...tracks, newTrack]
        } else {
          // Update or insert keyframe in existing track
          const track = tracks[trackIndex]
          const kfIndex = track.keyframes.findIndex((kf) => kf.frame === frame)
          let keyframes: Keyframe[]

          if (kfIndex === -1) {
            keyframes = [...track.keyframes, { frame, value, easing }].sort((a, b) => a.frame - b.frame)
          } else {
            keyframes = track.keyframes.map((kf, i) =>
              i === kfIndex ? { frame, value, easing } : kf
            )
          }

          tracks = tracks.map((t, i) => (i === trackIndex ? { ...t, keyframes } : t))
        }

        return { ...layer, tracks }
      })

      return { project: { ...state.project, layers } }
    })
  },

  removeKeyframeDirect: (layerId, property, frame) => {
    set((state) => {
      if (!state.project) return state
      const layers = state.project.layers.map((layer) => {
        if (layer.id !== layerId) return layer
        const tracks = layer.tracks.map((track) => {
          if (track.property !== property) return track
          return { ...track, keyframes: track.keyframes.filter((kf) => kf.frame !== frame) }
        })
        return { ...layer, tracks }
      })
      return { project: { ...state.project, layers } }
    })
  },

  addSymbolDirect: (symbol) => {
    set((state) => {
      if (!state.project) return state
      const symbols = [...(state.project.symbols || []), symbol]
      return { project: { ...state.project, symbols } }
    })
  },

  removeSymbolDirect: (symbolId) => {
    set((state) => {
      if (!state.project) return state
      return {
        project: {
          ...state.project,
          symbols: (state.project.symbols || []).filter((s) => s.id !== symbolId)
        }
      }
    })
  },

  getLayer: (layerId) => {
    return get().project?.layers.find((l) => l.id === layerId)
  }
}))
