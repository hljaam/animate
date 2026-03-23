import { create } from 'zustand'
import { produce, produceWithPatches, enablePatches } from 'immer'
import type { Project, Layer, Asset, PropertyTrack, TrackProperty, EasingType, Keyframe, SymbolDef } from '../types/project'
import { CommandHistory } from './commands/Command'

enablePatches()

interface ProjectState {
  project: Project | null
  history: CommandHistory
  historyVersion: number

  // Project-level
  setProject: (project: Project) => void
  updateProjectSettings: (settings: Partial<Pick<Project, 'name' | 'width' | 'height' | 'fps' | 'durationFrames' | 'backgroundColor'>>) => void

  // Assets
  addAsset: (asset: Asset) => void

  // Undoable action — wraps any project mutation with Immer patches
  applyAction: (description: string, mutator: (draft: Project) => void) => void

  // Non-undoable direct mutation (for live drag, etc.)
  mutateProject: (mutator: (draft: Project) => void) => void

  // Convenience: updateLayer without undo (for live UI changes like name, visibility, lock)
  updateLayer: (layerId: string, changes: Partial<Layer>) => void

  // Computed helpers
  getLayer: (layerId: string) => Layer | undefined
}

const _history = new CommandHistory()

export const useProjectStore = create<ProjectState>((set, get) => {
  _history.setOnChanged(() => {
    set({ historyVersion: _history.version })
  })

  _history.setProjectAccessors(
    () => get().project,
    (project) => set({ project })
  )

  return {
  project: null,
  history: _history,
  historyVersion: 0,

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

  applyAction: (description, mutator) => {
    const project = get().project
    if (!project) return
    const [nextState, patches, inversePatches] = produceWithPatches(project, mutator)
    if (patches.length === 0) return // no-op
    set({ project: nextState })
    _history.pushPatches(description, patches, inversePatches)
  },

  mutateProject: (mutator) => {
    const project = get().project
    if (!project) return
    const next = produce(project, mutator)
    set({ project: next })
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

  getLayer: (layerId) => {
    return get().project?.layers.find((l) => l.id === layerId)
  }
}})
