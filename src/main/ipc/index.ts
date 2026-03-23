import { registerAssetHandlers } from './assetHandlers'
import { registerProjectHandlers } from './projectHandlers'
import { registerExportHandlers } from './exportHandlers'
import { registerSwfHandlers } from './swfHandlers'
import { registerPsdHandlers } from './psdHandler'

export function registerAllHandlers(): void {
  registerAssetHandlers()
  registerProjectHandlers()
  registerExportHandlers()
  registerSwfHandlers()
  registerPsdHandlers()
}
