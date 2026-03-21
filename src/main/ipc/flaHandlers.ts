import { ipcMain, dialog, app } from 'electron'
import { mkdirSync, writeFileSync, readFileSync } from 'fs'
import { join, basename } from 'path'
import AdmZip from 'adm-zip'
import { nanoid } from 'nanoid'
import { PNG } from 'pngjs'
import { createInflate, createInflateRaw } from 'zlib'
import { parseShape } from './flashShapeRasterizer'

export interface FileSource {
  readText(path: string): string | null
  readBinary(path: string): Buffer | null
}

export class ZipFileSource implements FileSource {
  constructor(private zip: AdmZip) {}
  readText(path: string): string | null {
    try { return this.zip.readAsText(path) } catch { return null }
  }
  readBinary(path: string): Buffer | null {
    try { return this.zip.readFile(path) ?? null } catch { return null }
  }
}

export class FolderFileSource implements FileSource {
  constructor(private root: string) {}
  readText(path: string): string | null {
    try { return readFileSync(join(this.root, path), 'utf-8') } catch { return null }
  }
  readBinary(path: string): Buffer | null {
    try { return readFileSync(join(this.root, path)) } catch { return null }
  }
}

export interface FlaAsset {
  id: string
  type: 'image'
  name: string
  localBundlePath: string
  width: number
  height: number
}

interface FlaShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  bitmapFillAssetId?: string
  points: Array<{ x: number; y: number }>
  subPaths?: Array<Array<{ x: number; y: number }>>
}

interface FlaShapeData {
  paths: FlaShapePath[]
  originX: number
  originY: number
}

interface FlaLayer {
  id: string
  name: string
  type: 'image' | 'shape'
  assetId?: string
  shapeData?: FlaShapeData
  visible: boolean
  locked: boolean
  order: number
  startFrame: number
  endFrame: number
  tracks: FlaTrack[]
}

interface FlaTrack {
  property: string
  keyframes: FlaKeyframe[]
}

interface FlaKeyframe {
  frame: number
  value: number
  easing: string
}

export interface FlaProject {
  id: string
  name: string
  width: number
  height: number
  fps: number
  durationFrames: number
  backgroundColor: string
  assets: FlaAsset[]
  layers: FlaLayer[]
}

interface ElementPlacement {
  frameIndex: number
  duration: number
  assetRef: string | null // bitmap name or symbol libraryItemName
  isSymbol: boolean
  tx: number
  ty: number
  a: number
  b: number
  c: number
  d: number
  tweenType: string | null
}

function makeTrack(property: string, value: number): FlaTrack {
  return { property, keyframes: [{ frame: 0, value, easing: 'linear' }] }
}

/**
 * Convert a ParsedShape into FlaShapePath entries, including fills and strokes.
 * bitmapAssetMap is used to resolve BitmapFill references to asset IDs.
 */
function parsedShapeToFlaShapePaths(
  parsed: ReturnType<typeof parseShape>,
  bitmapAssetMap?: Map<string, FlaAsset>
): FlaShapePath[] {
  const shapePaths: FlaShapePath[] = []
  const fillMap = new Map<number, ReturnType<typeof parseShape>['fills'][0]>()
  for (const f of parsed.fills) fillMap.set(f.index, f)
  const strokeMap = new Map<number, { color: { r: number; g: number; b: number; a: number }; weight: number }>()
  for (const s of parsed.strokes) strokeMap.set(s.index, { color: s.color, weight: s.weight })

  const toHex = (c: { r: number; g: number; b: number }) =>
    '#' + c.r.toString(16).padStart(2, '0') + c.g.toString(16).padStart(2, '0') + c.b.toString(16).padStart(2, '0')

  // Group fill contours by fillIndex so multiple contours for the same fill
  // are combined into one path with subPaths (enables even-odd hole rendering).
  const fillContours = new Map<number, Array<Array<{ x: number; y: number }>>>()

  for (const path of parsed.paths) {
    if (path.points.length < 2) continue

    const fillDef = fillMap.get(path.fillIndex)
    const stroke = path.strokeIndex !== undefined ? strokeMap.get(path.strokeIndex) : undefined

    // Add fill contour to its group
    if (fillDef && path.points.length >= 3) {
      const contours = fillContours.get(path.fillIndex)
      if (contours) {
        contours.push(path.points.map(p => ({ x: p.x, y: p.y })))
      } else {
        fillContours.set(path.fillIndex, [path.points.map(p => ({ x: p.x, y: p.y }))])
      }
    }

    // Strokes are emitted individually (not grouped).
    // A stroke must be emitted even when the edge also has a fill — in Flash,
    // filled shapes often have visible outlines (e.g. a rectangle with a border).
    if (stroke) {
      shapePaths.push({
        points: path.points.map(p => ({ x: p.x, y: p.y })),
        strokeColor: toHex(stroke.color),
        strokeWidth: stroke.weight
      })
    }
  }

  // Emit grouped fill paths — single contour stays as-is, multiple contours
  // use subPaths for even-odd rendering (ring/donut holes).
  for (const [fillIndex, contours] of fillContours) {
    const fillDef = fillMap.get(fillIndex)!
    const entry: FlaShapePath = {
      points: contours[0]
    }

    if (fillDef.bitmapPath && bitmapAssetMap) {
      const asset = bitmapAssetMap.get(fillDef.bitmapPath)
      if (asset) {
        entry.bitmapFillAssetId = asset.id
      } else {
        entry.fillColor = toHex(fillDef.color)
      }
    } else {
      entry.fillColor = toHex(fillDef.color)
    }

    if (contours.length > 1) {
      entry.subPaths = contours.slice(1)
    }

    shapePaths.push(entry)
  }

  return shapePaths
}

