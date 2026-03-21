import { XMLParser } from 'fast-xml-parser'
import { nanoid } from 'nanoid'
import { decomposeMatrix, multiplyMatrices, rgbToHex, type Matrix2D } from './matrixUtils'
import type { ImageAssetInfo, ShapeAssetInfo } from './ffdecAssetExtractor'

// ── Types ──────────────────────────────────────────────────────────────────

interface LayerResult {
  id: string
  name: string
  type: 'image' | 'shape' | 'text'
  assetId?: string
  shapeData?: { paths: any[]; originX: number; originY: number }
  textData?: { text: string; font: string; color: string; size: number }
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

interface SwfHeader {
  width: number
  height: number
  fps: number
  frameCount: number
  backgroundColor: string
}

interface DisplayEntry {
  characterId: number
  matrix: Matrix2D
}

interface PlacementData {
  depth: number
  characterId: number
  frames: Array<{ frame: number; matrix: Matrix2D }>
  startFrame: number
  endFrame: number
  visibleRanges: Array<{ start: number; end: number }>
}

interface FontInfo {
  id: number
  name: string
  codeUnits: number[]
}

// ── Main Parser ────────────────────────────────────────────────────────────

export function parseSwfDump(
  xmlString: string,
  imageAssets: ImageAssetInfo[],
  shapeAssets: ShapeAssetInfo[]
): { header: SwfHeader; layers: LayerResult[] } {
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    allowBooleanAttributes: true,
    parseAttributeValue: true,
    isArray: (name) => name === 'item' || name === 'subItems'
  })

  const parsed = parser.parse(xmlString)

  // Navigate to the root SWF structure
  // JPEXS dumpSWF output format varies — try common structures
  const swf = parsed.swf || parsed.SWF || parsed
  const headerNode = swf.Header || swf.header || {}
  const tagsNode = swf.tags || swf.Tags || {}

  const header = parseHeader(headerNode)
  const tags = normalizeTagList(tagsNode)

  // Build character dictionary and font map
  const characters = new Map<number, any>()
  const fonts = new Map<number, FontInfo>()

  for (const tag of tags) {
    const tagType = getTagType(tag)
    const charId = getCharacterId(tag)

    if (charId !== undefined) {
      characters.set(charId, tag)
    }

    if (tagType.includes('Font')) {
      const fontInfo = parseFontTag(tag, charId || 0)
      if (fontInfo) fonts.set(fontInfo.id, fontInfo)
    }
  }

  // Build asset maps for lookup
  const imageAssetMap = new Map<number, ImageAssetInfo>()
  for (const img of imageAssets) {
    if (img.characterId >= 0) imageAssetMap.set(img.characterId, img)
  }

  const shapeAssetMap = new Map<number, ShapeAssetInfo>()
  for (const shape of shapeAssets) {
    if (shape.characterId >= 0) shapeAssetMap.set(shape.characterId, shape)
  }

  // Process timeline
  const layers = processTimeline(
    tags,
    characters,
    imageAssetMap,
    shapeAssetMap,
    fonts,
    header.frameCount
  )

  return { header, layers }
}

// ── Header Parsing ────────────────────────────────────────────────────────

function parseHeader(node: any): SwfHeader {
  const frameSize = node.frameSize || node.FrameSize || {}
  const xMax = frameSize.xMax || frameSize.XMax || frameSize['@_xMax'] || 0
  const yMax = frameSize.yMax || frameSize.YMax || frameSize['@_yMax'] || 0

  return {
    width: Math.round(xMax / 20),
    height: Math.round(yMax / 20),
    fps: Math.round(
      node.frameRate || node.FrameRate || node['@_frameRate'] || 24
    ),
    frameCount: Math.max(
      1,
      node.frameCount || node.FrameCount || node['@_frameCount'] || 1
    ),
    backgroundColor: '#FFFFFF'
  }
}

// ── Timeline Processing ────────────────────────────────────────────────────

