import { useEffect, useRef } from 'react'
import { StageRenderer } from '../pixi/StageRenderer'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import type { TrackProperty } from '../types/project'
import { DEFAULT_EASING } from '../types/project'
import type { InterpolatedProps } from '../pixi/interpolation'

export function usePixiStage(containerRef: React.RefObject<HTMLDivElement | null>) {
  const rendererRef = useRef<StageRenderer | null>(null)

  useEffect(() => {
    const container = containerRef.current
    if (!container) return

    let cancelled = false
    let renderer: StageRenderer | null = null
    let unsubProject: (() => void) | null = null
    let unsubEditor: (() => void) | null = null

    // Delay init by one macrotask so React StrictMode's synchronous cleanup
    // runs first (clearing `cancelled = true`) before we ever start PixiJS init.
    // If cleanup fires before this setTimeout, cancelled=true and we skip init entirely.
    const timeoutId = setTimeout(() => {
      if (cancelled) return

      const { project } = useProjectStore.getState()
      const w = project?.width ?? 1920
      const h = project?.height ?? 1080
      const bg = project?.backgroundColor ?? '#000000'

      renderer = new StageRenderer()

      renderer.init(container, w, h, bg).then(() => {
        if (cancelled) {
          safeDestroy(renderer)
          renderer = null
          return
        }

        rendererRef.current = renderer

        renderer!.setCallbacks(
          (layerId, shiftKey) => {
            if (layerId === null) {
              if (!shiftKey) {
                useEditorStore.getState().setSelectedLayerIds([])
              }
            } else if (shiftKey) {
              useEditorStore.getState().toggleLayerSelection(layerId)
            } else {
              useEditorStore.getState().setSelectedLayerId(layerId)
            }
          },
          (layerId, partialProps) => {
            // Live drag — non-undoable direct mutation
            const frame = useEditorStore.getState().currentFrame
            useProjectStore.getState().mutateProject((draft) => {
              const layer = draft.layers.find((l) => l.id === layerId)
              if (!layer) return
              for (const [prop, value] of Object.entries(partialProps) as [TrackProperty, number][]) {
                let track = layer.tracks.find((t) => t.property === prop)
                if (!track) {
                  track = { property: prop, keyframes: [] }
                  layer.tracks.push(track)
                }
                const kfIdx = track.keyframes.findIndex((kf) => kf.frame === frame)
                if (kfIdx === -1) {
                  track.keyframes.push({ frame, value, easing: DEFAULT_EASING })
                  track.keyframes.sort((a, b) => a.frame - b.frame)
                } else {
                  track.keyframes[kfIdx].value = value
                }
              }
            })
          },
          (layerId, before, after) => {
            // Drag end — undoable via applyAction
            // First revert to "before" state so produceWithPatches captures the full diff
            const frame = useEditorStore.getState().currentFrame
            useProjectStore.getState().mutateProject((draft) => {
              const layer = draft.layers.find((l) => l.id === layerId)
              if (!layer) return
              for (const [prop, value] of Object.entries(before) as [TrackProperty, number][]) {
                const track = layer.tracks.find((t) => t.property === prop)
                if (!track) continue
                const kf = track.keyframes.find((k) => k.frame === frame)
                if (kf) kf.value = value
              }
            })
            // Now apply "after" state as an undoable action — patches will capture before→after
            useProjectStore.getState().applyAction('Transform', (draft) => {
              const layer = draft.layers.find((l) => l.id === layerId)
              if (!layer) return
              for (const [prop, value] of Object.entries(after) as [TrackProperty, number][]) {
                let track = layer.tracks.find((t) => t.property === prop)
                if (!track) {
                  track = { property: prop, keyframes: [] }
                  layer.tracks.push(track)
                }
                const kfIdx = track.keyframes.findIndex((kf) => kf.frame === frame)
                if (kfIdx === -1) {
                  track.keyframes.push({ frame, value, easing: DEFAULT_EASING })
                  track.keyframes.sort((a, b) => a.frame - b.frame)
                } else {
                  track.keyframes[kfIdx].value = value
                }
              }
            })
          },
          (layerId, screenX, screenY) => {
            useEditorStore.getState().setCanvasContextMenu({ x: screenX, y: screenY, layerId })
          }
        )

        const ps = useProjectStore.getState()
        const es = useEditorStore.getState()
        if (ps.project) {
          renderer!.setScene(ps.project, es.currentFrame, es.selectedLayerIds)
          const { width, height } = container.getBoundingClientRect()
          renderer!.applyViewport(width, height, ps.project.width, ps.project.height,
            es.zoom, es.panX, es.panY)
        }

        unsubProject = useProjectStore.subscribe((state) => {
          if (!state.project || !renderer) return
          console.log('[usePixiStage] subscription fired, layers=', state.project.layers.length)
          const es = useEditorStore.getState()
          renderer.setScene(state.project, es.currentFrame, es.selectedLayerIds)
        })

        unsubEditor = useEditorStore.subscribe((state) => {
          const ps = useProjectStore.getState()
          if (!ps.project || !renderer) return
          renderer!.setScene(ps.project, state.currentFrame, state.selectedLayerIds)
          const { width, height } = container.getBoundingClientRect()
          renderer!.applyViewport(width, height, ps.project.width, ps.project.height,
            state.zoom, state.panX, state.panY)
        })
      }).catch((err) => {
        console.error('PixiJS init failed:', err)
      })
    }, 0)

    return () => {
      cancelled = true
      clearTimeout(timeoutId)
      unsubProject?.()
      unsubEditor?.()
      safeDestroy(renderer)
      renderer = null
      rendererRef.current = null
    }
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return rendererRef
}

function safeDestroy(renderer: StageRenderer | null): void {
  if (!renderer) return
  try {
    renderer.destroy()
  } catch {
    // Suppress PixiJS internal errors (e.g. _cancelResize) during cleanup
  }
}
