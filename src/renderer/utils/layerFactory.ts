import type { Layer, Asset, Project, PropertyTrack, TrackProperty, ShapeData, ShapeSegment, SymbolDef, ShapeObjectDef } from '../types/project'
import { DEFAULT_EASING } from '../types/project'
import { generateId } from './idGenerator'
import { computeFitScale } from './autoScale'

function makeTrack(property: TrackProperty, value: number): PropertyTrack {
  return {
    property,
    keyframes: [{ frame: 0, value, easing: DEFAULT_EASING }]
  }
}

export function createImageLayer(asset: Asset, project: Project): Layer {
  const scale = computeFitScale(asset.width, asset.height, project.width, project.height)
  const cx = project.width / 2
  const cy = project.height / 2

  const layerCount = project.layers.length

  return {
    id: generateId(),
    name: asset.name,
    type: 'image',
    assetId: asset.id,
    visible: true,
    locked: false,
    order: layerCount,
    startFrame: 0,
    endFrame: project.durationFrames - 1,
    tracks: [
      makeTrack('x', cx),
      makeTrack('y', cy),
      makeTrack('scaleX', scale),
      makeTrack('scaleY', scale),
      makeTrack('rotation', 0),
      makeTrack('opacity', 1)
    ]
  }
}

export function createRectangleLayer(project: Project, width = 200, height = 150): Layer {
  const cx = project.width / 2
  const cy = project.height / 2
  const layerCount = project.layers.length

  const shapeData: ShapeData = {
    paths: [
      {
        fillColor: '#4a9eff',
        segments: [
          { type: 'move', x: 0, y: 0 },
          { type: 'line', x: width, y: 0 },
          { type: 'line', x: width, y: height },
          { type: 'line', x: 0, y: height },
          { type: 'close' }
        ]
      }
    ],
    originX: width / 2,
    originY: height / 2
  }

  return {
    id: generateId(),
    name: 'Rectangle',
    type: 'shape',
    shapeData,
    visible: true,
    locked: false,
    order: layerCount,
    startFrame: 0,
    endFrame: project.durationFrames - 1,
    tracks: [
      makeTrack('x', cx),
      makeTrack('y', cy),
      makeTrack('scaleX', 1),
      makeTrack('scaleY', 1),
      makeTrack('rotation', 0),
      makeTrack('opacity', 1)
    ]
  }
}

export function createEllipseLayer(project: Project, width = 200, height = 150): Layer {
  const cx = project.width / 2
  const cy = project.height / 2
  const layerCount = project.layers.length
  const rx = width / 2
  const ry = height / 2
  // Approximate ellipse with 4 cubic bezier arcs (kappa constant)
  const k = 0.5522847498
  const kx = rx * k
  const ky = ry * k

  const segments: ShapeSegment[] = [
    { type: 'move', x: rx, y: 0 },
    { type: 'cubic', cx1: rx + kx, cy1: 0, cx2: width, cy2: ry - ky, x: width, y: ry },
    { type: 'cubic', cx1: width, cy1: ry + ky, cx2: rx + kx, cy2: height, x: rx, y: height },
    { type: 'cubic', cx1: rx - kx, cy1: height, cx2: 0, cy2: ry + ky, x: 0, y: ry },
    { type: 'cubic', cx1: 0, cy1: ry - ky, cx2: rx - kx, cy2: 0, x: rx, y: 0 },
    { type: 'close' }
  ]

  const shapeData: ShapeData = {
    paths: [{ fillColor: '#4a9eff', segments }],
    originX: rx,
    originY: ry
  }

  return {
    id: generateId(),
    name: 'Ellipse',
    type: 'shape',
    shapeData,
    visible: true,
    locked: false,
    order: layerCount,
    startFrame: 0,
    endFrame: project.durationFrames - 1,
    tracks: [
      makeTrack('x', cx),
      makeTrack('y', cy),
      makeTrack('scaleX', 1),
      makeTrack('scaleY', 1),
      makeTrack('rotation', 0),
      makeTrack('opacity', 1)
    ]
  }
}

export function createSymbolLayer(symbolDef: SymbolDef, project: Project): Layer {
  const cx = project.width / 2
  const cy = project.height / 2
  const layerCount = project.layers.length

  return {
    id: generateId(),
    name: symbolDef.name,
    type: 'symbol',
    symbolId: symbolDef.id,
    visible: true,
    locked: false,
    order: layerCount,
    startFrame: 0,
    endFrame: project.durationFrames - 1,
    tracks: [
      makeTrack('x', cx),
      makeTrack('y', cy),
      makeTrack('scaleX', 1),
      makeTrack('scaleY', 1),
      makeTrack('rotation', 0),
      makeTrack('opacity', 1)
    ]
  }
}

export function createShapeObjectLayer(shapeObj: ShapeObjectDef, project: Project): Layer {
  const cx = project.width / 2
  const cy = project.height / 2
  const layerCount = project.layers.length

  const shapeData: ShapeData = {
    paths: JSON.parse(JSON.stringify(shapeObj.paths)),
    originX: shapeObj.originX,
    originY: shapeObj.originY
  }

  return {
    id: generateId(),
    name: shapeObj.name,
    type: 'shape',
    shapeData,
    visible: true,
    locked: false,
    order: layerCount,
    startFrame: 0,
    endFrame: project.durationFrames - 1,
    tracks: [
      makeTrack('x', cx),
      makeTrack('y', cy),
      makeTrack('scaleX', 1),
      makeTrack('scaleY', 1),
      makeTrack('rotation', 0),
      makeTrack('opacity', 1)
    ]
  }
}

export function createTextLayer(project: Project): Layer {
  const cx = project.width / 2
  const cy = project.height / 2
  const layerCount = project.layers.length

  return {
    id: generateId(),
    name: 'Text Layer',
    type: 'text',
    textData: {
      text: 'Edit me',
      font: 'Arial',
      color: '#ffffff',
      size: 72
    },
    visible: true,
    locked: false,
    order: layerCount,
    startFrame: 0,
    endFrame: project.durationFrames - 1,
    tracks: [
      makeTrack('x', cx),
      makeTrack('y', cy),
      makeTrack('scaleX', 1),
      makeTrack('scaleY', 1),
      makeTrack('rotation', 0),
      makeTrack('opacity', 1)
    ]
  }
}
