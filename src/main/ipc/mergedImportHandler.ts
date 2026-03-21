import { ipcMain, dialog, app } from 'electron'
import { statSync } from 'fs'
import { join, basename } from 'path'
import AdmZip from 'adm-zip'
import {
  importFromSource,
  ZipFileSource,
  FolderFileSource,
  type FileSource,
  type FlaAsset,
  type FlaProject
} from './flaHandlers'
import { extractSwfBitmaps, type AssetInfo } from './swfHandlers'

export function registerMergedImportHandler(): void {
  ipcMain.handle('import-animate', async () => {
    // Dialog 1: Pick FLA file or XFL folder
    const flaResult = await dialog.showOpenDialog({
      title: 'Select FLA file or XFL folder',
      filters: [{ name: 'Adobe Animate (FLA)', extensions: ['fla'] }],
      properties: ['openFile', 'openDirectory']
    })
    if (flaResult.canceled || flaResult.filePaths.length === 0) return null
    const flaPath = flaResult.filePaths[0]

    // Dialog 2: Pick SWF file
    const swfResult = await dialog.showOpenDialog({
      title: 'Select matching SWF file',
      filters: [{ name: 'SWF Files', extensions: ['swf'] }],
      properties: ['openFile']
    })
    if (swfResult.canceled || swfResult.filePaths.length === 0) return null
    const swfPath = swfResult.filePaths[0]

    try {
      // Determine if FLA (zip) or XFL (folder)
      const stat = statSync(flaPath)
      let source: FileSource
      let projectName: string

      if (stat.isDirectory()) {
        source = new FolderFileSource(flaPath)
        projectName = basename(flaPath)
      } else {
        const zip = new AdmZip(flaPath)
        source = new ZipFileSource(zip)
        projectName = basename(flaPath, '.fla')
      }

      // Run XFL/FLA import for structure, layers, shapes, timeline
      const xflProject = await importFromSource(source, projectName)
      if (!xflProject) {
        console.error('[MergedImport] FLA/XFL import returned null')
        return null
      }

      // Extract bitmaps from SWF into the same assets directory
      const assetsDir = join(
        app.getPath('userData'),
        'projects',
        xflProject.id,
        '.project_assets'
      )
      const swfBitmaps = await extractSwfBitmaps(swfPath, assetsDir)

      // Match and replace XFL assets with SWF bitmaps
      const mergedAssets = matchAndReplaceBitmaps(xflProject.assets, swfBitmaps)

      return { ...xflProject, assets: mergedAssets }
    } catch (err) {
      console.error('[MergedImport] Import failed:', err)
      return null
    }
  })
}

function matchAndReplaceBitmaps(
  xflAssets: FlaAsset[],
  swfBitmaps: AssetInfo[]
): FlaAsset[] {
  // Track which SWF bitmaps have been consumed
  const usedSwfIds = new Set<string>()

  return xflAssets.map((xflAsset) => {
    // Find best matching SWF bitmap by dimensions.
    // Flash lossless bitmaps may have ±1 pixel difference due to scanline padding,
    // so allow a small tolerance. Prefer exact matches, then ±1 tolerance.
    let bestMatch: AssetInfo | null = null
    let bestDist = Infinity

    for (const swf of swfBitmaps) {
      if (usedSwfIds.has(swf.id)) continue
      const dw = Math.abs(swf.width - xflAsset.width)
      const dh = Math.abs(swf.height - xflAsset.height)
      if (dw > 2 || dh > 2) continue // skip if too different

      const dist = dw + dh
      if (dist < bestDist) {
        bestDist = dist
        bestMatch = swf
      }
    }

    if (bestMatch) {
      usedSwfIds.add(bestMatch.id)
      console.log(
        `[MergedImport] Matched "${xflAsset.name}" (${xflAsset.width}x${xflAsset.height}) → SWF "${bestMatch.name}" (${bestMatch.width}x${bestMatch.height})`
      )
      // Replace file path but keep XFL asset id + name (so layer refs stay valid)
      // Also update dimensions to match the actual SWF bitmap
      return {
        ...xflAsset,
        localBundlePath: bestMatch.localBundlePath,
        width: bestMatch.width,
        height: bestMatch.height
      }
    }

    console.warn(
      `[MergedImport] No SWF match for "${xflAsset.name}" (${xflAsset.width}x${xflAsset.height})`
    )
    return xflAsset
  })
}
