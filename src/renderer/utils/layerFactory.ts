import type { Layer, Asset, Project, PropertyTrack, TrackProperty } from '../types/project'
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
