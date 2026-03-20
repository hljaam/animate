import { useEffect, useRef } from 'react'
import { StageRenderer } from '../pixi/StageRenderer'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import type { TrackProperty } from '../types/project'

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
          (layerId) => {
            useEditorStore.getState().setSelectedLayerId(layerId)
          },
          (layerId, partialProps) => {
            const frame = useEditorStore.getState().currentFrame
            for (const [prop, value] of Object.entries(partialProps) as [TrackProperty, number][]) {
              useProjectStore.getState().setKeyframeDirect(layerId, prop, frame, value, 'linear')
            }
          }
        )

        const ps = useProjectStore.getState()
        const es = useEditorStore.getState()
        if (ps.project) {
          renderer!.setScene(ps.project, es.currentFrame, es.selectedLayerId)
          const { width, height } = container.getBoundingClientRect()
          renderer!.applyViewport(width, height, ps.project.width, ps.project.height,
            es.zoom, es.panX, es.panY)
        }

        unsubProject = useProjectStore.subscribe((state) => {
          if (!state.project || !renderer) return
          const es = useEditorStore.getState()
          renderer.setScene(state.project, es.currentFrame, es.selectedLayerId)
        })

        unsubEditor = useEditorStore.subscribe((state) => {
          const ps = useProjectStore.getState()
          if (!ps.project || !renderer) return
          renderer!.setScene(ps.project, state.currentFrame, state.selectedLayerId)
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