/**
 * Recursively extract all DOMShape XML strings from content,
 * traversing into DOMGroup/members nesting.
 * Note: DOMGroup transforms are already baked into the edge coordinates
 * in FLA files, so we do NOT apply them here.
 */
function extractAllShapeXml(xml: string): string[] {
  const shapes: string[] = []

  // Match DOMShape and DOMGroup in document order to preserve stacking
  const elementPattern = /<(DOMShape|DOMGroup)\b[^>]*>[\s\S]*?<\/\1>/g
  let m: RegExpExecArray | null
  while ((m = elementPattern.exec(xml)) !== null) {
    if (m[1] === 'DOMShape') {
      shapes.push(m[0])
    } else {
      // DOMGroup — recurse into members
      const membersMatch = m[0].match(/<members>([\s\S]*?)<\/members>/)
      if (membersMatch) {
        shapes.push(...extractAllShapeXml(membersMatch[1]))
      }
    }
  }

  return shapes
}

function getAttr(element: string, name: string): string | undefined {
  const re = new RegExp(`${name}="([^"]*)"`)
  const m = element.match(re)
  return m ? m[1] : undefined
}

function getFloatAttr(element: string, name: string, fallback: number): number {
  const v = getAttr(element, name)
  return v !== undefined ? parseFloat(v) : fallback
}

function getIntAttr(element: string, name: string, fallback: number): number {
  const v = getAttr(element, name)
  return v !== undefined ? parseInt(v, 10) : fallback
}

/**
 * Extract bitmap data from an FLA .dat file.
 * JPEG bitmaps start with FF D8.
 * Lossless bitmaps: [4 bytes] [u16LE width] [u16LE height] [20 bytes] [zlib ARGB data at offset 28]
 */
async function extractBitmap(
  datBuffer: Buffer,
  bitmapItem: { name: string; isJPEG: boolean; frameRight: number; frameBottom: number },
  destPath: string
): Promise<{ width: number; height: number } | null> {
  // JPEG: data starts with FF D8
  if (datBuffer[0] === 0xff && datBuffer[1] === 0xd8) {
    writeFileSync(destPath, datBuffer)
    return {
      width: Math.round(bitmapItem.frameRight / 20),
      height: Math.round(bitmapItem.frameBottom / 20)
    }
  }

  // Lossless bitmap
  const width = datBuffer.readUInt16LE(4)
  const height = datBuffer.readUInt16LE(6)
  if (width <= 0 || height <= 0 || width > 16384 || height > 16384) return null

  // Try zlib decompression — scan for zlib header (78 xx) at known offsets
  // Some .dat files use: [header...][78 01][extra 2 bytes][raw deflate data]
  // so we try inflate at the header, and also inflateRaw at header+2 and header+4
  const zlibOffsets = [28, 30, 32, 26, 24, 34]
  for (const offset of zlibOffsets) {
    if (offset >= datBuffer.length) continue
    if (datBuffer[offset] !== 0x78) continue

    // Try standard inflate, then raw inflate at offsets +0, +2, +4
    const tryOffsets = [
      { off: offset, raw: false },
      { off: offset, raw: true },
      { off: offset + 2, raw: true },
      { off: offset + 4, raw: true }
    ]
    for (const { off, raw } of tryOffsets) {
      if (off >= datBuffer.length) continue
      try {
        const argbData = await decompressPartial(datBuffer.subarray(off), raw)
        if (argbData.length === 0) continue

        const full = Buffer.alloc(width * height * 4, 0)
        argbData.copy(full, 0, 0, Math.min(argbData.length, full.length))
        return writePNG(full, width, height, destPath)
      } catch {
        continue
      }
    }
  }

  // Fallback: create a placeholder image with dimensions from frameRight/frameBottom
  if (bitmapItem.frameRight > 0 && bitmapItem.frameBottom > 0) {
    const fw = Math.round(bitmapItem.frameRight / 20)
    const fh = Math.round(bitmapItem.frameBottom / 20)
    const placeholder = Buffer.alloc(fw * fh * 4, 0)
    // Fill with a semi-transparent gray
    for (let i = 0; i < fw * fh; i++) {
      placeholder[i * 4] = 0x80     // A
      placeholder[i * 4 + 1] = 0x88 // R
      placeholder[i * 4 + 2] = 0x88 // G
      placeholder[i * 4 + 3] = 0x88 // B
    }
    return writePNG(placeholder, fw, fh, destPath)
  }

  return null
}

function decompressPartial(compressed: Buffer, raw = false): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    const inflate = raw ? createInflateRaw() : createInflate()
    const chunks: Buffer[] = []
    inflate.on('data', (chunk: Buffer) => chunks.push(chunk))
    inflate.on('error', () => {
      const buf = Buffer.concat(chunks)
      if (buf.length > 0) resolve(buf)
      else reject(new Error('decompression failed'))
    })
    inflate.on('end', () => resolve(Buffer.concat(chunks)))
    inflate.write(compressed)
    inflate.end()
  })
}

function writePNG(
  argbData: Buffer,
  width: number,
  height: number,
  destPath: string
): { width: number; height: number } {
  const png = new PNG({ width, height })
  const pixelCount = width * height
  for (let i = 0; i < pixelCount; i++) {
    const off = i * 4
    if (off + 3 < argbData.length) {
      // Flash ARGB → PNG RGBA
      png.data[off] = argbData[off + 1]     // R
      png.data[off + 1] = argbData[off + 2] // G
      png.data[off + 2] = argbData[off + 3] // B
      png.data[off + 3] = argbData[off]     // A
    }
  }
  const pngBuffer = PNG.sync.write(png)
  writeFileSync(destPath, pngBuffer)
  return { width, height }
}

