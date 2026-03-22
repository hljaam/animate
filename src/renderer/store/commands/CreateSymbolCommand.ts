import type { ICommand } from './Command'
import type { Layer, SymbolDef } from '../../types/project'
import { useProjectStore } from '../projectStore'
import { generateId } from '../../utils/idGenerator'

export class CreateSymbolCommand implements ICommand {
  description: string
  private symbolDef: SymbolDef
  private symbolLayer: Layer
  private originalLayers: Layer[]
  private layerIds: string[]

  constructor(layerIds: string[], symbolName?: string) {
    this.layerIds = layerIds
    const state = useProjectStore.getState()
    const project = state.project!

    // Snapshot the original layers
    this.originalLayers = project.layers.filter((l) => layerIds.includes(l.id)).map((l) => JSON.parse(JSON.stringify(l)))

    // Build symbol definition from those layers
    const symbolId = generateId()
    const name = symbolName || (this.originalLayers.length === 1 ? this.originalLayers[0].name : 'Symbol')
    this.symbolDef = {
      id: symbolId,
      name,
      libraryItemName: name,
      fps: project.fps,
      durationFrames: project.durationFrames,
      layers: this.originalLayers.map((l) => ({ ...l }))
    }

    // Build the replacement symbol layer (use first layer's position)
    const firstLayer = this.originalLayers[0]
    this.symbolLayer = {
      id: generateId(),
      name,
      type: 'symbol',
      symbolId,
      visible: true,
      locked: false,
      order: firstLayer.order,
      startFrame: firstLayer.startFrame,
      endFrame: firstLayer.endFrame,
      tracks: JSON.parse(JSON.stringify(firstLayer.tracks))
    }

    this.description = `Convert to symbol "${name}"`
  }

  execute(): void {
    const state = useProjectStore.getState()
    // Remove original layers
    for (const id of this.layerIds) {
      state.removeLayerDirect(id)
    }
    // Add symbol definition
    state.addSymbolDirect(this.symbolDef)
    // Add symbol layer
    state.addLayerDirect(this.symbolLayer)
  }

  undo(): void {
    const state = useProjectStore.getState()
    // Remove symbol layer
    state.removeLayerDirect(this.symbolLayer.id)
    // Remove symbol definition
    state.removeSymbolDirect(this.symbolDef.id)
    // Restore original layers
    for (const layer of this.originalLayers) {
      state.addLayerDirect(layer)
    }
  }
}
