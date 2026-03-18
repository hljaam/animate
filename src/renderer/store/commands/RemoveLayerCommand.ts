import type { ICommand } from './Command'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../projectStore'

export class RemoveLayerCommand implements ICommand {
  description: string
  private layer: Layer

  constructor(layer: Layer) {
    this.layer = layer
    this.description = `Remove layer "${layer.name}"`
  }

  execute(): void {
    useProjectStore.getState().removeLayerDirect(this.layer.id)
  }

  undo(): void {
    useProjectStore.getState().addLayerDirect(this.layer)
  }
}
