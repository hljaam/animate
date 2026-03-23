import * as PIXI from 'pixi.js'

export type HandleType =
  | 'scale-tl' | 'scale-tr' | 'scale-bl' | 'scale-br'
  | 'scale-t' | 'scale-b' | 'scale-l' | 'scale-r'
  | 'rotate'

export type DragMode = HandleType | 'move' | 'none'

interface HandleDef {
  type: HandleType
  /** Position as fraction of bounds: [0,0] = top-left, [1,1] = bottom-right */
  anchor: [number, number]
  size: number
  cursor: string
}

const CORNER_SIZE = 8
const EDGE_SIZE = 6
const ROTATE_DISTANCE = 18

const HANDLE_DEFS: HandleDef[] = [
  { type: 'scale-tl', anchor: [0, 0], size: CORNER_SIZE, cursor: 'nwse-resize' },
  { type: 'scale-tr', anchor: [1, 0], size: CORNER_SIZE, cursor: 'nesw-resize' },
  { type: 'scale-bl', anchor: [0, 1], size: CORNER_SIZE, cursor: 'nesw-resize' },
  { type: 'scale-br', anchor: [1, 1], size: CORNER_SIZE, cursor: 'nwse-resize' },
  { type: 'scale-t', anchor: [0.5, 0], size: EDGE_SIZE, cursor: 'ns-resize' },
  { type: 'scale-b', anchor: [0.5, 1], size: EDGE_SIZE, cursor: 'ns-resize' },
  { type: 'scale-l', anchor: [0, 0.5], size: EDGE_SIZE, cursor: 'ew-resize' },
  { type: 'scale-r', anchor: [1, 0.5], size: EDGE_SIZE, cursor: 'ew-resize' },
]

interface Rect {
  x: number
  y: number
  width: number
  height: number
}

export class TransformHandles {
  private container: PIXI.Graphics
  private bounds: Rect | null = null
  /** Screen-space positions of each handle, for hit testing */
  private handlePositions = new Map<HandleType, { x: number; y: number; size: number }>()

  constructor(parent: PIXI.Container) {
    this.container = new PIXI.Graphics()
    parent.addChild(this.container)
  }

  /**
   * Draw handles around the given screen-space bounds.
   * Call this after drawing the selection bounding box.
   */
  draw(bounds: Rect): void {
    this.container.clear()
    this.bounds = bounds
    this.handlePositions.clear()

    for (const def of HANDLE_DEFS) {
      const x = bounds.x + bounds.width * def.anchor[0]
      const y = bounds.y + bounds.height * def.anchor[1]
      const half = def.size / 2

      // White fill with dark border
      this.container
        .rect(x - half, y - half, def.size, def.size)
        .fill({ color: 0xffffff, alpha: 1 })
      this.container
        .rect(x - half, y - half, def.size, def.size)
        .stroke({ color: 0x4a9eff, width: 1, alpha: 1 })

      this.handlePositions.set(def.type, { x, y, size: def.size })
    }
  }

  clear(): void {
    this.container.clear()
    this.bounds = null
    this.handlePositions.clear()
  }

  /**
   * Test if a screen-space point hits a handle or rotation zone.
   * Returns the handle type, or null if nothing hit.
   */
  hitTest(globalX: number, globalY: number): HandleType | null {
    // Check handles first (higher priority)
    for (const [type, pos] of this.handlePositions) {
      const half = pos.size / 2 + 3 // add a few pixels of tolerance
      if (
        globalX >= pos.x - half && globalX <= pos.x + half &&
        globalY >= pos.y - half && globalY <= pos.y + half
      ) {
        return type
      }
    }

    // Check rotation zones (just outside corners)
    if (this.bounds) {
      const corners = [
        { x: this.bounds.x, y: this.bounds.y },
        { x: this.bounds.x + this.bounds.width, y: this.bounds.y },
        { x: this.bounds.x, y: this.bounds.y + this.bounds.height },
        { x: this.bounds.x + this.bounds.width, y: this.bounds.y + this.bounds.height },
      ]
      const cx = this.bounds.x + this.bounds.width / 2
      const cy = this.bounds.y + this.bounds.height / 2

      for (const corner of corners) {
        const dx = globalX - corner.x
        const dy = globalY - corner.y
        const dist = Math.sqrt(dx * dx + dy * dy)

        // Check if point is outside the bounds but within ROTATE_DISTANCE of a corner
        const isOutside =
          globalX < this.bounds.x - 2 || globalX > this.bounds.x + this.bounds.width + 2 ||
          globalY < this.bounds.y - 2 || globalY > this.bounds.y + this.bounds.height + 2

        if (isOutside && dist < ROTATE_DISTANCE) {
          return 'rotate'
        }
      }
    }

    return null
  }

  /**
   * Get the cursor style for a given handle type.
   */
  getCursor(type: HandleType | null): string {
    if (!type) return ''
    if (type === 'rotate') return 'crosshair'
    const def = HANDLE_DEFS.find((d) => d.type === type)
    return def?.cursor ?? ''
  }

  /**
   * Get the opposite anchor point for scaling (in world space).
   * When scaling from a handle, the opposite corner is the fixed anchor.
   */
  getOppositeAnchor(type: HandleType, bounds: Rect): { x: number; y: number } {
    const map: Record<string, [number, number]> = {
      'scale-tl': [1, 1],
      'scale-tr': [0, 1],
      'scale-bl': [1, 0],
      'scale-br': [0, 0],
      'scale-t': [0.5, 1],
      'scale-b': [0.5, 0],
      'scale-l': [1, 0.5],
      'scale-r': [0, 0.5],
    }
    const anchor = map[type] ?? [0.5, 0.5]
    return {
      x: bounds.x + bounds.width * anchor[0],
      y: bounds.y + bounds.height * anchor[1],
    }
  }

  /**
   * Get the center of the current bounds (for rotation pivot).
   */
  getCenter(): { x: number; y: number } {
    if (!this.bounds) return { x: 0, y: 0 }
    return {
      x: this.bounds.x + this.bounds.width / 2,
      y: this.bounds.y + this.bounds.height / 2,
    }
  }
}
