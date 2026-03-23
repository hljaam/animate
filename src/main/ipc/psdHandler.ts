import { ipcMain, dialog, app } from 'electron'
import { readFileSync, writeFileSync, mkdirSync } from 'fs'
import { join, basename } from 'path'
import { nanoid } from 'nanoid'
import PsdModule from '@webtoon/psd'
import type { Node as PsdNode } from '@webtoon/psd'

// Handle ESM/CJS interop — default export may be nested
const Psd = (PsdModule as any).default ?? PsdModule
import { PNG } from 'pngjs'

/**
 * Build a map from garbled layer name → correct GBK-decoded name.
 * @webtoon/psd decodes pascal-string layer names as UTF-8 which corrupts
 * CJK characters stored in system codepage (GBK/GB2312). This function
 * finds pascal-string layer names in the raw PSD bytes, decodes them both
 * as (broken) UTF-8 and (correct) GBK, then returns a mapping to fix names.
 */
function buildGbkNameMap(buf: Buffer): Map<string, string> {
  const gbkDecoder = new TextDecoder('gbk')
  const map = new Map<string, string>()
  const BNIM = [0x38, 0x42, 0x49, 0x4d] // '8BIM'

  for (let i = 4; i < buf.length - 4; i++) {
    if (buf[i] !== BNIM[0] || buf[i + 1] !== BNIM[1] || buf[i + 2] !== BNIM[2] || buf[i + 3] !== BNIM[3]) continue
    for (let back = 4; back <= 24; back++) {
      const pos = i - back
      if (pos < 0) break
      const strLen = buf[pos]
      if (strLen === 0 || strLen > 30) continue
      const padded = strLen + 1 + ((4 - (strLen + 1) % 4) % 4)
      if (padded !== back) continue
      const raw = buf.slice(pos + 1, pos + 1 + strLen)
      if (raw[0] === 0x3c) break // skip PSD markers like "</Layer group>"
      // Decode as UTF-8 (what the library does — produces garbled text for CJK)
      const garbled = new TextDecoder('utf-8').decode(raw)
      // Decode as GBK (correct for Chinese Photoshop)
      const correct = gbkDecoder.decode(raw)
      if (garbled !== correct) {
        map.set(garbled, correct)
      }
      break
    }
  }
  return map
}

interface AssetResult {
  id: string
  type: 'image'
  name: string
  localBundlePath: string
  width: number
  height: number
}

interface LayerResult {
  id: string
  name: string
  type: 'image'
  assetId: string
  visible: boolean
  locked: boolean
  order: number
  startFrame: number
  endFrame: number
  tracks: Array<{
    property: string
    keyframes: Array<{ frame: number; value: number; easing: string }>
  }>
}

export function registerPsdHandlers(): void {
  ipcMain.handle('import-psd', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open PSD File',
      filters: [{ name: 'Photoshop Files', extensions: ['psd'] }],
      properties: ['openFile']
    })
    if (result.canceled || result.filePaths.length === 0) return null

    const psdPath = result.filePaths[0]

    try {
      return await importPsd(psdPath, basename(psdPath, '.psd'))
    } catch (err) {
      console.error('[PSD] Import failed:', err)
      await dialog.showMessageBox({
        type: 'error',
        title: 'PSD Import Failed',
        message: 'Failed to import PSD file.',
        detail: String(err)
      })
      return null
    }
  })
}

async function importPsd(psdPath: string, projectName: string): Promise<object> {
  const projectId = nanoid()
  const userDataPath = app.getPath('userData')
  const assetsDir = join(userDataPath, 'projects', projectId, '.project_assets')
  mkdirSync(assetsDir, { recursive: true })

  console.log('[PSD] Importing:', psdPath)

  const buffer = readFileSync(psdPath)
  // @webtoon/psd expects ArrayBuffer
  const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength)
  const psd = Psd.parse(arrayBuffer)

  // Build garbled→correct name map for CJK layer names
  const nameMap = buildGbkNameMap(buffer)

  const canvasWidth = psd.width
  const canvasHeight = psd.height

  const assets: AssetResult[] = []
  const layers: LayerResult[] = []
  let order = 0

  function fixName(name: string): string {
    return nameMap.get(name) ?? name
  }

  async function processNode(node: PsdNode, parentVisible: boolean): Promise<void> {
    if (node.type === 'Group') {
      const group = node as PsdNode & { children: PsdNode[] }
      // Groups don't have isHidden — use opacity as visibility proxy
      for (let i = group.children.length - 1; i >= 0; i--) {
        await processNode(group.children[i], parentVisible)
      }
      return
    }

    if (node.type !== 'Layer') return
    const layer = node as PsdNode & {
      width: number; height: number; left: number; top: number
      isHidden: boolean; composite: () => Promise<Uint8ClampedArray>
    }

    // Composite the layer to get pixel data
    let pixelData: Uint8ClampedArray
    try {
      pixelData = await layer.composite()
    } catch {
      console.warn(`[PSD] Skipping layer "${fixName(layer.name)}" — no pixel data`)
      return
    }

    const w = layer.width
    const h = layer.height
    if (w === 0 || h === 0) return

    const layerName = fixName(layer.name) || `Layer ${order + 1}`
    const assetId = nanoid()
    const pngPath = join(assetsDir, `${assetId}.png`)

    // Encode RGBA pixel data to PNG
    const png = new PNG({ width: w, height: h })
    png.data = Buffer.from(pixelData)
    const pngBuffer = PNG.sync.write(png)
    writeFileSync(pngPath, pngBuffer)

    assets.push({
      id: assetId,
      type: 'image',
      name: layerName,
      localBundlePath: pngPath,
      width: w,
      height: h
    })

    // PSD layer position: top-left is (layer.left, layer.top)
    // App positions layers by center
    const centerX = layer.left + w / 2
    const centerY = layer.top + h / 2
    const layerOpacity = (layer.opacity ?? 255) / 255
    const visible = !layer.isHidden && parentVisible

    layers.push({
      id: nanoid(),
      name: layerName,
      type: 'image',
      assetId,
      visible,
      locked: false,
      order: order++,
      startFrame: 0,
      endFrame: 0,
      tracks: [
        { property: 'x', keyframes: [{ frame: 0, value: centerX, easing: 'linear' }] },
        { property: 'y', keyframes: [{ frame: 0, value: centerY, easing: 'linear' }] },
        { property: 'scaleX', keyframes: [{ frame: 0, value: 1, easing: 'linear' }] },
        { property: 'scaleY', keyframes: [{ frame: 0, value: 1, easing: 'linear' }] },
        { property: 'rotation', keyframes: [{ frame: 0, value: 0, easing: 'linear' }] },
        { property: 'opacity', keyframes: [{ frame: 0, value: visible ? layerOpacity : 0, easing: 'linear' }] }
      ]
    })
  }

  // Process top-level children
  for (let i = psd.children.length - 1; i >= 0; i--) {
    await processNode(psd.children[i], true)
  }

  const project = {
    id: projectId,
    name: projectName,
    width: canvasWidth,
    height: canvasHeight,
    fps: 24,
    durationFrames: 1,
    backgroundColor: '#FFFFFF',
    assets,
    layers
  }

  console.log(
    `[PSD] Imported: ${canvasWidth}x${canvasHeight}, ` +
      `${assets.length} layers exported as assets`
  )

  return project
}