function processTimeline(
  tags: any[],
  characters: Map<number, any>,
  imageAssets: Map<number, ImageAssetInfo>,
  shapeAssets: Map<number, ShapeAssetInfo>,
  fonts: Map<number, FontInfo>,
  totalFrames: number
): LayerResult[] {
  const displayList = new Map<number, DisplayEntry>()
  const placements = new Map<string, PlacementData>()

  let currentFrame = 0

  for (const tag of tags) {
    const tagType = getTagType(tag)

    if (tagType.includes('SetBackgroundColor')) {
      // Already handled in header
      continue
    }

    if (tagType.includes('PlaceObject')) {
      const depth = getNum(tag, 'depth') || getNum(tag, 'Depth') || 0
      const existing = displayList.get(depth)
      const charId =
        getNum(tag, 'characterId') ??
        getNum(tag, 'CharacterId') ??
        existing?.characterId
      if (charId === undefined) continue

      const isUpdate = getBool(tag, 'isUpdate') || getBool(tag, 'flagMove')

      // Parse matrix — preserve existing if not provided
      const matrixNode =
        tag.matrix || tag.Matrix || tag.placingMatrix || tag.PlacingMatrix
      const matrix = matrixNode ? parseMatrixNode(matrixNode) : existing ? { ...existing.matrix } : { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }

      const newCharId = getNum(tag, 'characterId') ?? getNum(tag, 'CharacterId')
      const isCharReplacement =
        isUpdate && existing && newCharId !== undefined && newCharId !== existing.characterId

      if (isCharReplacement) {
        const oldKey = depth + ':' + existing!.characterId
        const oldP = placements.get(oldKey)
        if (oldP && oldP.visibleRanges.length > 0) {
          const lr = oldP.visibleRanges[oldP.visibleRanges.length - 1]
          if (lr.end === totalFrames - 1) lr.end = Math.max(0, currentFrame - 1)
        }
        displayList.set(depth, { characterId: charId, matrix })
      } else if (!isUpdate || !existing) {
        displayList.set(depth, { characterId: charId, matrix })
      } else {
        existing.matrix = matrix
      }

      const key = depth + ':' + charId
      if (!placements.has(key)) {
        placements.set(key, {
          depth,
          characterId: charId,
          frames: [],
          startFrame: currentFrame,
          endFrame: totalFrames - 1,
          visibleRanges: [{ start: currentFrame, end: totalFrames - 1 }]
        })
      } else if (isCharReplacement) {
        placements.get(key)!.visibleRanges.push({ start: currentFrame, end: totalFrames - 1 })
      }
      const p = placements.get(key)!
      p.frames.push({ frame: currentFrame, matrix })
      if (currentFrame < p.startFrame) p.startFrame = currentFrame
    }

    if (tagType.includes('RemoveObject')) {
      const depth = getNum(tag, 'depth') || getNum(tag, 'Depth') || 0
      const entry = displayList.get(depth)
      if (entry) {
        const key = depth + ':' + entry.characterId
        const p = placements.get(key)
        if (p) {
          p.endFrame = Math.max(0, currentFrame - 1)
          if (p.visibleRanges.length > 0) {
            const lr = p.visibleRanges[p.visibleRanges.length - 1]
            if (lr.end === totalFrames - 1) lr.end = Math.max(0, currentFrame - 1)
          }
        }
        displayList.delete(depth)
      }
    }

    if (tagType.includes('ShowFrame')) {
      currentFrame++
    }
  }

  // Convert placements to layers
  const layers: LayerResult[] = []
  let layerOrder = 0
  const sorted = Array.from(placements.values()).sort((a, b) => a.depth - b.depth)

  for (const placement of sorted) {
    const layer = buildLayerFromPlacement(
      placement,
      imageAssets,
      shapeAssets,
      fonts,
      characters,
      totalFrames
    )
    if (!layer) continue

    if (placement.visibleRanges.length > 1) {
      addVisibilityKeyframes(layer, placement.visibleRanges, totalFrames)
    }
    layer.order = layerOrder++
    layers.push(layer)
  }

  return layers
}

// ── Layer Builders ────────────────────────────────────────────────────────

