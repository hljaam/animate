import type {
  Layer,
  ContentItem,
  ContentPayload,
  ShapeData,
  LayerType,
  ShapeObjectDef
} from '../types/project'

/**
 * Get the active ContentItem for a layer at a given frame.
 * Finds the latest contentKeyframe at or before `frame` (hold-by-default),
 * then returns the matching ContentItem from the pool.
 */
export function getActiveContent(layer: Layer, frame: number): ContentItem | undefined {
  const items = layer.contentItems
  const keyframes = layer.contentKeyframes
  if (!keyframes?.length || !items?.length) return undefined

  let activeId: string | undefined
  for (const ck of keyframes) {
    if (ck.frame <= frame) activeId = ck.contentItemId
    else break // contentKeyframes are sorted ascending
  }

  if (!activeId) return undefined
  return items.find((ci) => ci.id === activeId)
}

/**
 * Get the active content payload at a frame.
 */
export function getActiveContentPayload(layer: Layer, frame: number): ContentPayload | undefined {
  return getActiveContent(layer, frame)?.content
}

/**
 * Derive the "primary type" of a layer from its first content keyframe.
 * Text layers have textData set directly (no content items needed).
 */
export function getLayerType(layer: Layer): LayerType {
  if (layer.textData) return 'text'

  // New content model
  if (layer.contentItems?.length && layer.contentKeyframes?.length) {
    const firstKf = layer.contentKeyframes[0]
    const item = layer.contentItems.find((ci) => ci.id === firstKf.contentItemId)
    if (item) {
      switch (item.content.type) {
        case 'image':
          return 'image'
        case 'symbol':
          return 'symbol'
        case 'shape':
        case 'shapeObject':
          return 'shape'
      }
    }
  }

  // Legacy fallback (pre-migration layers)
  if (layer.type) return layer.type

  return 'shape' // empty layer fallback
}

/**
 * Get the ShapeData for a layer at a given frame.
 * Handles inline shape content and shapeObject references (looked up live).
 */
export function getLayerShapeData(
  layer: Layer,
  frame: number,
  shapeObjects?: ShapeObjectDef[]
): ShapeData | undefined {
  const item = getActiveContent(layer, frame)
  if (item) {
    if (item.content.type === 'shape') return item.content.shapeData
    if (item.content.type === 'shapeObject' && shapeObjects) {
      const obj = shapeObjects.find((o) => o.id === item.content.shapeObjectId)
      if (obj) return { paths: obj.paths, originX: obj.originX, originY: obj.originY }
    }
    return undefined
  }

  // Legacy fallback
  return layer.shapeData
}

/**
 * Get the assetId for an image layer at a given frame.
 */
export function getLayerAssetId(layer: Layer, frame: number): string | undefined {
  const item = getActiveContent(layer, frame)
  if (item) {
    return item.content.type === 'image' ? item.content.assetId : undefined
  }
  // Legacy fallback
  return layer.assetId
}

/**
 * Get the symbolId for a symbol layer at a given frame.
 */
export function getLayerSymbolId(layer: Layer, frame: number): string | undefined {
  const item = getActiveContent(layer, frame)
  if (item) {
    return item.content.type === 'symbol' ? item.content.symbolId : undefined
  }
  // Legacy fallback
  return layer.symbolId
}

/**
 * Get the shapeObjectId for a shapeObject layer at a given frame.
 */
export function getLayerShapeObjectId(layer: Layer, frame: number): string | undefined {
  const item = getActiveContent(layer, frame)
  if (item) {
    return item.content.type === 'shapeObject' ? item.content.shapeObjectId : undefined
  }
  // Legacy fallback
  return layer.shapeObjectId
}

/**
 * Check if a layer is a text layer.
 */
export function isTextLayer(layer: Layer): boolean {
  return !!layer.textData
}
