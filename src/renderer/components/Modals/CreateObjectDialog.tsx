import React, { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { generateId } from '../../utils/idGenerator'
import type { ShapePath, ShapeSegment, ShapeObjectDef, ShapeData, PropertyTrack, Layer, SymbolDef } from '../../types/project'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'

/** Offset all x/y coordinates in a segment by (dx, dy) */
function offsetSegment(seg: ShapeSegment, dx: number, dy: number): ShapeSegment {
  switch (seg.type) {
    case 'move':
      return { type: 'move', x: seg.x + dx, y: seg.y + dy }
    case 'line':
      return { type: 'line', x: seg.x + dx, y: seg.y + dy }
    case 'cubic':
      return { type: 'cubic', cx1: seg.cx1 + dx, cy1: seg.cy1 + dy, cx2: seg.cx2 + dx, cy2: seg.cy2 + dy, x: seg.x + dx, y: seg.y + dy }
    case 'quadratic':
      return { type: 'quadratic', cx: seg.cx + dx, cy: seg.cy + dy, x: seg.x + dx, y: seg.y + dy }
    case 'close':
      return seg
  }
}

/** Offset all segments in a path (including subPaths) */
function offsetPath(path: ShapePath, dx: number, dy: number): ShapePath {
  const result: ShapePath = {
    ...path,
    segments: path.segments.map((s) => offsetSegment(s, dx, dy))
  }
  if (path.subPaths) {
    result.subPaths = path.subPaths.map((sp) => sp.map((s) => offsetSegment(s, dx, dy)))
  }
  return result
}

export default function CreateObjectDialog(): React.ReactElement {
  const dialogData = useEditorStore((s) => s.showCreateObjectDialog)
  const setDialog = useEditorStore((s) => s.setShowCreateObjectDialog)
  const [name, setName] = useState('')

  function handleCreate(): void {
    const trimmed = name.trim()
    if (!trimmed || !dialogData) return

    const project = useProjectStore.getState().project
    if (!project) return

    // First pass: compute each layer's world-space top-left and collect info
    interface LayerInfo {
      paths: ShapePath[]
      originX: number
      originY: number
      worldX: number
      worldY: number
    }
    const layerInfos: LayerInfo[] = []

    for (const layerId of dialogData.layerIds) {
      const layer = project.layers.find((l) => l.id === layerId)
      if (!layer) continue

      const xTrack = layer.tracks.find((t) => t.property === 'x')
      const yTrack = layer.tracks.find((t) => t.property === 'y')
      const worldX = xTrack?.keyframes[0]?.value ?? 0
      const worldY = yTrack?.keyframes[0]?.value ?? 0

      if (layer.type === 'shape' && layer.shapeData) {
        layerInfos.push({
          paths: JSON.parse(JSON.stringify(layer.shapeData.paths)),
          originX: layer.shapeData.originX,
          originY: layer.shapeData.originY,
          worldX,
          worldY
        })
      } else if (layer.type === 'symbol' && layer.symbolId && project.symbols) {
        const symDef = project.symbols.find((s) => s.id === layer.symbolId)
        if (symDef) {
          for (const innerLayer of symDef.layers) {
            if (innerLayer.type === 'shape' && innerLayer.shapeData) {
              layerInfos.push({
                paths: JSON.parse(JSON.stringify(innerLayer.shapeData.paths)),
                originX: innerLayer.shapeData.originX,
                originY: innerLayer.shapeData.originY,
                worldX,
                worldY
              })
            }
          }
        }
      } else if (layer.type === 'image' && layer.assetId) {
        const asset = project.assets.find((a) => a.id === layer.assetId)
        if (asset) {
          const w = asset.width
          const h = asset.height
          const segments: ShapeSegment[] = [
            { type: 'move', x: 0, y: 0 },
            { type: 'line', x: w, y: 0 },
            { type: 'line', x: w, y: h },
            { type: 'line', x: 0, y: h },
            { type: 'close' }
          ]
          layerInfos.push({
            paths: [{ segments, bitmapFillAssetId: layer.assetId }],
            originX: w / 2,
            originY: h / 2,
            worldX,
            worldY
          })
        }
      }
    }

    if (layerInfos.length === 0) return

    let minWX = Infinity, minWY = Infinity
    let maxWX = -Infinity, maxWY = -Infinity
    for (const info of layerInfos) {
      const topLeftX = info.worldX - info.originX
      const topLeftY = info.worldY - info.originY
      for (const path of info.paths) {
        for (const seg of path.segments) {
          if ('x' in seg && 'y' in seg) {
            const wx = topLeftX + seg.x
            const wy = topLeftY + seg.y
            minWX = Math.min(minWX, wx)
            minWY = Math.min(minWY, wy)
            maxWX = Math.max(maxWX, wx)
            maxWY = Math.max(maxWY, wy)
          }
          if ('cx1' in seg) {
            minWX = Math.min(minWX, topLeftX + seg.cx1)
            minWY = Math.min(minWY, topLeftY + seg.cy1)
            maxWX = Math.max(maxWX, topLeftX + seg.cx1)
            maxWY = Math.max(maxWY, topLeftY + seg.cy1)
            minWX = Math.min(minWX, topLeftX + seg.cx2)
            minWY = Math.min(minWY, topLeftY + seg.cy2)
            maxWX = Math.max(maxWX, topLeftX + seg.cx2)
            maxWY = Math.max(maxWY, topLeftY + seg.cy2)
          }
          if ('cx' in seg) {
            minWX = Math.min(minWX, topLeftX + seg.cx)
            minWY = Math.min(minWY, topLeftY + seg.cy)
            maxWX = Math.max(maxWX, topLeftX + seg.cx)
            maxWY = Math.max(maxWY, topLeftY + seg.cy)
          }
        }
      }
    }

    const centerWX = (minWX + maxWX) / 2
    const centerWY = (minWY + maxWY) / 2
    const combinedOriginX = centerWX - minWX
    const combinedOriginY = centerWY - minWY

    const allPaths: ShapePath[] = []
    for (const info of layerInfos) {
      const topLeftX = info.worldX - info.originX
      const topLeftY = info.worldY - info.originY
      const dx = topLeftX - minWX
      const dy = topLeftY - minWY
      for (const path of info.paths) {
        allPaths.push(offsetPath(path, dx, dy))
      }
    }

    const sourceLayers = dialogData.layerIds
      .map((id) => project.layers.find((l) => l.id === id))
      .filter((l): l is NonNullable<typeof l> => !!l)

    const objectStartFrame = Math.min(...sourceLayers.map((l) => l.startFrame))
    const objectEndFrame = Math.max(...sourceLayers.map((l) => l.endFrame))

    const hasIndependentAnimation = sourceLayers.length > 1 && sourceLayers.some((l) => {
      const xTrack = l.tracks.find((t) => t.property === 'x')
      const yTrack = l.tracks.find((t) => t.property === 'y')
      return (xTrack && xTrack.keyframes.length > 1) || (yTrack && yTrack.keyframes.length > 1)
    })

    const replacementLayerId = generateId()

    if (hasIndependentAnimation) {
      const innerLayers: Layer[] = []
      const consumedSymbolIds: string[] = []

      for (const sl of sourceLayers) {
        if (sl.type === 'symbol' && sl.symbolId && project.symbols) {
          const symDef = project.symbols.find((s) => s.id === sl.symbolId)
          if (symDef) {
            consumedSymbolIds.push(sl.symbolId)
            for (const inner of symDef.layers) {
              const merged: Layer = JSON.parse(JSON.stringify(inner))
              merged.id = generateId()
              for (const prop of ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity'] as const) {
                const outerTrack = sl.tracks.find((t) => t.property === prop)
                if (!outerTrack) continue
                const innerTrack = merged.tracks.find((t) => t.property === prop)
                if (innerTrack) {
                  innerTrack.keyframes = outerTrack.keyframes.map((kf) => ({ ...kf }))
                } else {
                  merged.tracks.push({ ...outerTrack, keyframes: outerTrack.keyframes.map((kf) => ({ ...kf })) })
                }
              }
              merged.startFrame = sl.startFrame
              merged.endFrame = sl.endFrame
              merged.order = innerLayers.length
              innerLayers.push(merged)
            }
          }
        } else {
          const copy: Layer = JSON.parse(JSON.stringify(sl))
          copy.id = generateId()
          copy.order = innerLayers.length
          innerLayers.push(copy)
        }
      }

      const symDuration = Math.max(...innerLayers.map((l) => l.endFrame + 1), 1)

      const symbolId = generateId()
      const symbolDef: SymbolDef = {
        id: symbolId,
        name: trimmed,
        libraryItemName: trimmed,
        fps: project.fps,
        durationFrames: symDuration,
        layers: innerLayers
      }

      const defaultTracks: PropertyTrack[] = [
        { property: 'x', keyframes: [{ frame: 0, value: 0, easing: 'step' }] },
        { property: 'y', keyframes: [{ frame: 0, value: 0, easing: 'step' }] },
        { property: 'scaleX', keyframes: [{ frame: 0, value: 1, easing: 'step' }] },
        { property: 'scaleY', keyframes: [{ frame: 0, value: 1, easing: 'step' }] },
        { property: 'rotation', keyframes: [{ frame: 0, value: 0, easing: 'step' }] },
        { property: 'opacity', keyframes: [{ frame: 0, value: 1, easing: 'step' }] }
      ]

      const replacementLayer = {
        id: replacementLayerId,
        name: trimmed,
        type: 'symbol' as const,
        symbolId,
        visible: true,
        locked: false,
        order: 0,
        startFrame: objectStartFrame,
        endFrame: objectEndFrame,
        tracks: defaultTracks
      }

      const objectId = generateId()
      const shapeObject: ShapeObjectDef = {
        id: objectId,
        name: trimmed,
        paths: allPaths,
        originX: combinedOriginX,
        originY: combinedOriginY,
        layers: []
      }

      useProjectStore.getState().applyAction(`Save object "${trimmed}"`, (draft) => {
        if (!draft.shapeObjects) draft.shapeObjects = []
        draft.shapeObjects.push(shapeObject)
        if (!draft.symbols) draft.symbols = []
        draft.symbols.push(symbolDef as any)
        if (consumedSymbolIds.length > 0) {
          draft.symbols = draft.symbols.filter(
            (s) => !consumedSymbolIds.includes(s.id)
          )
          if (!draft.symbols.find((s) => s.id === symbolId)) {
            draft.symbols.push(symbolDef as any)
          }
        }
        const minOrder = Math.min(
          ...dialogData.layerIds.map((id) => draft.layers.find((l) => l.id === id)?.order ?? Infinity)
        )
        draft.layers = draft.layers.filter((l) => !dialogData.layerIds.includes(l.id))
        replacementLayer.order = minOrder
        draft.layers.push(replacementLayer as any)
        draft.layers.sort((a, b) => a.order - b.order)
      })
    } else {
      const firstSrc = sourceLayers[0]
      const objectTracks: PropertyTrack[] = JSON.parse(JSON.stringify(firstSrc.tracks))

      const srcXTrack = firstSrc.tracks.find((t: PropertyTrack) => t.property === 'x')
      const srcYTrack = firstSrc.tracks.find((t: PropertyTrack) => t.property === 'y')
      const srcBaseX = srcXTrack?.keyframes[0]?.value ?? 0
      const srcBaseY = srcYTrack?.keyframes[0]?.value ?? 0
      const deltaX = centerWX - srcBaseX
      const deltaY = centerWY - srcBaseY

      for (const track of objectTracks) {
        if (track.property === 'x') {
          for (const kf of track.keyframes) kf.value += deltaX
        } else if (track.property === 'y') {
          for (const kf of track.keyframes) kf.value += deltaY
        }
      }

      const objectId = generateId()
      const shapeObject: ShapeObjectDef = {
        id: objectId,
        name: trimmed,
        paths: allPaths,
        originX: combinedOriginX,
        originY: combinedOriginY,
        layers: sourceLayers.map((l) => JSON.parse(JSON.stringify(l)))
      }

      const replacementLayer = {
        id: replacementLayerId,
        name: trimmed,
        type: 'shape' as const,
        shapeObjectId: objectId,
        shapeData: {
          paths: JSON.parse(JSON.stringify(allPaths)),
          originX: combinedOriginX,
          originY: combinedOriginY
        } as ShapeData,
        visible: true,
        locked: false,
        order: 0,
        startFrame: objectStartFrame,
        endFrame: objectEndFrame,
        tracks: objectTracks
      }

      useProjectStore.getState().applyAction(`Save object "${trimmed}"`, (draft) => {
        if (!draft.shapeObjects) draft.shapeObjects = []
        draft.shapeObjects.push(shapeObject)
        const minOrder = Math.min(
          ...dialogData.layerIds.map((id) => draft.layers.find((l) => l.id === id)?.order ?? Infinity)
        )
        draft.layers = draft.layers.filter((l) => !dialogData.layerIds.includes(l.id))
        replacementLayer.order = minOrder
        draft.layers.push(replacementLayer as any)
        draft.layers.sort((a, b) => a.order - b.order)
      })
    }

    useEditorStore.getState().setSelectedLayerId(replacementLayerId)
    setDialog(null)
  }

  function handleCancel(): void {
    setDialog(null)
  }

  function handleKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter' && name.trim()) handleCreate()
    if (e.key === 'Escape') handleCancel()
  }

  if (!dialogData) return null as unknown as React.ReactElement

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleCancel() }}>
      <DialogContent className="min-w-[340px]">
        <DialogHeader>
          <DialogTitle>Save to Objects</DialogTitle>
        </DialogHeader>

        <div className="flex items-center gap-1.5 mb-5">
          <Label className="w-[70px] shrink-0">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Object name"
            autoFocus
          />
        </div>

        <DialogFooter>
          <Button variant="default" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate} disabled={!name.trim()}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
