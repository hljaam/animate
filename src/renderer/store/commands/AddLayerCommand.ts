import type { ICommand } from './Command'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../projectStore'

export class AddLayerCommand implements ICommand {
  description: string
  private layer: Layer

  constructor(layer: Layer) {
    this.layer = layer
    this.description = `Add layer "${layer.name}"`
  }

  execute(): void {
    useProjectStore.getState().addLayerDirect(this.layer)
  }

  undo(): void {
    useProjectStore.getState().removeLayerDirect(this.layer.id)
  }
}
