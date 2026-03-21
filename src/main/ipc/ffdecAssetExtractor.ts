import { mkdirSync, readdirSync, copyFileSync, statSync } from 'fs'
import { join, extname, basename } from 'path'
import { nanoid } from 'nanoid'
import imageSize from 'image-size'
import { exportAssets } from './ffdecService'
import { parseSvgFile } from './svgToShapeData'

// ── Types ──────────────────────────────────────────────────────────────────

export interface ImageAssetInfo {
  id: string
  characterId: number
  name: string
  localBundlePath: string
  width: number
  height: number
}

export interface ShapeAssetInfo {
  characterId: number
  shapeData: {
    paths: Array<{
      fillColor?: string
      strokeColor?: string
      strokeWidth?: number
      points: Array<{ x: number; y: number }>
    }>
    originX: number
    originY: number
  }
}

export interface SoundAssetInfo {
  id: string
  name: string
  localBundlePath: string
  format: string
}

export interface FontAssetInfo {
  id: string
  name: string
  localBundlePath: string
  fontFamily: string
}

// ── Image Extraction ──────────────────────────────────────────────────────

export async function extractImages(
  swfPath: string,
  assetsDir: string
): Promise<ImageAssetInfo[]> {
  const tempDir = join(assetsDir, '_ffdec_images')
  mkdirSync(tempDir, { recursive: true })

  try {
    await exportAssets(swfPath, tempDir, 'image')
  } catch (err) {
    console.error('[FFDEC] Image export failed:', err)
    return []
  }

  const results: ImageAssetInfo[] = []
  scanDirectory(tempDir, (filePath) => {
    const ext = extname(filePath).toLowerCase()
    if (!['.png', '.jpg', '.jpeg', '.gif', '.bmp'].includes(ext)) return

    const assetId = nanoid()
    const destPath = join(assetsDir, assetId + ext)
    copyFileSync(filePath, destPath)

    // Extract character ID from filename (JPEXS uses format: "1.png", "2.png")
    const charId = parseCharacterIdFromFilename(basename(filePath))

    let width = 1,
      height = 1
    try {
      const dims = imageSize(destPath)
      width = dims.width || 1
      height = dims.height || 1
    } catch {
      // fallback
    }

    results.push({
      id: assetId,
      characterId: charId,
      name: basename(filePath, ext),
      localBundlePath: destPath,
      width,
      height
    })
  })

  return results
}

// ── Shape Extraction ──────────────────────────────────────────────────────

export async function extractShapes(
  swfPath: string,
  assetsDir: string
): Promise<ShapeAssetInfo[]> {
  const tempDir = join(assetsDir, '_ffdec_shapes')
  mkdirSync(tempDir, { recursive: true })

  try {
    await exportAssets(swfPath, tempDir, 'shape')
  } catch (err) {
    console.error('[FFDEC] Shape export failed:', err)
    return []
  }

  const results: ShapeAssetInfo[] = []
  scanDirectory(tempDir, (filePath) => {
    if (extname(filePath).toLowerCase() !== '.svg') return

    const charId = parseCharacterIdFromFilename(basename(filePath))
    const shapeData = parseSvgFile(filePath)
    if (!shapeData) return

    results.push({ characterId: charId, shapeData })
  })

  return results
}

// ── Sound Extraction ──────────────────────────────────────────────────────

export async function extractSounds(
  swfPath: string,
  assetsDir: string
): Promise<SoundAssetInfo[]> {
  const tempDir = join(assetsDir, '_ffdec_sounds')
  mkdirSync(tempDir, { recursive: true })

  try {
    await exportAssets(swfPath, tempDir, 'sound')
  } catch (err) {
    console.error('[FFDEC] Sound export failed:', err)
    return []
  }

  const results: SoundAssetInfo[] = []
  scanDirectory(tempDir, (filePath) => {
    const ext = extname(filePath).toLowerCase()
    if (!['.mp3', '.wav', '.flac', '.ogg'].includes(ext)) return

    const assetId = nanoid()
    const destPath = join(assetsDir, assetId + ext)
    copyFileSync(filePath, destPath)

    results.push({
      id: assetId,
      name: basename(filePath, ext),
      localBundlePath: destPath,
      format: ext.slice(1)
    })
  })

  return results
}

// ── Font Extraction ───────────────────────────────────────────────────────

export async function extractFonts(
  swfPath: string,
  assetsDir: string
): Promise<FontAssetInfo[]> {
  const tempDir = join(assetsDir, '_ffdec_fonts')
  mkdirSync(tempDir, { recursive: true })

  try {
    await exportAssets(swfPath, tempDir, 'font')
  } catch (err) {
    console.error('[FFDEC] Font export failed:', err)
    return []
  }

  const results: FontAssetInfo[] = []
  scanDirectory(tempDir, (filePath) => {
    const ext = extname(filePath).toLowerCase()
    if (!['.ttf', '.woff', '.woff2', '.otf'].includes(ext)) return

    const assetId = nanoid()
    const destPath = join(assetsDir, assetId + ext)
    copyFileSync(filePath, destPath)

    results.push({
      id: assetId,
      name: basename(filePath, ext),
      localBundlePath: destPath,
      fontFamily: basename(filePath, ext)
    })
  })

  return results
}

// ── Helpers ───────────────────────────────────────────────────────────────

/**
 * Recursively scan a directory and call callback for each file.
 */
function scanDirectory(dir: string, callback: (filePath: string) => void): void {
  try {
    const entries = readdirSync(dir)
    for (const entry of entries) {
      const full = join(dir, entry)
      try {
        const st = statSync(full)
        if (st.isDirectory()) {
          scanDirectory(full, callback)
        } else if (st.isFile()) {
          callback(full)
        }
      } catch {
        // skip inaccessible entries
      }
    }
  } catch {
    // directory doesn't exist or not readable
  }
}

/**
 * JPEXS exports files with names like "1.png", "2.png" or "1_characterName.png".
 * Extract the leading number as the SWF character ID.
 */
function parseCharacterIdFromFilename(filename: string): number {
  const match = filename.match(/^(\d+)/)
  return match ? parseInt(match[1], 10) : -1
}
