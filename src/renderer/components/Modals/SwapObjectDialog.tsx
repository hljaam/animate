import React, { useState, useMemo, useRef, useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { generateId } from '../../utils/idGenerator'
import { getLayerType, getLayerShapeObjectId } from '../../utils/layerContent'
import type { ShapePath, ShapeSegment, ShapeObjectDef, ContentItem } from '../../types/project'

// ── Thumbnail sub-component ──────────────────────────────────────────────────

function computeBoundingBox(paths: ShapePath[]): { minX: number; minY: number; maxX: number; maxY: number } {
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  function visit(x: number, y: number): void {
    if (x < minX) minX = x
    if (y < minY) minY = y
    if (x > maxX) maxX = x
    if (y > maxY) maxY = y
  }

  for (const path of paths) {
    for (const seg of path.segments) {
      if (seg.type === 'move' || seg.type === 'line') {
        visit(seg.x, seg.y)
      } else if (seg.type === 'cubic') {
        visit(seg.cx1, seg.cy1)
        visit(seg.cx2, seg.cy2)
        visit(seg.x, seg.y)
      } else if (seg.type === 'quadratic') {
        visit(seg.cx, seg.cy)
        visit(seg.x, seg.y)
      }
    }
    if (path.subPaths) {
      for (const sub of path.subPaths) {
        for (const seg of sub) {
          if (seg.type === 'move' || seg.type === 'line') {
            visit(seg.x, seg.y)
          } else if (seg.type === 'cubic') {
            visit(seg.cx1, seg.cy1)
            visit(seg.cx2, seg.cy2)
            visit(seg.x, seg.y)
          } else if (seg.type === 'quadratic') {
            visit(seg.cx, seg.cy)
            visit(seg.x, seg.y)
          }
        }
      }
    }
  }

  if (!isFinite(minX)) return { minX: 0, minY: 0, maxX: 1, maxY: 1 }
  const w = maxX - minX
  const h = maxY - minY
  if (w < 1) { minX -= 0.5; maxX += 0.5 }
  if (h < 1) { minY -= 0.5; maxY += 0.5 }
  return { minX, minY, maxX, maxY }
}

function traceSegmentsOnCtx(ctx: CanvasRenderingContext2D, segments: ShapeSegment[], ox: number, oy: number): void {
  for (const seg of segments) {
    if (seg.type === 'move') {
      ctx.moveTo(seg.x - ox, seg.y - oy)
    } else if (seg.type === 'line') {
      ctx.lineTo(seg.x - ox, seg.y - oy)
    } else if (seg.type === 'cubic') {
      ctx.bezierCurveTo(seg.cx1 - ox, seg.cy1 - oy, seg.cx2 - ox, seg.cy2 - oy, seg.x - ox, seg.y - oy)
    } else if (seg.type === 'quadratic') {
      ctx.quadraticCurveTo(seg.cx - ox, seg.cy - oy, seg.x - ox, seg.y - oy)
    } else if (seg.type === 'close') {
      ctx.closePath()
    }
  }
}

interface ShapeObjectThumbnailProps {
  paths: ShapePath[]
  originX: number
  originY: number
  size?: number
}

function ShapeObjectThumbnail({ paths, originX, originY, size = 64 }: ShapeObjectThumbnailProps): React.ReactElement {
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    if (!ctx) return

    const dpr = window.devicePixelRatio || 1
    canvas.width = size * dpr
    canvas.height = size * dpr
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    ctx.clearRect(0, 0, size, size)

    if (paths.length === 0) return

    const bbox = computeBoundingBox(paths)
    const bw = bbox.maxX - bbox.minX
    const bh = bbox.maxY - bbox.minY
    const padding = 6
    const drawSize = size - padding * 2
    const scale = Math.min(drawSize / bw, drawSize / bh)
    const cx = padding + (drawSize - bw * scale) / 2
    const cy = padding + (drawSize - bh * scale) / 2

    ctx.save()
    ctx.translate(cx, cy)
    ctx.scale(scale, scale)
    ctx.translate(-bbox.minX, -bbox.minY)

    for (const path of paths) {
      // Draw fill
      if ((path.fillColor || path.bitmapFillAssetId) && path.segments.length >= 2) {
        ctx.beginPath()
        traceSegmentsOnCtx(ctx, path.segments, 0, 0)
        if (path.subPaths) {
          for (const sub of path.subPaths) {
            if (sub.length >= 2) traceSegmentsOnCtx(ctx, sub, 0, 0)
          }
        }
        ctx.fillStyle = path.fillColor || '#888888'
        ctx.fill('evenodd')
      }

      // Draw stroke
      if (path.strokeColor && path.segments.length >= 2) {
        ctx.beginPath()
        traceSegmentsOnCtx(ctx, path.segments, 0, 0)
        ctx.strokeStyle = path.strokeColor
        ctx.lineWidth = (path.strokeWidth || 1) / scale
        ctx.lineJoin = 'round'
        ctx.lineCap = 'round'
        ctx.stroke()
      }
    }

    ctx.restore()
  }, [paths, originX, originY, size])

  return (
    <canvas
      ref={canvasRef}
      style={{ width: size, height: size, borderRadius: 4, background: 'var(--bg-primary)' }}
    />
  )
}

