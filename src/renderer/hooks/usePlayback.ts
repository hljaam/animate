import { useEffect, useRef } from 'react'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'

export function usePlayback(): void {
  const rafRef = useRef<number | null>(null)
  const lastTimeRef = useRef<number>(0)

  useEffect(() => {
    const unsub = useEditorStore.subscribe((state) => {
      if (state.isPlaying) {
        startPlayback()
      } else {
        stopPlayback()
      }
    })

    return () => {
      unsub()
      stopPlayback()
    }
  }, [])

  function startPlayback(): void {
    if (rafRef.current !== null) return
    lastTimeRef.current = performance.now()

    function tick(time: number): void {
      const { isPlaying, currentFrame, setCurrentFrame, setIsPlaying, loopPlayback } = useEditorStore.getState()
      const { project } = useProjectStore.getState()

      if (!isPlaying || !project) {
        rafRef.current = null
        return
      }

      const fps = project.fps
      const elapsed = time - lastTimeRef.current

      if (elapsed >= 1000 / fps) {
        lastTimeRef.current = time - (elapsed % (1000 / fps))
        const nextFrame = currentFrame + 1

        if (nextFrame >= project.durationFrames) {
          if (loopPlayback) {
            setCurrentFrame(0)
          } else {
            setCurrentFrame(project.durationFrames - 1)
            setIsPlaying(false)
            rafRef.current = null
            return
          }
        } else {
          setCurrentFrame(nextFrame)
        }
      }

      rafRef.current = requestAnimationFrame(tick)
    }

    rafRef.current = requestAnimationFrame(tick)
  }

  function stopPlayback(): void {
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current)
      rafRef.current = null
    }
  }
}
