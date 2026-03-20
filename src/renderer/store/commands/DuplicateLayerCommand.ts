import type { ICommand } from './Command'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../projectStore'
import { generateId } from '../../utils/idGenerator'

export class DuplicateLayerCommand implements ICommand {
  description: string
  private clone: Layer

  constructor(sourceLayer: Layer) {
    this.clone = {
      ...JSON.parse(JSON.stringify(sourceLayer)),
      id: generateId(),
      name: `${sourceLayer.name} copy`,
      order: sourceLayer.order + 1
    }
    this.description = `Duplicate layer "${sourceLayer.name}"`
  }

  execute(): void {
    useProjectStore.getState().addLayerDirect(this.clone)
  }

  undo(): void {
    useProjectStore.getState().removeLayerDirect(this.clone.id)
  }
}