// ── Grouping logic ───────────────────────────────────────────────────────────

interface GroupedObjects {
  sameUnitSections: { unitName: string; objects: ShapeObjectDef[] }[]
  otherObjects: ShapeObjectDef[]
}

function computeGroupedObjects(
  allObjects: ShapeObjectDef[],
  units: { id: string; name: string; shapeObjectIds: string[] }[],
  currentObjectId: string,
  searchQuery: string
): GroupedObjects {
  const lowerQuery = searchQuery.toLowerCase().trim()
  const filtered = lowerQuery
    ? allObjects.filter((o) => o.name.toLowerCase().includes(lowerQuery))
    : allObjects

  const unitsContainingCurrent = units.filter((u) =>
    u.shapeObjectIds.includes(currentObjectId)
  )

  const sameUnitObjectIds = new Set<string>()
  const sameUnitSections: GroupedObjects['sameUnitSections'] = []

  for (const unit of unitsContainingCurrent) {
    const objectsInUnit = filtered.filter(
      (o) => unit.shapeObjectIds.includes(o.id) && !sameUnitObjectIds.has(o.id)
    )
    if (objectsInUnit.length > 0) {
      sameUnitSections.push({ unitName: unit.name, objects: objectsInUnit })
      objectsInUnit.forEach((o) => sameUnitObjectIds.add(o.id))
    }
  }

  const otherObjects = filtered.filter((o) => !sameUnitObjectIds.has(o.id))

  return { sameUnitSections, otherObjects }
}

// ── Main dialog ──────────────────────────────────────────────────────────────