function decomposeMatrix(a: number, b: number, c: number, d: number): {
  scaleX: number
  scaleY: number
  rotation: number
} {
  const scaleX = Math.sqrt(a * a + b * b)
  const scaleY = Math.sqrt(c * c + d * d)
  const rotation = Math.atan2(b, a) * (180 / Math.PI)
  return { scaleX, scaleY, rotation }
}

/**
 * Extract the matrix from an element's XML content.
 */
function extractMatrix(content: string): { a: number; b: number; c: number; d: number; tx: number; ty: number } {
  const matrixMatch = content.match(/<Matrix([^/]*)\/?>/s)
  if (!matrixMatch) return { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
  const matTag = matrixMatch[0]
  return {
    a: getFloatAttr(matTag, ' a', 1),
    b: getFloatAttr(matTag, ' b', 0),
    c: getFloatAttr(matTag, ' c', 0),
    d: getFloatAttr(matTag, ' d', 1),
    tx: getFloatAttr(matTag, ' tx', 0),
    ty: getFloatAttr(matTag, ' ty', 0)
  }
}

/**
 * A resolved element from a symbol — either a shape layer or an image layer.
 */
interface ResolvedElement {
  type: 'shape' | 'image'
  name: string
  shapeData?: FlaShapeData
  assetId?: string
}

/**
 * Fully resolve a symbol into its component elements.
 * Walks the symbol's timeline layers, extracting shapes (with BitmapFill support),
 * bitmap instances, and nested symbols recursively.
 * Each internal layer becomes a separate ResolvedElement.
 */
function resolveSymbolFully(
  libraryItemName: string,
  source: FileSource,
  bitmapAssetMap: Map<string, FlaAsset>,
  visited: Set<string>,
  depth: number = 0
): ResolvedElement[] {
  if (depth > 10 || visited.has(libraryItemName)) return []
  visited.add(libraryItemName)

  const xmlPath = `LIBRARY/${libraryItemName}.xml`
  const symXml = source.readText(xmlPath)
  if (!symXml) return []

  const elements: ResolvedElement[] = []

  // Parse symbol's timeline layers
  const layerPattern = /<DOMLayer\s[^>]*>([\s\S]*?)<\/DOMLayer>/g
  let layerMatch: RegExpExecArray | null

  while ((layerMatch = layerPattern.exec(symXml)) !== null) {
    const layerContent = layerMatch[0]
    const layerTag = layerContent.match(/<DOMLayer\s([^>]*)>/)?.[0] || ''
    const layerName = getAttr(layerTag, 'name') || 'Layer'
    const layerType = getAttr(layerTag, 'layerType')
    if (layerType === 'guide' || layerType === 'folder') continue

    // Get first frame's content
    const frameMatch = layerContent.match(/<DOMFrame\s[^>]*>([\s\S]*?)<\/DOMFrame>/)
    if (!frameMatch) continue
    const frameContent = frameMatch[0]

    // Collect shapes from this layer (including DOMGroup nesting)
    const allShapeXmls = extractAllShapeXml(frameContent)
    if (allShapeXmls.length > 0) {
      const shapePaths: FlaShapePath[] = []
      let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

      for (const shapeXml of allShapeXmls) {
        const parsed = parseShape(shapeXml)
        if (parsed.bounds.minX === Infinity) continue

        shapePaths.push(...parsedShapeToFlaShapePaths(parsed, bitmapAssetMap))

        if (parsed.bounds.minX < minX) minX = parsed.bounds.minX
        if (parsed.bounds.minY < minY) minY = parsed.bounds.minY
        if (parsed.bounds.maxX > maxX) maxX = parsed.bounds.maxX
        if (parsed.bounds.maxY > maxY) maxY = parsed.bounds.maxY
      }

      if (shapePaths.length > 0) {
        elements.push({
          type: 'shape',
          name: layerName,
          shapeData: {
            paths: shapePaths,
            originX: (minX + maxX) / 2,
            originY: (minY + maxY) / 2
          }
        })
      }
    }

    // Collect bitmap instances from this layer
    const bmpMatches = [...frameContent.matchAll(/<DOMBitmapInstance[^>]*libraryItemName="([^"]*)"/g)]
    for (const bmp of bmpMatches) {
      const asset = bitmapAssetMap.get(bmp[1])
      if (asset) {
        elements.push({ type: 'image', name: layerName, assetId: asset.id })
      }
    }

    // Collect and recurse into nested symbol instances
    const symMatches = [...frameContent.matchAll(/<DOMSymbolInstance[^>]*libraryItemName="([^"]*)"[^>]*>([\s\S]*?)<\/DOMSymbolInstance>/g)]
    for (const sm of symMatches) {
      const nestedLibName = sm[1]
      const symInstanceXml = sm[0]
      const symMatrix = extractMatrix(symInstanceXml)

      const nestedElements = resolveSymbolFully(nestedLibName, source, bitmapAssetMap, new Set([...visited]), depth + 1)

      for (const ne of nestedElements) {
        if (ne.type === 'shape' && ne.shapeData) {
          // Apply the symbol instance's transform to all shape points.
          // Use raw coordinates (not centered) — the instance matrix positions
          // the nested symbol relative to the parent symbol's origin.
          const transformedPaths = ne.shapeData.paths.map(path => ({
            ...path,
            points: path.points.map(p => ({
              x: symMatrix.a * p.x + symMatrix.c * p.y + symMatrix.tx,
              y: symMatrix.b * p.x + symMatrix.d * p.y + symMatrix.ty
            }))
          }))

          // Recompute bounds
          let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
          for (const path of transformedPaths) {
            for (const p of path.points) {
              if (p.x < minX) minX = p.x
              if (p.y < minY) minY = p.y
              if (p.x > maxX) maxX = p.x
              if (p.y > maxY) maxY = p.y
            }
          }

          elements.push({
            type: 'shape',
            name: `${layerName} (${nestedLibName})`,
            shapeData: {
              paths: transformedPaths,
              originX: (minX + maxX) / 2,
              originY: (minY + maxY) / 2
            }
          })
        } else if (ne.type === 'image' && ne.assetId) {
          elements.push({ type: 'image', name: `${layerName} (${nestedLibName})`, assetId: ne.assetId })
        }
      }
    }
  }

  return elements
}

/**
 * Parse a motionObjectXML string to extract animation keyframes.
 * Motion tweens use AnimationCore format with PropertyContainer/Property/Keyframe elements.
 * The anchor attribute has comma-separated values where the second value is the property value.
 * Scale values are in percentage (100 = 1.0), position/rotation are in pixels/degrees.
 */
function parseMotionObjectXML(
  frameContent: string,
  frameIndex: number,
  duration: number,
  fps: number
): { xKf: FlaKeyframe[]; yKf: FlaKeyframe[]; sxKf: FlaKeyframe[]; syKf: FlaKeyframe[]; rotKf: FlaKeyframe[]; opKf: FlaKeyframe[] } | null {
  const motionMatch = frameContent.match(/<motionObjectXML>([\s\S]*?)<\/motionObjectXML>/)
  if (!motionMatch) return null

  // Unescape XML entities
  let motionXml = motionMatch[1]
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&amp;/g, '&')
    .replace(/&quot;/g, '"')

  const timeScale = getIntAttr(motionXml, 'TimeScale', 30000)
  const ticksPerFrame = timeScale / fps

  const xKf: FlaKeyframe[] = []
  const yKf: FlaKeyframe[] = []
  const sxKf: FlaKeyframe[] = []
  const syKf: FlaKeyframe[] = []
  const rotKf: FlaKeyframe[] = []
  const opKf: FlaKeyframe[] = []

  // Parse properties and their keyframes
  const propertyPattern = /<Property[^>]*id="([^"]*)"[^>]*>([\s\S]*?)<\/Property>/g
  let pm: RegExpExecArray | null
  while ((pm = propertyPattern.exec(motionXml)) !== null) {
    const propId = pm[1]
    const propContent = pm[2]

    // Parse keyframes within this property
    const kfPattern = /<Keyframe[^>]*anchor="([^"]*)"[^>]*timevalue="([^"]*)"[^/]*\/?>/g
    let km: RegExpExecArray | null
    while ((km = kfPattern.exec(propContent)) !== null) {
      const anchorParts = km[1].split(',')
      const value = anchorParts.length > 1 ? parseFloat(anchorParts[1]) : parseFloat(anchorParts[0])
      const timevalue = parseFloat(km[2])
      const frame = frameIndex + Math.round(timevalue / ticksPerFrame)

      const kf: FlaKeyframe = { frame, value, easing: 'linear' }

      switch (propId) {
        case 'Motion_X': xKf.push(kf); break
        case 'Motion_Y': yKf.push(kf); break
        case 'Rotation_Z': rotKf.push(kf); break
        case 'Scale_X': sxKf.push({ ...kf, value: value / 100 }); break
        case 'Scale_Y': syKf.push({ ...kf, value: value / 100 }); break
      }
    }
  }

  if (xKf.length === 0 && yKf.length === 0 && rotKf.length === 0) return null
  return { xKf, yKf, sxKf, syKf, rotKf, opKf }
}

