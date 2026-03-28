import type { Layer, Project, ContentItem, ContentKeyframe, SymbolDef, ShapeObjectDef } from '../types/project'
import { generateId } from './idGenerator'

/**
 * Check if a layer still uses the old format (has `type` field, no `contentItems`).
 */
function needsLayerMigration(layer: Layer): boolean {
  return (layer as any).type != null && !layer.contentItems?.length
}

/**
 * Migrate a single layer from the old fixed-type format to the new
 * contentItems/contentKeyframes format.
 */
function migrateLayer(layer: Layer): Layer {
  if (!needsLayerMigration(layer)) return layer

  const oldType = (layer as any).type as string
  const contentItems: ContentItem[] = []
  const contentKeyframes: ContentKeyframe[] = []

  if (oldType === 'text') {
    // Text layers: textData stays as direct property, no content items
    // (no-op for content system)
  } else if (oldType === 'image' && layer.assetId) {
    const primaryId = generateId()
    contentItems.push({
      id: primaryId,
      name: layer.name,
      content: { type: 'image', assetId: layer.assetId }
    })
    contentKeyframes.push({ frame: layer.startFrame, contentItemId: primaryId })

    // Migrate assetSwaps into additional content items + keyframes
    if (layer.assetSwaps?.length) {
      for (const swap of layer.assetSwaps) {
        const swapItemId = generateId()
        contentItems.push({
          id: swapItemId,
          name: `Swap ${swap.assetId}`,
          content: { type: 'image', assetId: swap.assetId }
        })
        contentKeyframes.push({ frame: swap.startFrame, contentItemId: swapItemId })
        // If swap ends before layer ends, revert to primary
        if (swap.endFrame < layer.endFrame) {
          contentKeyframes.push({ frame: swap.endFrame + 1, contentItemId: primaryId })
        }
      }
    }
  } else if (oldType === 'shape') {
    if (layer.shapeObjectId) {
      // Shape object reference layer
      const primaryId = generateId()
      contentItems.push({
        id: primaryId,
        name: layer.name,
        content: { type: 'shapeObject', shapeObjectId: layer.shapeObjectId }
      })
      contentKeyframes.push({ frame: layer.startFrame, contentItemId: primaryId })
    } else if (layer.shapeData) {
      // Inline shape data
      const primaryId = generateId()
      contentItems.push({
        id: primaryId,
        name: layer.name,
        content: { type: 'shape', shapeData: layer.shapeData }
      })
      contentKeyframes.push({ frame: layer.startFrame, contentItemId: primaryId })
    }

    // Migrate shapeObjectSwaps
    if (layer.shapeObjectSwaps?.length) {
      for (const swap of layer.shapeObjectSwaps) {
        const swapItemId = generateId()
        contentItems.push({
          id: swapItemId,
          name: `Swap`,
          content: { type: 'shapeObject', shapeObjectId: swap.shapeObjectId }
        })
        contentKeyframes.push({ frame: swap.frame, contentItemId: swapItemId })
      }
    }
  } else if (oldType === 'symbol' && layer.symbolId) {
    const primaryId = generateId()
    contentItems.push({
      id: primaryId,
      name: layer.name,
      content: { type: 'symbol', symbolId: layer.symbolId }
    })
    contentKeyframes.push({ frame: layer.startFrame, contentItemId: primaryId })

    // Migrate shapeObjectSwaps on symbol layers
    if (layer.shapeObjectSwaps?.length) {
      for (const swap of layer.shapeObjectSwaps) {
        const swapItemId = generateId()
        contentItems.push({
          id: swapItemId,
          name: `Swap`,
          content: { type: 'shapeObject', shapeObjectId: swap.shapeObjectId }
        })
        contentKeyframes.push({ frame: swap.frame, contentItemId: swapItemId })
      }
    }
  }

  // Sort keyframes by frame
  contentKeyframes.sort((a, b) => a.frame - b.frame)

  return {
    ...layer,
    contentItems,
    contentKeyframes
  }
}

/**
 * Migrate all layers in a project from old format to new content model.
 * Also recurses into SymbolDef.layers and ShapeObjectDef.layers.
 * Idempotent: skips layers that already have contentItems.
 */
export function migrateProject(project: Project): Project {
  const needsMigration = project.layers.some(needsLayerMigration) ||
    project.symbols?.some((s) => s.layers.some(needsLayerMigration)) ||
    project.shapeObjects?.some((o) => o.layers?.some(needsLayerMigration))

  if (!needsMigration) return project

  const migratedLayers = project.layers.map(migrateLayer)

  const migratedSymbols = project.symbols?.map((sym: SymbolDef) => ({
    ...sym,
    layers: sym.layers.map(migrateLayer)
  }))

  const migratedShapeObjects = project.shapeObjects?.map((obj: ShapeObjectDef) => ({
    ...obj,
    layers: obj.layers?.map(migrateLayer)
  }))

  return {
    ...project,
    layers: migratedLayers,
    symbols: migratedSymbols,
    shapeObjects: migratedShapeObjects
  }
}