export default function SwapObjectDialog(): React.ReactElement | null {
  const dialogData = useEditorStore((s) => s.showSwapObjectDialog)
  const setDialog = useEditorStore((s) => s.setShowSwapObjectDialog)
  const project = useProjectStore((s) => s.project)

  const [searchQuery, setSearchQuery] = useState('')
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)

  const allObjects = project?.shapeObjects ?? []
  const units = project?.units ?? []

  const layerName = useMemo(() => {
    if (!dialogData || !project) return ''
    const layer = project.layers.find((l) => l.id === dialogData.layerId)
    return layer?.name ?? ''
  }, [dialogData, project])

  const grouped = useMemo(() => {
    if (!dialogData) return { sameUnitSections: [], otherObjects: allObjects }
    return computeGroupedObjects(allObjects, units, dialogData.currentObjectId, searchQuery)
  }, [allObjects, units, dialogData, searchQuery])

  const totalVisible = grouped.sameUnitSections.reduce((n, s) => n + s.objects.length, 0) + grouped.otherObjects.length

  function handleSwap(): void {
    if (!dialogData || !selectedObjectId) return
    const project = useProjectStore.getState().project
    if (!project) return

    const newObject = project.shapeObjects?.find((o) => o.id === selectedObjectId)
    if (!newObject) return

    const currentFrame = useEditorStore.getState().currentFrame
    const sourceLayer = project.layers.find((l) => l.id === dialogData.layerId)
    if (!sourceLayer) return

    const oldName = dialogData.currentObjectId
      ? project.shapeObjects?.find((o) => o.id === dialogData.currentObjectId)?.name ?? 'object'
      : sourceLayer.name

    const isFrameAware = currentFrame > sourceLayer.startFrame

    // If the ShapeObjectDef has an associated symbol (from independent animation),
    // swap to that symbol to preserve internal animation. Otherwise use the static shapeObject.
    const newItem: ContentItem = newObject.symbolId
      ? {
          id: generateId(),
          name: newObject.name,
          content: { type: 'symbol', symbolId: newObject.symbolId }
        }
      : {
          id: generateId(),
          name: newObject.name,
          content: { type: 'shapeObject', shapeObjectId: selectedObjectId }
        }

    useProjectStore.getState().applyAction(
      `Swap object "${oldName}" → "${newObject.name}"` +
        (isFrameAware ? ` at frame ${currentFrame}` : ''),
      (draft) => {
        const layer = draft.layers.find((l) => l.id === dialogData.layerId)
        if (!layer) return

        if (isFrameAware) {
          // ── Frame-aware swap: add content item + keyframe at current frame ──
          if (!layer.contentItems) layer.contentItems = []
          layer.contentItems.push(newItem as any)

          if (!layer.contentKeyframes) layer.contentKeyframes = []
          layer.contentKeyframes.push({ frame: currentFrame, contentItemId: newItem.id } as any)
          layer.contentKeyframes.sort((a: any, b: any) => a.frame - b.frame)
        } else {
          // ── Full replacement at layer start ──
          layer.contentItems = [newItem] as any
          layer.contentKeyframes = [{ frame: sourceLayer.startFrame, contentItemId: newItem.id }] as any
          layer.name = newObject.name
        }
      }
    )

    setDialog(null)
  }

  function handleCancel(): void {
    setDialog(null)
  }

  if (!dialogData) return null

  const canSwap = selectedObjectId != null && selectedObjectId !== dialogData.currentObjectId

  function renderObjectCard(obj: ShapeObjectDef): React.ReactElement {
    const isCurrent = obj.id === dialogData!.currentObjectId
    const isSelected = obj.id === selectedObjectId

    return (
      <button
        key={obj.id}
        onClick={() => { if (!isCurrent) setSelectedObjectId(obj.id) }}
        style={{
          ...styles.card,
          borderColor: isCurrent
            ? '#e89b4e'
            : isSelected
              ? 'var(--accent)'
              : 'var(--border)',
          background: isSelected && !isCurrent ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
          cursor: isCurrent ? 'default' : 'pointer',
          opacity: isCurrent ? 0.7 : 1
        }}
      >
        <ShapeObjectThumbnail paths={obj.paths} originX={obj.originX} originY={obj.originY} size={64} />
        <span style={styles.cardName} title={obj.name}>
          {obj.name}
        </span>
        {isCurrent && (
          <span style={styles.currentBadge}>current</span>
        )}
      </button>
    )
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleCancel() }}>
      <DialogContent className="min-w-[480px] max-w-[520px]">
        <DialogHeader>
          <DialogTitle>Swap Object</DialogTitle>
        </DialogHeader>

        <p style={styles.subtitle}>
          Swap object on layer <strong>{layerName}</strong>
        </p>

        <Input
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Filter objects..."
          autoFocus
        />

        <div style={styles.scrollArea}>
          {totalVisible === 0 && (
            <p style={styles.emptyState}>No matching objects</p>
          )}

          {grouped.sameUnitSections.map((section) => (
            <div key={section.unitName}>
              <div style={styles.sectionHeader}>{section.unitName}</div>
              <div style={styles.grid}>
                {section.objects.map(renderObjectCard)}
              </div>
            </div>
          ))}

          {grouped.otherObjects.length > 0 && (
            <div>
              {grouped.sameUnitSections.length > 0 && (
                <div style={styles.sectionHeader}>All Objects</div>
              )}
              <div style={styles.grid}>
                {grouped.otherObjects.map(renderObjectCard)}
              </div>
            </div>
          )}
        </div>

        <DialogFooter className="mt-4">
          <Button variant="default" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSwap} disabled={!canSwap}>Swap</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────

const styles: Record<string, React.CSSProperties> = {
  subtitle: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 8
  },
  scrollArea: {
    marginTop: 8,
    maxHeight: 350,
    overflowY: 'auto',
    overflowX: 'hidden'
  },
  sectionHeader: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: '0.04em',
    padding: '8px 2px 4px',
    borderBottom: '1px solid var(--border)',
    marginBottom: 6
  },
  grid: {
    display: 'grid',
    gridTemplateColumns: 'repeat(4, 1fr)',
    gap: 6,
    marginBottom: 8
  },
  card: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    padding: 6,
    borderRadius: 6,
    border: '2px solid var(--border)',
    transition: 'border-color 0.1s, background 0.1s',
    minHeight: 'auto',
    minWidth: 0
  },
  cardName: {
    fontSize: 11,
    color: 'var(--text-primary)',
    marginTop: 4,
    maxWidth: '100%',
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap',
    textAlign: 'center'
  },
  currentBadge: {
    fontSize: 9,
    color: '#e89b4e',
    fontWeight: 600,
    marginTop: 2
  },
  emptyState: {
    fontSize: 12,
    color: 'var(--text-muted)',
    textAlign: 'center',
    padding: '32px 0'
  }
}
