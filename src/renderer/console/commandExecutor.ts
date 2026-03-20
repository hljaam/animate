import type { Layer } from '../types/project'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import { AddLayerCommand } from '../store/commands/AddLayerCommand'
import { RemoveLayerCommand } from '../store/commands/RemoveLayerCommand'
import { AddKeyframeCommand } from '../store/commands/AddKeyframeCommand'
import { UpdateKeyframeCommand } from '../store/commands/UpdateKeyframeCommand'
import { UpdateLayerCommand } from '../store/commands/UpdateLayerCommand'
import { DuplicateLayerCommand } from '../store/commands/DuplicateLayerCommand'
import { createTextLayer, createImageLayer } from '../utils/layerFactory'
import { getInterpolatedProps } from '../pixi/interpolation'
import { DEFAULT_LAYER_PROPS } from '../types/project'
import type { ParsedCommand } from './commandParser'

export type ExecuteResult = { ok: true } | { error: string }

export type ExportCallback = () => void

function resolveLayer(target: string): { layer: Layer } | { error: string } {
  const projectState = useProjectStore.getState()
  const editorState = useEditorStore.getState()
  const project = projectState.project

  if (!project) return { error: 'No project open' }

  const normalized = target.trim().toLowerCase()

  if (!normalized || normalized === 'selected') {
    const id = editorState.selectedLayerId
    if (!id) return { error: 'No layer selected' }
    const layer = projectState.getLayer(id)
    if (!layer) return { error: 'Selected layer not found' }
    return { layer }
  }

  const matches = project.layers.filter((l) => l.name.toLowerCase() === normalized)
  if (matches.length === 0) return { error: `No layer named "${target}"` }
  if (matches.length > 1) {
    return { error: `Multiple layers named "${target}": ${matches.map((l) => `"${l.name}"`).join(', ')}` }
  }
  return { layer: matches[0] }
}

export function executeCommand(parsed: ParsedCommand, onExport?: ExportCallback): ExecuteResult {
  const projectState = useProjectStore.getState()
  const editorState = useEditorStore.getState()
  const project = projectState.project

  if (!project && parsed.type !== 'frame') {
    return { error: 'No project open' }
  }

  switch (parsed.type) {
    case 'add-text': {
      const layer = createTextLayer(project!)
      layer.textData!.text = parsed.content
      layer.name = parsed.content.slice(0, 40) || 'Text Layer'
      const cmd = new AddLayerCommand(layer)
      projectState.history.push(cmd)
      editorState.setSelectedLayerId(layer.id)
      return { ok: true }
    }

    case 'add-image': {
      const asset = project!.assets.find(
        (a) => a.name.toLowerCase() === parsed.assetName.toLowerCase()
      )
      if (!asset) {
        return { error: `No asset named "${parsed.assetName}". Import it first via the Assets panel.` }
      }
      const layer = createImageLayer(asset, project!)
      const cmd = new AddLayerCommand(layer)
      projectState.history.push(cmd)
      editorState.setSelectedLayerId(layer.id)
      return { ok: true }
    }

    case 'select': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      editorState.setSelectedLayerId(result.layer.id)
      return { ok: true }
    }

    case 'move': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      const current = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
      const before = [
        { layerId: layer.id, property: 'x' as const, frame, value: current.x, easing: 'linear' as const },
        { layerId: layer.id, property: 'y' as const, frame, value: current.y, easing: 'linear' as const }
      ]
      const after = [
        { layerId: layer.id, property: 'x' as const, frame, value: parsed.x, easing: 'linear' as const },
        { layerId: layer.id, property: 'y' as const, frame, value: parsed.y, easing: 'linear' as const }
      ]
      projectState.history.push(new UpdateKeyframeCommand(before, after))
      return { ok: true }
    }

    case 'scale': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      const current = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
      const before = [
        { layerId: layer.id, property: 'scaleX' as const, frame, value: current.scaleX, easing: 'linear' as const },
        { layerId: layer.id, property: 'scaleY' as const, frame, value: current.scaleY, easing: 'linear' as const }
      ]
      const after = [
        { layerId: layer.id, property: 'scaleX' as const, frame, value: parsed.value, easing: 'linear' as const },
        { layerId: layer.id, property: 'scaleY' as const, frame, value: parsed.value, easing: 'linear' as const }
      ]
      projectState.history.push(new UpdateKeyframeCommand(before, after))
      return { ok: true }
    }

    case 'rotate': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      const current = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
      const before = [
        { layerId: layer.id, property: 'rotation' as const, frame, value: current.rotation, easing: 'linear' as const }
      ]
      const after = [
        { layerId: layer.id, property: 'rotation' as const, frame, value: parsed.value, easing: 'linear' as const }
      ]
      projectState.history.push(new UpdateKeyframeCommand(before, after))
      return { ok: true }
    }

    case 'opacity': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      const current = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
      const opacityValue = parsed.value / 100
      const before = [
        { layerId: layer.id, property: 'opacity' as const, frame, value: current.opacity, easing: 'linear' as const }
      ]
      const after = [
        { layerId: layer.id, property: 'opacity' as const, frame, value: opacityValue, easing: 'linear' as const }
      ]
      projectState.history.push(new UpdateKeyframeCommand(before, after))
      return { ok: true }
    }

    case 'frame': {
      editorState.setCurrentFrame(parsed.value)
      return { ok: true }
    }

    case 'keyframe': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      const current = getInterpolatedProps(layer.tracks, frame, DEFAULT_LAYER_PROPS)
      const cmd = new AddKeyframeCommand(layer.id, parsed.property, frame, current[parsed.property])
      projectState.history.push(cmd)
      return { ok: true }
    }

    case 'duplicate': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const cmd = new DuplicateLayerCommand(result.layer)
      projectState.history.push(cmd)
      return { ok: true }
    }

    case 'delete': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const cmd = new RemoveLayerCommand(result.layer)
      projectState.history.push(cmd)
      if (editorState.selectedLayerId === result.layer.id) {
        editorState.setSelectedLayerId(null)
      }
      return { ok: true }
    }

    case 'hide': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const cmd = new UpdateLayerCommand(layer.id, 'visible', layer.visible, !layer.visible)
      projectState.history.push(cmd)
      return { ok: true }
    }

    case 'lock': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const cmd = new UpdateLayerCommand(layer.id, 'locked', layer.locked, !layer.locked)
      projectState.history.push(cmd)
      return { ok: true }
    }

    case 'export-mp4': {
      if (onExport) {
        onExport()
      }
      return { ok: true }
    }

    default:
      return { error: 'Unknown command' }
  }
}
