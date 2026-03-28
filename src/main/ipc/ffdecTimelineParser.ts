import { XMLParser } from 'fast-xml-parser'
import { nanoid } from 'nanoid'
import { decomposeMatrix, type Matrix2D } from './matrixUtils'
import type { ImageAssetInfo, ShapeAssetInfo } from './ffdecAssetExtractor'

// ── Types ──────────────────────────────────────────────────────────────────

interface LayerResult {
  id: string
  name: string
  contentItems?: Array<{ id: string; name: string; content: { type: string; [key: string]: any } }>
  contentKeyframes?: Array<{ frame: number; contentItemId: string }>
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
  const swf = parsed.swf || parsed.SWF || parsed

  const header = parseHeader(swf)
  const tagsNode = swf.tags || swf.Tags || {}
  const tags = normalizeTagList(tagsNode)

  // Build character dictionary and font map
  const characters = new Map<number, any>()
  const fonts = new Map<number, FontInfo>()

  for (const tag of tags) {
    const tagType = getTagType(tag)

    // Capture character definitions (DefineShape, DefineBits, DefineText, etc.)
    const charId =
      attr(tag, 'shapeId') ??
      attr(tag, 'characterId') ??
      attr(tag, 'bitmapId') ??
      attr(tag, 'textId')
    if (charId !== undefined && tagType.startsWith('Define')) {
      characters.set(charId, tag)
    }

    if (tagType.includes('Font') && !tagType.includes('Align') && !tagType.includes('Name')) {
      const fontId = attr(tag, 'fontId') ?? charId
      if (fontId !== undefined) {
        const fontInfo = parseFontTag(tag, fontId)
        if (fontInfo) fonts.set(fontInfo.id, fontInfo)
      }
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

function parseHeader(swf: any): SwfHeader {
  // swf2xml puts frameCount, frameRate on the root <swf> element
  const frameCount = Math.max(1, attr(swf, 'frameCount') ?? 1)
  const fps = Math.round(attr(swf, 'frameRate') ?? 24)

  // displayRect contains dimensions in twips
  const rect = swf.displayRect || {}
  const xMax = attr(rect, 'Xmax') ?? attr(rect, 'xMax') ?? 0
  const yMax = attr(rect, 'Ymax') ?? attr(rect, 'yMax') ?? 0

  // Find background color from tags
  let backgroundColor = '#FFFFFF'
  const tagsNode = swf.tags || swf.Tags || {}
  const tags = normalizeTagList(tagsNode)
  for (const tag of tags) {
    if (getTagType(tag).includes('SetBackgroundColor')) {
      const bg = tag.backgroundColor || tag.color || {}
      const r = attr(bg, 'red') ?? 255
      const g = attr(bg, 'green') ?? 255
      const b = attr(bg, 'blue') ?? 255
      backgroundColor = rgbToHex(r, g, b)
      break
    }
  }

  return {
    width: Math.round(xMax / 20),
    height: Math.round(yMax / 20),
    fps,
    frameCount,
    backgroundColor
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

    if (tagType.includes('PlaceObject')) {
      const depth = attr(tag, 'depth') ?? 0
      const existing = displayList.get(depth)

      // characterId: in swf2xml, PlaceObject2Tag has characterId attribute
      // For move-only updates (placeFlagMove=true, placeFlagHasCharacter=false),
      // characterId may be 0 — use existing
      const hasCharacter = attr(tag, 'placeFlagHasCharacter') === true
      const isMove = attr(tag, 'placeFlagMove') === true
      const rawCharId = attr(tag, 'characterId')
      const charId = hasCharacter && rawCharId ? rawCharId : existing?.characterId
      if (charId === undefined) continue

      // Parse matrix
      const matrixNode = tag.matrix
      const matrix = matrixNode ? parseMatrixNode(matrixNode) : existing ? { ...existing.matrix } : { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }

      const isCharReplacement =
        isMove && existing && hasCharacter && rawCharId !== undefined && rawCharId !== existing.characterId

      if (isCharReplacement) {
        const oldKey = depth + ':' + existing!.characterId
        const oldP = placements.get(oldKey)
        if (oldP && oldP.visibleRanges.length > 0) {
          const lr = oldP.visibleRanges[oldP.visibleRanges.length - 1]
          if (lr.end === totalFrames - 1) lr.end = Math.max(0, currentFrame - 1)
        }
        displayList.set(depth, { characterId: charId, matrix })
      } else if (!isMove || !existing) {
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
      const depth = attr(tag, 'depth') ?? 0
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
  // Sort by depth ascending: in SWF, higher depth = rendered on top.
  // The renderer processes lower order first (= back), so depth ascending
  // gives the correct z-order: lowest depth at back, highest depth on top.
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

  // Check for bitmap-fill shapes BEFORE regular shapes — a DefineShape with a
  // bitmap fill should render as a shape layer with the bitmap clipped to the
  // shape outline, not as a full rectangular image layer (which shows white corners).
  const charTag = characters.get(charId)
  if (charTag) {
    const tagType = getTagType(charTag)

    if (tagType.includes('DefineText')) {
      return buildTextLayer(charTag, placement, fonts)
    }

    if (tagType.includes('DefineShape')) {
      const bitmapFill = findBitmapFill(charTag)
      if (bitmapFill) {
        const bitmapAsset = imageAssets.get(bitmapFill.bitmapId)
        if (bitmapAsset) {
          // Check if we have the shape outline from SVG extraction
          const shapeOutline = shapeAssets.get(charId)
          if (shapeOutline && shapeOutline.shapeData.paths.length > 0) {
            // Build shape layer with bitmap fill — the shape outline clips the image
            const shapeDataWithBitmap = {
              ...shapeOutline.shapeData,
              paths: shapeOutline.shapeData.paths.map((p) => ({
                ...p,
                // Replace hasBitmapFill marker with actual asset ID
                bitmapFillAssetId: p.hasBitmapFill ? bitmapAsset.id : undefined,
                hasBitmapFill: undefined
              }))
            }
            return buildShapeLayer('Shape ' + charId, shapeDataWithBitmap, placement)
          }

          // Fallback: no shape outline available — render as image layer
          const centerOffsetX = bitmapFill.offsetX + bitmapAsset.width / 2
          const centerOffsetY = bitmapFill.offsetY + bitmapAsset.height / 2
          return buildImageLayer(
            'Image ' + bitmapFill.bitmapId,
            bitmapAsset.id,
            placement,
            centerOffsetX,
            centerOffsetY
          )
        }
      }
    }
  }

  // Check if it's a regular shape (no bitmap fill)
  const shapeAsset = shapeAssets.get(charId)
  if (shapeAsset) {
    return buildShapeLayer('Shape ' + charId, shapeAsset.shapeData, placement)
  }

  return null
}

/**
 * Search a DefineShapeTag for a bitmap fill style.
 * Returns the bitmapId and the bitmapMatrix translation (twips → pixels).
 */
function findBitmapFill(shapeTag: any): { bitmapId: number; offsetX: number; offsetY: number } | null {
  const shapes = shapeTag.shapes || {}
  const fillStyles = shapes.fillStyles || {}
  const fills = fillStyles.fillStyles
  if (!fills) return null

  const fillList = Array.isArray(fills) ? fills : fills.item ? (Array.isArray(fills.item) ? fills.item : [fills.item]) : []
  for (const fill of fillList) {
    const fillType = attr(fill, 'fillStyleType')
    // fillStyleType 64-67 = bitmap fills (clipped/tiled, smoothed/unsmoothed)
    if (fillType !== undefined && fillType >= 64 && fillType <= 67) {
      const bId = attr(fill, 'bitmapId')
      if (bId !== undefined && bId !== 65535) {
        const bitmapMatrix = fill.bitmapMatrix
        const offsetX = bitmapMatrix ? ((attr(bitmapMatrix, 'translateX') ?? 0) as number) / 20 : 0
        const offsetY = bitmapMatrix ? ((attr(bitmapMatrix, 'translateY') ?? 0) as number) / 20 : 0
        return { bitmapId: bId, offsetX, offsetY }
      }
    }
  }
  return null
}

function buildImageLayer(
  name: string,
  assetId: string,
  placement: PlacementData,
  centerOffsetX = 0,
  centerOffsetY = 0
): LayerResult {
  // Apply center offset to position keyframes so the image sprite (anchor 0.5, 0.5)
  // appears at the correct location on stage
  const adjustedFrames = (centerOffsetX || centerOffsetY)
    ? placement.frames.map((f) => ({
        frame: f.frame,
        matrix: {
          ...f.matrix,
          tx: f.matrix.tx + centerOffsetX,
          ty: f.matrix.ty + centerOffsetY
        }
      }))
    : placement.frames

  const contentItemId = nanoid()
  return {
    id: nanoid(),
    name,
    contentItems: [{ id: contentItemId, name, content: { type: 'image', assetId } }],
    contentKeyframes: [{ frame: placement.startFrame, contentItemId }],
    visible: true,
    locked: false,
    order: 0,
    startFrame: placement.startFrame,
    endFrame: placement.endFrame,
    tracks: buildTracks(adjustedFrames)
  }
}

function buildShapeLayer(
  name: string,
  shapeData: ShapeAssetInfo['shapeData'],
  placement: PlacementData
): LayerResult {
  const contentItemId = nanoid()
  return {
    id: nanoid(),
    name,
    contentItems: [{ id: contentItemId, name, content: { type: 'shape', shapeData } }],
    contentKeyframes: [{ frame: placement.startFrame, contentItemId }],
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
  const records = textTag.textRecords || textTag.records || {}
  let text = ''
  let fontName = 'Arial'
  let color = '#000000'
  let fontSize = 24

  const recList = normalizeItemList(records)
  for (const rec of recList) {
    const fontId = attr(rec, 'fontId') ?? attr(rec, 'styleFontId')
    if (fontId !== undefined) {
      const font = fonts.get(fontId)
      if (font) fontName = font.name || 'Arial'
      fontSize = ((attr(rec, 'textHeight') ?? attr(rec, 'styleTextHeight')) || 480) / 20
    }

    const colorNode = rec.textColor || rec.styleTextColor || rec.color
    if (colorNode) {
      const r = attr(colorNode, 'red') ?? 0
      const g = attr(colorNode, 'green') ?? 0
      const b = attr(colorNode, 'blue') ?? 0
      color = rgbToHex(r, g, b)
    }

    const glyphs = rec.glyphEntries || rec.entries || {}
    const glyphList = normalizeItemList(glyphs)
    const fontInfo = fontId !== undefined ? fonts.get(fontId) : null
    for (const glyph of glyphList) {
      const idx = attr(glyph, 'glyphIndex') ?? attr(glyph, 'index') ?? -1
      if (fontInfo && fontInfo.codeUnits && idx >= 0 && idx < fontInfo.codeUnits.length) {
        text += String.fromCharCode(fontInfo.codeUnits[idx])
      }
    }
  }

  if (!text) return null

  return {
    id: nanoid(),
    name: 'Text: ' + text.substring(0, 20),
    contentItems: [],
    contentKeyframes: [],
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

// ── Matrix Parsing ────────────────────────────────────────────────────────

function parseMatrixNode(node: any): Matrix2D {
  // swf2xml format: <matrix type="MATRIX" hasScale="true" scaleX="1.0" scaleY="1.0"
  //   hasRotate="false" rotateSkew0="0.0" rotateSkew1="0.0"
  //   translateX="17361" translateY="7669" />
  const hasScale = attr(node, 'hasScale') === true
  const hasRotate = attr(node, 'hasRotate') === true

  return {
    a: hasScale ? (attr(node, 'scaleX') ?? 1) : 1,
    b: hasRotate ? (attr(node, 'rotateSkew0') ?? 0) : 0,
    c: hasRotate ? (attr(node, 'rotateSkew1') ?? 0) : 0,
    d: hasScale ? (attr(node, 'scaleY') ?? 1) : 1,
    tx: ((attr(node, 'translateX') ?? 0) as number) / 20,
    ty: ((attr(node, 'translateY') ?? 0) as number) / 20
  }
}

// ── XML Helpers ────────────────────────────────────────────────────────────

interface FontInfo {
  id: number
  name: string
  codeUnits: number[]
}

function normalizeTagList(tagsNode: any): any[] {
  if (Array.isArray(tagsNode)) return tagsNode
  if (tagsNode?.item) return Array.isArray(tagsNode.item) ? tagsNode.item : [tagsNode.item]
  return []
}

function normalizeItemList(node: any): any[] {
  if (Array.isArray(node)) return node
  if (node?.item) return Array.isArray(node.item) ? node.item : [node.item]
  return []
}

function getTagType(tag: any): string {
  return tag['@_type'] || tag.type || ''
}

/**
 * Read an attribute from a parsed XML node.
 * fast-xml-parser with attributeNamePrefix='@_' stores attributes as @_name.
 */
function attr(obj: any, key: string): any {
  if (!obj) return undefined
  // Try @_prefixed (attribute)
  const v = obj['@_' + key]
  if (v !== undefined) return v
  // Try plain (child element or parseAttributeValue result)
  return obj[key]
}

function parseFontTag(tag: any, charId: number): FontInfo | null {
  const name = attr(tag, 'fontName') ?? attr(tag, 'fontFamilyName') ?? 'Unknown'

  const codeTable = tag.codeTable || {}
  const codeItems = normalizeItemList(codeTable)
  const codeUnits: number[] = []
  for (const code of codeItems) {
    codeUnits.push(typeof code === 'number' ? code : parseInt(code, 10))
  }

  return { id: charId, name: String(name), codeUnits }
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map((v) => Math.max(0, Math.min(255, v)).toString(16).padStart(2, '0')).join('')
}
