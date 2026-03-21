import { registerAssetHandlers } from './assetHandlers'
import { registerProjectHandlers } from './projectHandlers'
import { registerExportHandlers } from './exportHandlers'
import { registerFlaHandlers } from './flaHandlers'
import { registerSwfHandlers } from './swfHandlers'
import { registerMergedImportHandler } from './mergedImportHandler'

export function registerAllHandlers(): void {
  registerAssetHandlers()
  registerProjectHandlers()
  registerExportHandlers()
  registerFlaHandlers()
  registerSwfHandlers()
  registerMergedImportHandler()
}
