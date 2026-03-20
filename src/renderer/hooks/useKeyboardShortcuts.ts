import { useEffect } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import { RemoveLayerCommand } from '../store/commands/RemoveLayerCommand'

export function useKeyboardShortcuts(): void {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent): void {
      const tag = (e.target as HTMLElement).tagName.toLowerCase()
      // Don't intercept when typing in inputs
      if (tag === 'input' || tag === 'textarea') return

      const { history } = useProjectStore.getState()
      const { isPlaying, setIsPlaying, selectedLayerId } = useEditorStore.getState()

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

      if (e.key === ' ') {
        e.preventDefault()
        setIsPlaying(!isPlaying)
        return
      }

      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (!selectedLayerId) return
        const layer = useProjectStore.getState().getLayer(selectedLayerId)
        if (!layer) return
        const cmd = new RemoveLayerCommand(layer)
        useProjectStore.getState().history.push(cmd)
        useEditorStore.getState().setSelectedLayerId(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [])
}
