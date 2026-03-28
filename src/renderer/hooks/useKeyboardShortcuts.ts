import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import { copyLayers, getClipboard } from '../store/clipboardStore'
import { generateId } from '../utils/idGenerator'
import { getClipboardCenter } from '../store/clipboardStore'
import { getInterpolatedProps } from '../pixi/interpolation'
import type { Layer, EasingType } from '../types/project'
import { DEFAULT_LAYER_PROPS, ALL_TRACK_PROPERTIES, DEFAULT_EASING } from '../types/project'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      // Don't intercept when typing in inputs
      if (tag === 'input' || tag === 'textarea') return

      const { history } = useProjectStore.getState()
      const { isPlaying, setIsPlaying, selectedLayerIds, currentFrame, setCurrentFrame } = useEditorStore.getState()

      if (e.ctrlKey || e.metaKey) {
        if (e.key === '0') {
          e.preventDefault()
          const { fitZoom, setViewport } = useEditorStore.getState()
          setViewport(fitZoom, 0, 0)
          return
        }
        if (e.key === '1') {
          e.preventDefault()
          useEditorStore.getState().setViewport(1, 0, 0)
          return
        }
        if (e.key === 'k') {
          e.preventDefault()
          useEditorStore.getState().setShowCommandConsole(true)
          return
        }
        if (e.key === 'a') {
          e.preventDefault()
          const project = useProjectStore.getState().project
          if (project) {
            useEditorStore.getState().setSelectedLayerIds(project.layers.map((l) => l.id))
          }
          return
        }
        if (e.key === 'c') {
          e.preventDefault()
          if (selectedLayerIds.length > 0) {
            const layers = selectedLayerIds
              .map((id) => useProjectStore.getState().getLayer(id))
              .filter((l): l is NonNullable<typeof l> => l != null)
            if (layers.length > 0) copyLayers(layers)
          }
          return
        }
        if (e.key === 'v') {
          e.preventDefault()
          const clipboard = getClipboard()
          if (clipboard.length > 0) {
            const project = useProjectStore.getState().project
            const maxOrder = project ? Math.max(...project.layers.map((l) => l.order), 0) : 0
            const cloneIds: string[] = []
            useProjectStore.getState().applyAction(
              clipboard.length === 1 ? `Paste layer "${clipboard[0].name}"` : `Paste ${clipboard.length} layers`,
              (draft) => {
                for (let i = 0; i < clipboard.length; i++) {
                  const clone: Layer = {
                    ...JSON.parse(JSON.stringify(clipboard[i])),
                    id: generateId(),
                    name: `${clipboard[i].name} copy`,
                    order: maxOrder + 1 + i
                  }
                  cloneIds.push(clone.id)
                  draft.layers.push(clone)
                  draft.layers.sort((a, b) => a.order - b.order)
                }
              }
            )
            useEditorStore.getState().setSelectedLayerIds(cloneIds)
          }
          return
        }
        if (e.key === 'z' && !e.shiftKey) {
          e.preventDefault()
          history.undo()
        } else if (e.key === 'z' && e.shiftKey) {
          e.preventDefault()
          history.redo()
        } else if (e.key === 'y') {
          e.preventDefault()
          history.redo()
        }
        return
      }

      // Space is handled by StageContainer (hold=pan, tap=play toggle)

      // F5 — Insert Frame (extend selected layers by 1)
      // Shift+F5 — Remove Frame (shrink selected layers by 1)
      if (e.key === 'F5') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        if (!project || selectedLayerIds.length === 0) return

        if (e.shiftKey) {
          useProjectStore.getState().applyAction('Remove frame', (draft) => {
            for (const layerId of selectedLayerIds) {
              const layer = draft.layers.find((l) => l.id === layerId)
              if (!layer) continue
              if (layer.endFrame > layer.startFrame) layer.endFrame -= 1
              for (const track of layer.tracks) {
                track.keyframes = track.keyframes.filter((kf) => kf.frame <= layer.endFrame)
              }
            }
          })
        } else {
          useProjectStore.getState().applyAction('Insert frame', (draft) => {
            for (const layerId of selectedLayerIds) {
              const layer = draft.layers.find((l) => l.id === layerId)
              if (!layer) continue
              if (currentFrame > layer.endFrame) {
                layer.endFrame = currentFrame
              } else {
                layer.endFrame += 1
              }
            }
            const maxEnd = Math.max(...draft.layers.map((l) => l.endFrame))
            if (maxEnd >= draft.durationFrames) draft.durationFrames = maxEnd + 1
          })
        }
        return
      }

      // F6 — Insert Keyframe on selected layer, extend it to cover this frame
      if (e.key === 'F6') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        if (!project || selectedLayerIds.length === 0) return
        const layerId = selectedLayerIds[0]
        const layer = project.layers.find((l) => l.id === layerId)
        if (!layer) return
        const hasKf = layer.tracks.some((t) => t.keyframes.some((k) => k.frame === currentFrame))
        if (hasKf) return
        const interpolated = getInterpolatedProps(layer.tracks, currentFrame, DEFAULT_LAYER_PROPS)
        let inheritEasing: EasingType = DEFAULT_EASING
        for (const track of layer.tracks) {
          const before = [...track.keyframes]
            .filter((k) => k.frame <= currentFrame)
            .sort((a, b) => b.frame - a.frame)[0]
          if (before && before.easing !== 'step') {
            inheritEasing = before.easing
            break
          }
        }
        useProjectStore.getState().applyAction(`Insert keyframe at frame ${currentFrame}`, (draft) => {
          const draftLayer = draft.layers.find((l) => l.id === layerId)
          if (!draftLayer) return
          for (const prop of ALL_TRACK_PROPERTIES) {
            let track = draftLayer.tracks.find((t) => t.property === prop)
            if (!track) {
              track = { property: prop, keyframes: [] }
              draftLayer.tracks.push(track)
            }
            track.keyframes.push({ frame: currentFrame, value: interpolated[prop], easing: inheritEasing })
            track.keyframes.sort((a, b) => a.frame - b.frame)
          }
          if (draftLayer.endFrame < currentFrame + 1) draftLayer.endFrame = currentFrame + 1
          const maxEnd = Math.max(...draft.layers.map((l) => l.endFrame))
          if (maxEnd >= draft.durationFrames) draft.durationFrames = maxEnd + 1
        })
        return
      }

      // F7 — Insert Blank Keyframe on selected layer, extend it to cover this frame
      if (e.key === 'F7') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        if (!project || selectedLayerIds.length === 0) return
        const layerId = selectedLayerIds[0]
        useProjectStore.getState().applyAction(`Insert blank keyframe at frame ${currentFrame}`, (draft) => {
          const draftLayer = draft.layers.find((l) => l.id === layerId)
          if (!draftLayer) return
          for (const prop of ALL_TRACK_PROPERTIES) {
            let track = draftLayer.tracks.find((t) => t.property === prop)
            if (!track) {
              track = { property: prop, keyframes: [] }
              draftLayer.tracks.push(track)
            }
            track.keyframes = track.keyframes.filter((k) => k.frame !== currentFrame)
            track.keyframes.push({ frame: currentFrame, value: DEFAULT_LAYER_PROPS[prop], easing: DEFAULT_EASING })
            track.keyframes.sort((a, b) => a.frame - b.frame)
          }
          if (draftLayer.endFrame < currentFrame + 1) draftLayer.endFrame = currentFrame + 1
          const maxEnd = Math.max(...draft.layers.map((l) => l.endFrame))
          if (maxEnd >= draft.durationFrames) draft.durationFrames = maxEnd + 1
        })
        return
      }

      if (e.key === 'h' || e.key === 'H') {
        e.preventDefault()
        const { activeTool, setActiveTool } = useEditorStore.getState()
        setActiveTool(activeTool === 'hand' ? 'select' : 'hand')
        return
      }

      if (e.key === 'v' || e.key === 'V') {
        e.preventDefault()
        useEditorStore.getState().setActiveTool('select')
        return
      }

      // Comma — Previous frame
      if (e.key === ',') {
        e.preventDefault()
        setCurrentFrame(Math.max(0, currentFrame - 1))
        return
      }

      // Period — Next frame
      if (e.key === '.') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        if (project) {
          setCurrentFrame(Math.min(project.durationFrames - 1, currentFrame + 1))
        }
        return
      }

      // Enter — Toggle play/pause
      if (e.key === 'Enter') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
        return
      }

      // Arrow keys: step frames
      if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
        e.preventDefault()
        const project = useProjectStore.getState().project
        if (!project) return
        const maxFrame = project.durationFrames - 1

        if (e.shiftKey && selectedLayerIds.length > 0) {
          // Shift+Arrow: jump to prev/next keyframe on selected layer
          const layer = useProjectStore.getState().getLayer(selectedLayerIds[0])
          if (!layer) return
          const allFrames = new Set<number>()
          for (const track of layer.tracks) {
            for (const kf of track.keyframes) allFrames.add(kf.frame)
          }
          const sorted = [...allFrames].sort((a, b) => a - b)
          if (e.key === 'ArrowLeft') {
            const prev = sorted.filter((f) => f < currentFrame)
            if (prev.length > 0) setCurrentFrame(prev[prev.length - 1])
          } else {
            const next = sorted.filter((f) => f > currentFrame)
            if (next.length > 0) setCurrentFrame(next[0])
          }
        } else {
          if (e.key === 'ArrowLeft') {
            setCurrentFrame(Math.max(0, currentFrame - 1))
          } else {
            setCurrentFrame(Math.min(maxFrame, currentFrame + 1))
          }
        }
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedLayerIds.length === 0) return
        const layers = selectedLayerIds
          .map((id) => useProjectStore.getState().getLayer(id))
          .filter((l): l is NonNullable<typeof l> => l != null)
        if (layers.length > 0) {
          useEditorStore.getState().setSelectedLayerIds([])
          const layerIds = layers.map((l) => l.id)
          const desc = layers.length === 1 ? `Remove layer "${layers[0].name}"` : `Remove ${layers.length} layers`
          useProjectStore.getState().applyAction(desc, (draft) => {
            draft.layers = draft.layers.filter((l) => !layerIds.includes(l.id))
          })
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