/**
 * Build a shape layer from symbol placements with keyframe tracks.
 */
function buildSymbolShapeLayer(
  name: string, order: number, placements: ElementPlacement[], shapeData: FlaShapeData
): FlaLayer {
  const xKf: FlaKeyframe[] = []
  const yKf: FlaKeyframe[] = []
  const sxKf: FlaKeyframe[] = []
  const syKf: FlaKeyframe[] = []
  const rotKf: FlaKeyframe[] = []
  const opKf: FlaKeyframe[] = []

  // The renderer subtracts shapeData.originX/Y from each point, so we must add
  // the shape origin to the placement tx/ty to get correct screen positioning.
  // Flash tx/ty positions the symbol's (0,0) on stage; our renderer expects the
  // position keyframe to be the shape's visual center.
  const ox = shapeData.originX
  const oy = shapeData.originY

  for (const p of placements) {
    const motionKf = (p as any).motionKeyframes as ReturnType<typeof parseMotionObjectXML>
    if (motionKf) {
      const baseX = p.tx + ox
      const baseY = p.ty + oy
      const baseDecomp = decomposeMatrix(p.a, p.b, p.c, p.d)
      for (const kf of motionKf.xKf) xKf.push({ ...kf, value: baseX + kf.value })
      for (const kf of motionKf.yKf) yKf.push({ ...kf, value: baseY + kf.value })
      for (const kf of motionKf.sxKf) sxKf.push(kf)
      for (const kf of motionKf.syKf) syKf.push(kf)
      for (const kf of motionKf.rotKf) rotKf.push({ ...kf, value: baseDecomp.rotation + kf.value })
      if (motionKf.xKf.length === 0) xKf.push({ frame: p.frameIndex, value: baseX, easing: 'linear' })
      if (motionKf.yKf.length === 0) yKf.push({ frame: p.frameIndex, value: baseY, easing: 'linear' })
      if (motionKf.sxKf.length === 0) sxKf.push({ frame: p.frameIndex, value: baseDecomp.scaleX, easing: 'linear' })
      if (motionKf.syKf.length === 0) syKf.push({ frame: p.frameIndex, value: baseDecomp.scaleY, easing: 'linear' })
      if (motionKf.rotKf.length === 0) rotKf.push({ frame: p.frameIndex, value: baseDecomp.rotation, easing: 'linear' })
      opKf.push({ frame: p.frameIndex, value: 1, easing: 'linear' })
    } else {
      const decomp = decomposeMatrix(p.a, p.b, p.c, p.d)
      const easing = p.tweenType ? 'easeInOut' : 'step'
      xKf.push({ frame: p.frameIndex, value: p.tx + ox, easing })
      yKf.push({ frame: p.frameIndex, value: p.ty + oy, easing })
      sxKf.push({ frame: p.frameIndex, value: decomp.scaleX, easing })
      syKf.push({ frame: p.frameIndex, value: decomp.scaleY, easing })
      rotKf.push({ frame: p.frameIndex, value: decomp.rotation, easing })
      opKf.push({ frame: p.frameIndex, value: 1, easing })
    }
  }

  const startFrame = placements[0].frameIndex
  const last = placements[placements.length - 1]
  const endFrame = last.frameIndex + last.duration - 1
  const firstRef = placements[0]
  const firstDecomp = decomposeMatrix(firstRef.a, firstRef.b, firstRef.c, firstRef.d)

  return {
    id: nanoid(), name, type: 'shape', shapeData,
    visible: true, locked: false, order, startFrame, endFrame,
    tracks: [
      { property: 'x', keyframes: xKf.length ? xKf : [{ frame: 0, value: firstRef.tx + ox, easing: 'linear' }] },
      { property: 'y', keyframes: yKf.length ? yKf : [{ frame: 0, value: firstRef.ty + oy, easing: 'linear' }] },
      { property: 'scaleX', keyframes: sxKf.length ? sxKf : [{ frame: 0, value: firstDecomp.scaleX, easing: 'linear' }] },
      { property: 'scaleY', keyframes: syKf.length ? syKf : [{ frame: 0, value: firstDecomp.scaleY, easing: 'linear' }] },
      { property: 'rotation', keyframes: rotKf.length ? rotKf : [{ frame: 0, value: firstDecomp.rotation, easing: 'linear' }] },
      { property: 'opacity', keyframes: opKf.length ? opKf : [{ frame: 0, value: 1, easing: 'linear' }] }
    ]
  }
}

