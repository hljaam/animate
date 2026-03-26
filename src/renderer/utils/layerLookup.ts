import type { Project } from '../types/project'

/**
 * Find layer IDs on canvas that reference a given symbol or shape object.
 * Tries ID match first, then falls back to name match.
 */
export function findLayersByReference(
  project: Project,
  itemType: 'symbol' | 'shapeObject',
  itemId: string
): string[] {
  const ids: string[] = []

  if (itemType === 'shapeObject') {
    const obj = project.shapeObjects?.find((o) => o.id === itemId)
    const objName = obj?.name
    for (const l of project.layers) {
      if (l.shapeObjectId === itemId) { ids.push(l.id); continue }
      if (objName && l.name === objName) { ids.push(l.id) }
    }
  } else {
    const sym = project.symbols?.find((s) => s.id === itemId)
    const symName = sym?.name
    for (const l of project.layers) {
      if (l.symbolId === itemId) { ids.push(l.id); continue }
      if (symName && l.name === symName) { ids.push(l.id) }
    }
  }

  return ids
}