function buildLayerFromPlacement(
  placement: PlacementData,
  imageAssets: Map<number, ImageAssetInfo>,
  shapeAssets: Map<number, ShapeAssetInfo>,
  fonts: Map<number, FontInfo>,
  characters: Map<number, any>,
  _totalFrames: number
): LayerResult | null {
  const charId = placement.characterId

  // Check if it's an image
  const imageAsset = imageAssets.get(charId)
  if (imageAsset) {
    return buildImageLayer('Image ' + charId, imageAsset.id, placement)
  }

  // Check if it's a shape
  const shapeAsset = shapeAssets.get(charId)
  if (shapeAsset) {
    return buildShapeLayer('Shape ' + charId, shapeAsset.shapeData, placement)
  }

  // Check if it's a text tag
  const charTag = characters.get(charId)
  if (charTag) {
    const tagType = getTagType(charTag)
    if (tagType.includes('DefineText')) {
      return buildTextLayer(charTag, placement, fonts)
    }
  }

  return null
}

function buildImageLayer(
  name: string,
  assetId: string,
  placement: PlacementData
): LayerResult {
  return {
    id: nanoid(),
    name,
    type: 'image',
    assetId,
    visible: true,
    locked: false,
    order: 0,
    startFrame: placement.startFrame,
    endFrame: placement.endFrame,
    tracks: buildTracks(placement.frames)
  }
}

function buildShapeLayer(
  name: string,
  shapeData: ShapeAssetInfo['shapeData'],
  placement: PlacementData
): LayerResult {
  return {
    id: nanoid(),
    name,
    type: 'shape',
    shapeData,
    visible: true,
    locked: false,
    order: 0,
    startFrame: placement.startFrame,
    endFrame: placement.endFrame,
    tracks: buildTracks(placement.frames)
  }
}

function buildTextLayer(
  textTag: any,
  placement: PlacementData,
  fonts: Map<number, FontInfo>
): LayerResult | null {
  // Extract text content from DefineText records
  const records = textTag.records || textTag.Records || textTag.textRecords || []
  let text = ''
  let fontName = 'Arial'
  let color = '#000000'
  let fontSize = 24

  const recList = Array.isArray(records) ? records : [records]
  for (const rec of recList) {
    const fontId = getNum(rec, 'fontId') ?? getNum(rec, 'FontId')
    if (fontId !== undefined) {
      const font = fonts.get(fontId)
      if (font) fontName = font.name || 'Arial'
      fontSize = (getNum(rec, 'textHeight') || getNum(rec, 'fontSize') || 480) / 20
    }

    const colorNode = rec.textColor || rec.TextColor || rec.color
    if (colorNode) {
      const r = getNum(colorNode, 'red') ?? getNum(colorNode, 'r') ?? 0
      const g = getNum(colorNode, 'green') ?? getNum(colorNode, 'g') ?? 0
      const b = getNum(colorNode, 'blue') ?? getNum(colorNode, 'b') ?? 0
      color = rgbToHex(r, g, b)
    }

    const glyphs = rec.glyphEntries || rec.GlyphEntries || rec.entries || []
    const glyphList = Array.isArray(glyphs) ? glyphs : [glyphs]
    const fontInfo = fontId !== undefined ? fonts.get(fontId) : null
    for (const glyph of glyphList) {
      const idx = getNum(glyph, 'glyphIndex') ?? getNum(glyph, 'index') ?? -1
      if (fontInfo && fontInfo.codeUnits && idx >= 0 && idx < fontInfo.codeUnits.length) {
        text += String.fromCharCode(fontInfo.codeUnits[idx])
      }
    }
  }

  if (!text) return null

  return {
    id: nanoid(),
    name: 'Text: ' + text.substring(0, 20),
    type: 'text',
    textData: { text, font: fontName, color, size: fontSize },
    visible: true,
    locked: false,
    order: 0,
    startFrame: placement.startFrame,
    endFrame: placement.endFrame,
    tracks: buildTracks(placement.frames)
  }
}

// ── Track Builder ──────────────────────────────────────────────────────────

function buildTracks(
  frames: Array<{ frame: number; matrix: Matrix2D }>
): LayerResult['tracks'] {
  const props = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']
  const easing = frames.length > 1 ? 'linear' : 'step'

  return props.map((prop) => ({
    property: prop,
    keyframes: frames.map((f) => {
      const { scaleX, scaleY, rotation } = decomposeMatrix(
        f.matrix.a,
        f.matrix.b,
        f.matrix.c,
        f.matrix.d
      )
      let value: number
      switch (prop) {
        case 'x':
          value = f.matrix.tx
          break
        case 'y':
          value = f.matrix.ty
          break
        case 'scaleX':
          value = scaleX
          break
        case 'scaleY':
          value = scaleY
          break
        case 'rotation':
          value = rotation
          break
        case 'opacity':
          value = 1
          break
        default:
          value = 0
      }
      return { frame: f.frame, value, easing }
    })
  }))
}

