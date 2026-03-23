import type { Layer } from '../types/project'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import { createTextLayer, createImageLayer } from '../utils/layerFactory'
import { getInterpolatedProps } from '../pixi/interpolation'
import { DEFAULT_LAYER_PROPS } from '../types/project'
import type { ParsedCommand } from './commandParser'
import { parseCommand } from './commandParser'
import { generateId } from '../utils/idGenerator'

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
      projectState.applyAction(`Add layer "${layer.name}"`, (draft) => {
        draft.layers.push(layer)
        draft.layers.sort((a, b) => a.order - b.order)
      })
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
      projectState.applyAction(`Add layer "${layer.name}"`, (draft) => {
        draft.layers.push(layer)
        draft.layers.sort((a, b) => a.order - b.order)
      })
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
      projectState.applyAction('Move', (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (!draftLayer) return
        setKeyframeOnDraft(draftLayer, 'x', frame, parsed.x)
        setKeyframeOnDraft(draftLayer, 'y', frame, parsed.y)
      })
      return { ok: true }
    }

    case 'scale': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      projectState.applyAction('Scale', (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (!draftLayer) return
        setKeyframeOnDraft(draftLayer, 'scaleX', frame, parsed.value)
        setKeyframeOnDraft(draftLayer, 'scaleY', frame, parsed.value)
      })
      return { ok: true }
    }

    case 'rotate': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      projectState.applyAction('Rotate', (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (!draftLayer) return
        setKeyframeOnDraft(draftLayer, 'rotation', frame, parsed.value)
      })
      return { ok: true }
    }

    case 'opacity': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      const frame = editorState.currentFrame
      const opacityValue = parsed.value / 100
      projectState.applyAction('Opacity', (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (!draftLayer) return
        setKeyframeOnDraft(draftLayer, 'opacity', frame, opacityValue)
      })
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
      projectState.applyAction(`Add keyframe on ${parsed.property} at frame ${frame}`, (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (!draftLayer) return
        setKeyframeOnDraft(draftLayer, parsed.property, frame, current[parsed.property])
      })
      return { ok: true }
    }

    case 'duplicate': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const clone = {
        ...JSON.parse(JSON.stringify(result.layer)),
        id: generateId(),
        name: `${result.layer.name} copy`,
        order: result.layer.order + 1
      }
      projectState.applyAction(`Duplicate layer "${result.layer.name}"`, (draft) => {
        draft.layers.push(clone)
        draft.layers.sort((a, b) => a.order - b.order)
      })
      return { ok: true }
    }

    case 'delete': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const layerId = result.layer.id
      projectState.applyAction(`Remove layer "${result.layer.name}"`, (draft) => {
        draft.layers = draft.layers.filter((l) => l.id !== layerId)
      })
      if (editorState.selectedLayerId === layerId) {
        editorState.setSelectedLayerId(null)
      }
      return { ok: true }
    }

    case 'hide': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      projectState.applyAction(`Update layer visible`, (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (draftLayer) draftLayer.visible = !layer.visible
      })
      return { ok: true }
    }

    case 'lock': {
      const result = resolveLayer(parsed.target)
      if ('error' in result) return result
      const { layer } = result
      projectState.applyAction(`Update layer locked`, (draft) => {
        const draftLayer = draft.layers.find((l) => l.id === layer.id)
        if (draftLayer) draftLayer.locked = !layer.locked
      })
      return { ok: true }
    }

    case 'export-mp4': {
      if (onExport) {
        onExport()
      }
      return { ok: true }
    }

    case 'run': {
      // Handled async in executeCommandAsync
      return { ok: true }
    }

    default:
      return { error: 'Unknown command' }
  }
}

/** Helper: set or update a keyframe on a draft layer (Immer-safe mutation) */
function setKeyframeOnDraft(draftLayer: Layer, property: string, frame: number, value: number, easing: string = 'step'): void {
  let track = draftLayer.tracks.find((t) => t.property === property)
  if (!track) {
    track = { property: property as any, keyframes: [] }
    draftLayer.tracks.push(track)
  }
  const kfIdx = track.keyframes.findIndex((kf) => kf.frame === frame)
  if (kfIdx === -1) {
    track.keyframes.push({ frame, value, easing: easing as any })
    track.keyframes.sort((a, b) => a.frame - b.frame)
  } else {
    track.keyframes[kfIdx].value = value
    track.keyframes[kfIdx].easing = easing as any
  }
}

/** Run a batch script file — opens file dialog, reads .txt/.md, executes line by line */
export async function runBatchScript(onExport?: ExportCallback): Promise<ExecuteResult> {
  const result = await window.electronAPI.openScript()
  if (!result) return { ok: true } // user cancelled

  const lines = result.content.split('\n')
  for (let i = 0; i < lines.length; i++) {
    const trimmed = lines[i].trim()
    if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith('//')) continue

    const parseResult = parseCommand(trimmed)
    if ('error' in parseResult) {
      return { error: `Line ${i + 1}: ${parseResult.error}\n→ ${trimmed}` }
    }

    // Nested run not allowed
    if (parseResult.ok.type === 'run') {
      return { error: `Line ${i + 1}: nested "run" not allowed` }
    }

    const execResult = executeCommand(parseResult.ok, onExport)
    if ('error' in execResult) {
      return { error: `Line ${i + 1}: ${execResult.error}\n→ ${trimmed}` }
    }
  }

  return { ok: true }
}
