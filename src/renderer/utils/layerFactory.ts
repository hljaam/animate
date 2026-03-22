import type { Layer, Asset, Project, PropertyTrack, TrackProperty, ShapeData, SymbolDef } from '../types/project'
import { generateId } from './idGenerator'
import { computeFitScale } from './autoScale'

function makeTrack(property: TrackProperty, value: number): PropertyTrack {
  return {
    property,
    keyframes: [{ frame: 0, value, easing: 'linear' }]
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
        points: [
          { x: 0, y: 0 },
          { x: width, y: 0 },
          { x: width, y: height },
          { x: 0, y: height }
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
  const segments = 32

  const points: Array<{ x: number; y: number }> = []
  for (let i = 0; i < segments; i++) {
    const angle = (i / segments) * Math.PI * 2
    points.push({
      x: rx + rx * Math.cos(angle),
      y: ry + ry * Math.sin(angle)
    })
  }

  const shapeData: ShapeData = {
    paths: [{ fillColor: '#4a9eff', points }],
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