// ── Visibility Keyframes ──────────────────────────────────────────────────

function addVisibilityKeyframes(
  layer: LayerResult,
  visibleRanges: Array<{ start: number; end: number }>,
  totalFrames: number
): void {
  let opacityTrack = layer.tracks.find((t) => t.property === 'opacity')
  if (!opacityTrack) {
    opacityTrack = { property: 'opacity', keyframes: [] }
    layer.tracks.push(opacityTrack)
  }

  const keyframes: Array<{ frame: number; value: number; easing: string }> = []

  if (visibleRanges.length > 0 && visibleRanges[0].start > 0) {
    keyframes.push({ frame: 0, value: 0, easing: 'step' })
  }

  for (const range of visibleRanges) {
    keyframes.push({ frame: range.start, value: 1, easing: 'step' })
    if (range.end < totalFrames - 1) {
      keyframes.push({ frame: range.end + 1, value: 0, easing: 'step' })
    }
  }

  opacityTrack.keyframes = keyframes
  layer.startFrame = 0
  layer.endFrame = totalFrames - 1
}

// ── XML Helpers ────────────────────────────────────────────────────────────

function normalizeTagList(tagsNode: any): any[] {
  if (Array.isArray(tagsNode)) return tagsNode
  if (tagsNode?.item) return Array.isArray(tagsNode.item) ? tagsNode.item : [tagsNode.item]
  return []
}

function getTagType(tag: any): string {
  return tag['@_type'] || tag.type || tag.tagType || tag.TagType || ''
}

function getCharacterId(tag: any): number | undefined {
  const v = tag.characterId ?? tag.CharacterId ?? tag['@_characterId']
  return v !== undefined ? Number(v) : undefined
}

function getNum(obj: any, key: string): number | undefined {
  const v = obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)]
  return v !== undefined ? Number(v) : undefined
}

function getBool(obj: any, key: string): boolean {
  const v = obj?.[key] ?? obj?.[key.charAt(0).toUpperCase() + key.slice(1)]
  return v === true || v === 'true' || v === 1
}

function parseMatrixNode(node: any): Matrix2D {
  // JPEXS dumpSWF uses various matrix formats
  // Could be nested: <matrix><Matrix scaleX="1.0" .../></matrix>
  // Or flat: {scaleX: 1.0, translateX: 100, ...}
  const inner = node.Matrix || node.matrix || node
  return {
    a: parseFloat(inner.scaleX ?? inner.ScaleX ?? inner['@_scaleX'] ?? '1') || 1,
    b: parseFloat(
      inner.rotateSkew0 ?? inner.RotateSkew0 ?? inner['@_rotateSkew0'] ?? '0'
    ) || 0,
    c: parseFloat(
      inner.rotateSkew1 ?? inner.RotateSkew1 ?? inner['@_rotateSkew1'] ?? '0'
    ) || 0,
    d: parseFloat(inner.scaleY ?? inner.ScaleY ?? inner['@_scaleY'] ?? '1') || 1,
    tx:
      (parseFloat(
        inner.translateX ?? inner.TranslateX ?? inner['@_translateX'] ?? '0'
      ) || 0) / 20,
    ty:
      (parseFloat(
        inner.translateY ?? inner.TranslateY ?? inner['@_translateY'] ?? '0'
      ) || 0) / 20
  }
}

function parseFontTag(tag: any, charId: number): FontInfo | null {
  const name =
    tag.fontName || tag.FontName || tag.fontFamilyName || tag.FontFamilyName || 'Unknown'

  // Extract code units (character mappings)
  const codeTable = tag.codeTable || tag.CodeTable || []
  const codeUnits: number[] = []
  if (Array.isArray(codeTable)) {
    for (const code of codeTable) {
      codeUnits.push(typeof code === 'number' ? code : parseInt(code, 10))
    }
  }

  return { id: charId, name: String(name), codeUnits }
}
