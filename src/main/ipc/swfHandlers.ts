import { ipcMain, dialog, app } from 'electron'
import { mkdirSync } from 'fs'
import { join, basename } from 'path'
import { nanoid } from 'nanoid'
import { checkJavaAvailable, exportAssets } from './ffdecService'
import {
  importFromSource,
  FolderFileSource,
  type FlaAsset
} from './flaHandlers'

// ── Types ──────────────────────────────────────────────────────────────────

export interface AssetInfo {
  id: string
  name: string
  localBundlePath: string
  width: number
  height: number
}

// ── Registration ───────────────────────────────────────────────────────────

export function registerSwfHandlers(): void {
  ipcMain.handle('import-swf', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open SWF File',
      filters: [{ name: 'SWF Files', extensions: ['swf'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const swfPath = result.filePaths[0]

    // Check bundled Java availability
    const javaOk = await checkJavaAvailable()
    if (!javaOk) {
      await dialog.showMessageBox({
        type: 'error',
        title: 'Java Not Found',
        message: 'The bundled Java runtime was not found.',
        detail: 'Please ensure the bin/jre/ directory exists with a valid JRE.'
      })
      return null
    }

    try {
      return await importSwfViaFfdec(swfPath, basename(swfPath, '.swf'))
    } catch (err) {
      console.error('[SWF] Import failed:', err)
      await dialog.showMessageBox({
        type: 'error',
        title: 'SWF Import Failed',
        message: 'Failed to import SWF file.',
        detail: String(err)
      })
      return null
    }
  })
}

// ── Main Import ────────────────────────────────────────────────────────────

/**
 * Import SWF by converting it to XFL via JPEXS FFDec, then using
 * the existing FLA/XFL importer to parse it.
 *
 * This gives us full access to timeline, shapes, text, symbols —
 * all through JPEXS's accurate SWF decompilation — reusing the
 * existing import pipeline.
 */
async function importSwfViaFfdec(
  swfPath: string,
  projectName: string
): Promise<object | null> {
  // Create a temp directory for the XFL export
  const tempDir = join(
    app.getPath('temp'),
    'animate-swf-import-' + nanoid(8)
  )
  mkdirSync(tempDir, { recursive: true })

  console.log('[SWF] Exporting SWF → XFL via JPEXS:', swfPath)

  // Step 1: Export SWF to XFL format via JPEXS
  await exportAssets(swfPath, tempDir, 'xfl' as any)

  // Step 2: Find the XFL output folder (JPEXS creates a subfolder named after the SWF)
  const { readdirSync, statSync } = await import('fs')
  const entries = readdirSync(tempDir)
  let xflDir = tempDir
  for (const entry of entries) {
    const full = join(tempDir, entry)
    if (statSync(full).isDirectory()) {
      // Check if this directory contains DOMDocument.xml
      const domDoc = join(full, 'DOMDocument.xml')
      const { existsSync } = await import('fs')
      if (existsSync(domDoc)) {
        xflDir = full
        break
      }
    }
  }

  console.log('[SWF] XFL output directory:', xflDir)

  // Step 3: Use existing FLA/XFL importer to parse the XFL
  const source = new FolderFileSource(xflDir)
  const project = await importFromSource(source, projectName)

  if (!project) {
    console.error('[SWF] XFL import returned null')
    return null
  }

  console.log(
    `[SWF] Imported: ${project.width}x${project.height} @ ${project.fps}fps, ` +
      `${project.assets.length} assets, ${project.layers.length} layers`
  )

  return project
}

// ── Exported for merged import handler ─────────────────────────────────────

/**
 * Extract only bitmap assets from an SWF using JPEXS.
 * Used by mergedImportHandler to replace FLA bitmaps with SWF bitmaps.
 */
export async function extractSwfBitmaps(
  swfPath: string,
  assetsDir: string
): Promise<AssetInfo[]> {
  const javaOk = await checkJavaAvailable()
  if (!javaOk) {
    console.warn('[SWF] Java not available for bitmap extraction')
    return []
  }

  const { extractImages } = await import('./ffdecAssetExtractor')
  const images = await extractImages(swfPath, assetsDir)
  return images.map((img) => ({
    id: img.id,
    name: img.name,
    localBundlePath: img.localBundlePath,
    width: img.width,
    height: img.height
  }))
}
