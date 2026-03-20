import type { ICommand } from './Command'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../projectStore'

export class UpdateLayerCommand<K extends keyof Layer> implements ICommand {
  description: string
  private layerId: string
  private key: K
  private before: Layer[K]
  private after: Layer[K]

  constructor(layerId: string, key: K, before: Layer[K], after: Layer[K]) {
    this.layerId = layerId
    this.key = key
    this.before = before
    this.after = after
    this.description = `Update layer ${String(key)}`
  }

  execute(): void {
    useProjectStore.getState().updateLayer(this.layerId, { [this.key]: this.after } as Partial<Layer>)
  }

  undo(): void {
    useProjectStore.getState().updateLayer(this.layerId, { [this.key]: this.before } as Partial<Layer>)
  }
}
