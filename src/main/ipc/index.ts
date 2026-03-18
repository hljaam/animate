import { registerAssetHandlers } from './assetHandlers'
import { registerProjectHandlers } from './projectHandlers'
import { registerExportHandlers } from './exportHandlers'

export function registerAllHandlers(): void {
  registerAssetHandlers()
  registerProjectHandlers()
  registerExportHandlers()
}
