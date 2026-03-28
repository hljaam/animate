import { ipcMain, dialog, app } from 'electron'
import { mkdirSync } from 'fs'
import { join, basename } from 'path'
import { nanoid } from 'nanoid'
import { checkJavaAvailable, dumpSwf } from './ffdecService'
import { extractImages, extractShapes } from './ffdecAssetExtractor'
import { parseSwfDump } from './ffdecTimelineParser'

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
 * Import SWF by extracting assets and parsing timeline directly via JPEXS FFDec.
 */
async function importSwfViaFfdec(
  swfPath: string,
  projectName: string
): Promise<object | null> {
  // Create assets directory for this project
  const projectId = nanoid()
  const userDataPath = app.getPath('userData')
  const assetsDir = join(userDataPath, 'projects', projectId, '.project_assets')
  mkdirSync(assetsDir, { recursive: true })

  console.log('[SWF] Importing via FFDec:', swfPath)

  // Step 1: Extract assets (images + shapes) in parallel with dump
  const [images, shapes, xmlDump] = await Promise.all([
    extractImages(swfPath, assetsDir),
    extractShapes(swfPath, assetsDir),
    dumpSwf(swfPath)
  ])

  console.log(`[SWF] Extracted ${images.length} images, ${shapes.length} shapes`)

  // Step 2: Parse timeline from XML dump
  const { header, layers } = parseSwfDump(xmlDump, images, shapes)

  // Step 3: Convert shape layers into symbols
  const symbols: Array<{
    id: string
    name: string
    libraryItemName: string
    fps: number
    durationFrames: number
    layers: typeof layers
  }> = []

  const processedLayers = layers.map((layer) => {
    // Check if the layer is a shape by looking at its contentItems
    const shapeContent = layer.contentItems?.find((ci) => ci.content.type === 'shape')
    if (!shapeContent) return layer

    // Create a SymbolDef wrapping this shape
    const symbolId = nanoid()
    const symbolName = layer.name || 'Shape Symbol'
    // Inner shape layer sits at origin — the outer symbol layer handles positioning
    const innerTracks = layer.tracks.map((t: any) => {
      if (t.property === 'x' || t.property === 'y') {
        return { ...t, keyframes: t.keyframes.map((kf: any) => ({ ...kf, value: 0 })) }
      }
      if (t.property === 'scaleX' || t.property === 'scaleY') {
        return { ...t, keyframes: t.keyframes.map((kf: any) => ({ ...kf, value: 1 })) }
      }
      if (t.property === 'rotation') {
        return { ...t, keyframes: t.keyframes.map((kf: any) => ({ ...kf, value: 0 })) }
      }
      if (t.property === 'opacity') {
        return { ...t, keyframes: t.keyframes.map((kf: any) => ({ ...kf, value: 1 })) }
      }
      return t
    })

    const innerContentItemId = nanoid()
    symbols.push({
      id: symbolId,
      name: symbolName,
      libraryItemName: symbolName,
      fps: header.fps || 24,
      durationFrames: header.frameCount || 1,
      layers: [
        {
          ...layer,
          id: nanoid(),
          name: 'Shape',
          contentItems: [{ id: innerContentItemId, name: 'Shape', content: { type: 'shape', shapeData: shapeContent.content.shapeData } }],
          contentKeyframes: [{ frame: 0, contentItemId: innerContentItemId }],
          order: 0,
          startFrame: 0,
          endFrame: (header.frameCount || 1) - 1,
          tracks: innerTracks
        }
      ]
    })

    // Replace with a symbol layer instance
    const outerContentItemId = nanoid()
    return {
      id: layer.id,
      name: symbolName,
      contentItems: [{ id: outerContentItemId, name: symbolName, content: { type: 'symbol', symbolId } }],
      contentKeyframes: [{ frame: layer.startFrame, contentItemId: outerContentItemId }],
      visible: layer.visible,
      locked: layer.locked,
      order: layer.order,
      startFrame: layer.startFrame,
      endFrame: layer.endFrame,
      tracks: layer.tracks
    }
  })

  const project = {
    id: projectId,
    name: projectName,
    width: header.width || 550,
    height: header.height || 400,
    fps: header.fps || 24,
    durationFrames: header.frameCount || 1,
    backgroundColor: header.backgroundColor || '#FFFFFF',
    assets: images.map((img) => ({
      id: img.id,
      type: 'image' as const,
      name: img.name,
      localBundlePath: img.localBundlePath,
      width: img.width,
      height: img.height
    })),
    layers: processedLayers,
    symbols
  }

  console.log(
    `[SWF] Imported: ${project.width}x${project.height} @ ${project.fps}fps, ` +
      `${project.assets.length} assets, ${project.layers.length} layers`
  )

  return project
}