/**
 * Build an image layer from placements with keyframe tracks.
 */
function buildImageLayer(
  name: string, order: number, placements: ElementPlacement[],
  asset: FlaAsset, canvasWidth: number, canvasHeight: number
): FlaLayer {
  const xKf: FlaKeyframe[] = []
  const yKf: FlaKeyframe[] = []
  const sxKf: FlaKeyframe[] = []
  const syKf: FlaKeyframe[] = []
  const rotKf: FlaKeyframe[] = []
  const opKf: FlaKeyframe[] = []

  for (const p of placements) {
    const motionKf = (p as any).motionKeyframes as ReturnType<typeof parseMotionObjectXML>
    if (motionKf) {
      const baseX = p.tx
      const baseY = p.ty
      const baseDecomp = decomposeMatrix(p.a, p.b, p.c, p.d)
      for (const kf of motionKf.xKf) xKf.push({ ...kf, value: baseX + kf.value })
      for (const kf of motionKf.yKf) yKf.push({ ...kf, value: baseY + kf.value })
      for (const kf of motionKf.sxKf) sxKf.push(kf)
      for (const kf of motionKf.syKf) syKf.push(kf)
      for (const kf of motionKf.rotKf) rotKf.push({ ...kf, value: baseDecomp.rotation + kf.value })
      if (motionKf.xKf.length === 0) xKf.push({ frame: p.frameIndex, value: baseX, easing: 'linear' })
      if (motionKf.yKf.length === 0) yKf.push({ frame: p.frameIndex, value: baseY, easing: 'linear' })
      if (motionKf.sxKf.length === 0) sxKf.push({ frame: p.frameIndex, value: baseDecomp.scaleX, easing: 'linear' })
      if (motionKf.syKf.length === 0) syKf.push({ frame: p.frameIndex, value: baseDecomp.scaleY, easing: 'linear' })
      if (motionKf.rotKf.length === 0) rotKf.push({ frame: p.frameIndex, value: baseDecomp.rotation, easing: 'linear' })
      opKf.push({ frame: p.frameIndex, value: 1, easing: 'linear' })
    } else {
      const { scaleX, scaleY, rotation } = decomposeMatrix(p.a, p.b, p.c, p.d)
      const easing = p.tweenType ? 'easeInOut' : 'step'
      xKf.push({ frame: p.frameIndex, value: p.tx, easing })
      yKf.push({ frame: p.frameIndex, value: p.ty, easing })
      sxKf.push({ frame: p.frameIndex, value: scaleX, easing })
      syKf.push({ frame: p.frameIndex, value: scaleY, easing })
      rotKf.push({ frame: p.frameIndex, value: rotation, easing })
      opKf.push({ frame: p.frameIndex, value: 1, easing })
    }
  }

  const startFrame = placements[0].frameIndex
  const last = placements[placements.length - 1]
  const endFrame = last.frameIndex + last.duration - 1

  return {
    id: nanoid(), name, type: 'image', assetId: asset.id,
    visible: true, locked: false, order, startFrame, endFrame,
    tracks: [
      { property: 'x', keyframes: xKf.length ? xKf : [{ frame: 0, value: canvasWidth / 2, easing: 'linear' }] },
      { property: 'y', keyframes: yKf.length ? yKf : [{ frame: 0, value: canvasHeight / 2, easing: 'linear' }] },
      { property: 'scaleX', keyframes: sxKf.length ? sxKf : [{ frame: 0, value: 1, easing: 'linear' }] },
      { property: 'scaleY', keyframes: syKf.length ? syKf : [{ frame: 0, value: 1, easing: 'linear' }] },
      { property: 'rotation', keyframes: rotKf.length ? rotKf : [{ frame: 0, value: 0, easing: 'linear' }] },
      { property: 'opacity', keyframes: opKf.length ? opKf : [{ frame: 0, value: 1, easing: 'linear' }] }
    ]
  }
}

export async function importFromSource(source: FileSource, projectName: string): Promise<FlaProject | null> {
  const projectId = nanoid()
  const assetsDir = join(app.getPath('userData'), 'projects', projectId, '.project_assets')
  mkdirSync(assetsDir, { recursive: true })

  try {
    const docXml = source.readText('DOMDocument.xml')
    if (!docXml) return null

      // Parse project settings
      const docMatch = docXml.match(/<DOMDocument[^>]*>/)
      const docTag = docMatch ? docMatch[0] : ''
      const canvasWidth = getIntAttr(docTag, 'width', 1920)
      const canvasHeight = getIntAttr(docTag, 'height', 1080)
      const fps = getIntAttr(docTag, 'frameRate', 24)
      const bgColor = getAttr(docTag, 'backgroundColor') || '#FFFFFF'

      // Parse media (bitmap items)
      const mediaSection = docXml.match(/<media>([\s\S]*?)<\/media>/)
      const bitmapItems: Map<string, {
        name: string
        href: string
        datHref: string
        isJPEG: boolean
        frameRight: number
        frameBottom: number
      }> = new Map()

      if (mediaSection) {
        const bitmapMatches = mediaSection[1].matchAll(/<DOMBitmapItem\s[\s\S]*?\/>/g)
        for (const m of bitmapMatches) {
          const tag = m[0]
          const name = getAttr(tag, 'name') || 'unnamed'
          const href = getAttr(tag, 'href') || name
          const datHref = getAttr(tag, 'bitmapDataHRef') || ''
          const isJPEG = getAttr(tag, 'isJPEG') === 'true'
          const frameRight = getIntAttr(tag, 'frameRight', 0)
          const frameBottom = getIntAttr(tag, 'frameBottom', 0)
          const item = { name, href, datHref, isJPEG, frameRight, frameBottom }
          bitmapItems.set(href, item)
          if (href !== name) bitmapItems.set(name, item)
        }
      }

      // Extract all bitmaps
      const assets: FlaAsset[] = []
      const bitmapAssetMap: Map<string, FlaAsset> = new Map()
      const processedDats: Set<string> = new Set()

      for (const [, item] of bitmapItems) {
        if (processedDats.has(item.datHref)) continue
        processedDats.add(item.datHref)

        let datBuffer: Buffer | null = null

        if (item.datHref) {
          datBuffer = source.readBinary(`bin/${item.datHref}`)
        }
        if (!datBuffer) {
          datBuffer = source.readBinary(`LIBRARY/${item.href}`)
        }
        if (!datBuffer || datBuffer.length === 0) continue

        const assetId = nanoid()
        const ext = item.isJPEG || (datBuffer[0] === 0xff && datBuffer[1] === 0xd8) ? '.jpg' : '.png'
        const destPath = join(assetsDir, `${assetId}${ext}`)

        const dims = await extractBitmap(datBuffer, item, destPath)
        if (!dims) continue

        const asset: FlaAsset = {
          id: assetId,
          type: 'image',
          name: item.name,
          localBundlePath: destPath,
          width: dims.width,
          height: dims.height
        }
        assets.push(asset)
        bitmapAssetMap.set(item.href, asset)
        bitmapAssetMap.set(item.name, asset)
        console.log(`[FLA] Extracted bitmap "${item.name}" → ${destPath} (${dims.width}x${dims.height})`)
      }

      // Parse main timeline
      const layers: FlaLayer[] = []
      let totalFrames = 1

      const timelinesMatch = docXml.match(/<timelines>([\s\S]*?)<\/timelines>/)
      if (timelinesMatch) {
        const tlXml = timelinesMatch[1]
        const layerPattern = /<DOMLayer\s[^>]*>([\s\S]*?)<\/DOMLayer>/g
        let layerMatch: RegExpExecArray | null
        let layerOrder = 0

        while ((layerMatch = layerPattern.exec(tlXml)) !== null) {
          const layerContent = layerMatch[0]
          const layerTag = layerContent.match(/<DOMLayer\s([^>]*)>/)?.[0] || ''
          const layerName = getAttr(layerTag, 'name') || `Layer ${layerOrder + 1}`
          const layerType = getAttr(layerTag, 'layerType') // mask, guide, folder, etc.

          // Skip guide and folder layers
          if (layerType === 'guide' || layerType === 'folder') {
            layerOrder++
            continue
          }

          // Parse frames
          const framePattern = /<DOMFrame\s[^>]*>([\s\S]*?)<\/DOMFrame>/g
          let frameMatch: RegExpExecArray | null
          const placements: ElementPlacement[] = []
          let hasShapes = false

          // Track symbol placements grouped by libraryItemName
          const symbolGroups = new Map<string, ElementPlacement[]>()

          while ((frameMatch = framePattern.exec(layerContent)) !== null) {
            const frameContent = frameMatch[0]
            const frameTag = frameContent.match(/<DOMFrame\s([^>]*)>/)?.[0] || ''
            const frameIndex = getIntAttr(frameTag, 'index', 0)
            const duration = getIntAttr(frameTag, 'duration', 1)
            const tweenType = getAttr(frameTag, 'tweenType') || null

            const frameEnd = frameIndex + duration
            if (frameEnd > totalFrames) totalFrames = frameEnd

            // Collect ALL DOMBitmapInstance elements in this frame
            const bmpMatches = [...frameContent.matchAll(/<DOMBitmapInstance[^>]*>([\s\S]*?)<\/DOMBitmapInstance>/gs)]
            for (const bmpMatch of bmpMatches) {
              const bmpTag = bmpMatch[0].match(/<DOMBitmapInstance[^>]*/)?.[0] || ''
              const libName = getAttr(bmpTag, 'libraryItemName') || ''
              const matrix = extractMatrix(bmpMatch[0])
              const placement: ElementPlacement = {
                frameIndex, duration, assetRef: libName,
                isSymbol: false, ...matrix, tweenType
              }
              placements.push(placement)
              const group = symbolGroups.get(libName)
              if (group) group.push(placement)
              else symbolGroups.set(libName, [placement])
            }

            // Collect ALL DOMSymbolInstance elements in this frame
            const symMatches = [...frameContent.matchAll(/<DOMSymbolInstance[^>]*>([\s\S]*?)<\/DOMSymbolInstance>/gs)]
            for (const symMatch of symMatches) {
              const symTag = symMatch[0].match(/<DOMSymbolInstance[^>]*/)?.[0] || ''
              const libName = getAttr(symTag, 'libraryItemName') || ''
              const matrix = extractMatrix(symMatch[0])

              let placement: ElementPlacement
              // Check for motion tween — parse motionObjectXML for additional keyframes
              if (tweenType === 'motion object') {
                const motionData = parseMotionObjectXML(frameContent, frameIndex, duration, fps)
                if (motionData) {
                  placement = {
                    frameIndex, duration, assetRef: libName,
                    isSymbol: true, ...matrix, tweenType,
                    motionKeyframes: motionData
                  } as ElementPlacement & { motionKeyframes: ReturnType<typeof parseMotionObjectXML> }
                } else {
                  placement = {
                    frameIndex, duration, assetRef: libName,
                    isSymbol: true, ...matrix, tweenType
                  }
                }
              } else {
                placement = {
                  frameIndex, duration, assetRef: libName,
                  isSymbol: true, ...matrix, tweenType
                }
              }

              placements.push(placement)
              const group = symbolGroups.get(libName)
              if (group) group.push(placement)
              else symbolGroups.set(libName, [placement])
            }

            // Check for DOMShape (including inside DOMGroup nesting)
            if (frameContent.includes('<DOMShape')) {
              hasShapes = true
            }
          }

          // Always process direct shapes if present (even if symbols exist too)
          if (hasShapes) {
            // Collect shapes per frame to detect keyframed shape movement
            const frameShapes: Array<{
              frameIndex: number
              duration: number
              shapeXml: string
              tweenType: string | null
            }> = []

            const framePattern2 = /<DOMFrame\s[^>]*>([\s\S]*?)<\/DOMFrame>/g
            let fm2: RegExpExecArray | null
            while ((fm2 = framePattern2.exec(layerContent)) !== null) {
              const fc = fm2[0]
              const ft = fc.match(/<DOMFrame\s([^>]*)>/)?.[0] || ''
              const fi = getIntAttr(ft, 'index', 0)
              const dur = getIntAttr(ft, 'duration', 1)
              const tw = getAttr(ft, 'tweenType') || null
              const allShapes = extractAllShapeXml(fc)
              for (const shapeXml of allShapes) {
                frameShapes.push({ frameIndex: fi, duration: dur, shapeXml, tweenType: tw })
              }
            }

            if (frameShapes.length > 0) {
              // Parse all shapes from the first frame and merge into single ShapeData
              const firstFrameIdx = frameShapes[0].frameIndex
              const firstFrameShapes = frameShapes.filter(fs => fs.frameIndex === firstFrameIdx)
              const shapePaths: FlaShapePath[] = []
              let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

              for (const fs of firstFrameShapes) {
                const parsed = parseShape(fs.shapeXml)
                if (parsed.bounds.minX === Infinity) continue

                shapePaths.push(...parsedShapeToFlaShapePaths(parsed, bitmapAssetMap))

                // Merge bounds
                if (parsed.bounds.minX < minX) minX = parsed.bounds.minX
                if (parsed.bounds.minY < minY) minY = parsed.bounds.minY
                if (parsed.bounds.maxX > maxX) maxX = parsed.bounds.maxX
                if (parsed.bounds.maxY > maxY) maxY = parsed.bounds.maxY
              }

              if (shapePaths.length > 0) {
                const originX = (minX + maxX) / 2
                const originY = (minY + maxY) / 2
                const shapeData: FlaShapeData = { paths: shapePaths, originX, originY }

                // Build keyframes — use unique frame indices to track position
                const xKf: FlaKeyframe[] = []
                const yKf: FlaKeyframe[] = []
                const sxKf: FlaKeyframe[] = []
                const syKf: FlaKeyframe[] = []
                const rotKf: FlaKeyframe[] = []
                const opKf: FlaKeyframe[] = []

                // Group shapes by frame index for position tracking
                const frameIndices = [...new Set(frameShapes.map(fs => fs.frameIndex))].sort((a, b) => a - b)
                for (const fi of frameIndices) {
                  const shapesAtFrame = frameShapes.filter(fs => fs.frameIndex === fi)
                  let cx = originX, cy = originY
                  if (shapesAtFrame.length > 0) {
                    const parsed = parseShape(shapesAtFrame[0].shapeXml)
                    cx = (parsed.bounds.minX + parsed.bounds.maxX) / 2 + parsed.transform.tx
                    cy = (parsed.bounds.minY + parsed.bounds.maxY) / 2 + parsed.transform.ty
                  }
                  const easing = shapesAtFrame[0]?.tweenType ? 'easeInOut' : 'step'

                  xKf.push({ frame: fi, value: cx, easing })
                  yKf.push({ frame: fi, value: cy, easing })
                  sxKf.push({ frame: fi, value: 1, easing })
                  syKf.push({ frame: fi, value: 1, easing })
                  rotKf.push({ frame: fi, value: 0, easing })
                  opKf.push({ frame: fi, value: 1, easing })
                }

                const startFrame = frameIndices[0]
                const lastFs = frameShapes[frameShapes.length - 1]
                const endFrame = lastFs.frameIndex + lastFs.duration - 1

                layers.push({
                  id: nanoid(),
                  name: layerName,
                  type: 'shape',
                  shapeData,
                  visible: true,
                  locked: false,
                  order: layerOrder,
                  startFrame,
                  endFrame,
                  tracks: [
                    { property: 'x', keyframes: xKf },
                    { property: 'y', keyframes: yKf },
                    { property: 'scaleX', keyframes: sxKf },
                    { property: 'scaleY', keyframes: syKf },
                    { property: 'rotation', keyframes: rotKf },
                    { property: 'opacity', keyframes: opKf }
                  ]
                })
              }
              layerOrder++
            }
          }

          // Process each unique symbol/bitmap reference as its own layer
          for (const [libName, groupPlacements] of symbolGroups) {
            const firstRef = groupPlacements[0]

            if (firstRef.isSymbol) {
              // Fully resolve symbol into component elements (shapes + images)
              const resolved = resolveSymbolFully(libName, source, bitmapAssetMap, new Set())
              console.log(`[FLA] resolveSymbolFully("${libName}") → ${resolved.length} elements:`, resolved.map(e => `${e.type}:${e.name}${e.shapeData ? ` (${e.shapeData.paths.length} paths, bmpFills: ${e.shapeData.paths.filter(p => p.bitmapFillAssetId).length})` : ''}${e.assetId ? ` assetId=${e.assetId}` : ''}`))

              if (resolved.length > 0) {
                for (const elem of resolved) {
                  if (elem.type === 'shape' && elem.shapeData) {
                    const symLayer = buildSymbolShapeLayer(
                      layerName + ' (' + elem.name + ')', layerOrder, groupPlacements, elem.shapeData
                    )
                    layers.push(symLayer)
                    layerOrder++
                  } else if (elem.type === 'image' && elem.assetId) {
                    const asset = assets.find(a => a.id === elem.assetId)
                    if (asset) {
                      const imgLayer = buildImageLayer(
                        layerName + ' (' + elem.name + ')', layerOrder, groupPlacements, asset, canvasWidth, canvasHeight
                      )
                      layers.push(imgLayer)
                      layerOrder++
                    }
                  }
                }
                continue
              }
            }

            // Direct bitmap reference (not a symbol)
            const asset = bitmapAssetMap.get(libName)
            if (!asset) continue

            // Build image layer from placements
            const imgLayer = buildImageLayer(
              layerName, layerOrder, groupPlacements, asset, canvasWidth, canvasHeight
            )
            layers.push(imgLayer)
            layerOrder++
          }

          // If no shapes and no symbols were processed, still advance layer order
          if (!hasShapes && symbolGroups.size === 0) {
            layerOrder++
          }
        }
      }

      // In Adobe Animate, the first DOMLayer in the XML is the topmost layer.
      // The renderer sorts by order ascending (lower = bottom), so reverse the order.
      if (layers.length > 0) {
        const maxOrder = Math.max(...layers.map((l) => l.order))
        for (const l of layers) l.order = maxOrder - l.order
      }

      // Fallback: if no layers from timeline, create one layer per asset
      if (layers.length === 0) {
        for (let i = 0; i < assets.length; i++) {
          const asset = assets[i]
          layers.push({
            id: nanoid(),
            name: asset.name,
            type: 'image',
            assetId: asset.id,
            visible: true,
            locked: false,
            order: i,
            startFrame: 0,
            endFrame: totalFrames - 1,
            tracks: [
              makeTrack('x', canvasWidth / 2),
              makeTrack('y', canvasHeight / 2),
              makeTrack('scaleX', 1),
              makeTrack('scaleY', 1),
              makeTrack('rotation', 0),
              makeTrack('opacity', 1)
            ]
          })
        }
      }

      const project: FlaProject = {
        id: projectId,
        name: projectName,
        width: canvasWidth,
        height: canvasHeight,
        fps,
        durationFrames: totalFrames,
        backgroundColor: bgColor,
        assets,
        layers
      }

      return project
    } catch (err) {
      console.error('FLA import error:', err)
      return null
    }
}

export function registerFlaHandlers(): void {
  ipcMain.handle('import-fla', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open FLA File',
      filters: [{ name: 'Adobe Animate', extensions: ['fla'] }],
      properties: ['openFile']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const flaPath = result.filePaths[0]
    const zip = new AdmZip(flaPath)
    const source = new ZipFileSource(zip)
    return importFromSource(source, basename(flaPath, '.fla'))
  })

  ipcMain.handle('import-xfl', async () => {
    const result = await dialog.showOpenDialog({
      title: 'Open XFL Project Folder',
      properties: ['openDirectory']
    })

    if (result.canceled || result.filePaths.length === 0) return null

    const folderPath = result.filePaths[0]
    const source = new FolderFileSource(folderPath)
    return importFromSource(source, basename(folderPath))
  })
}
