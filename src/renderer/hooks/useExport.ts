import { useCallback } from 'react'
import { useProjectStore } from '../store/projectStore'
import { useEditorStore } from '../store/editorStore'
import { StageRenderer } from '../pixi/StageRenderer'

export function useExport() {
  const exportProject = useCallback(async () => {
    const { project } = useProjectStore.getState()
    const { setIsExporting, setExportProgress, setCurrentFrame } = useEditorStore.getState()

    if (!project) return

    setIsExporting(true)
    setExportProgress(0)

    const api = (window as unknown as { electronAPI: import('../types/electronAPI').ElectronAPI }).electronAPI

    try {
      // Create a hidden container for the export renderer
      const exportContainer = document.createElement('div')
      exportContainer.style.cssText = `position:fixed;left:-9999px;top:-9999px;width:${project.width}px;height:${project.height}px;overflow:hidden;`
      document.body.appendChild(exportContainer)

      const exportRenderer = new StageRenderer()
      await exportRenderer.init(exportContainer, project.width, project.height, project.backgroundColor)

      await api.exportStart({
        projectId: project.id,
        fps: project.fps,
        width: project.width,
        height: project.height
      })

      // Render each frame
      for (let frame = 0; frame < project.durationFrames; frame++) {
        setCurrentFrame(frame)

        exportRenderer.setScene(project, frame, null)
        // Force immediate render by calling app.renderer.render
        exportRenderer.app.renderer.render(exportRenderer.app.stage)

        // Extract pixels as RGBA
        const pixels = exportRenderer.app.renderer.extract.pixels(exportRenderer.app.stage)
        const pixelsArray = Array.from(pixels)

        await api.exportFrame({
          frame,
          pixels: pixelsArray,
          width: project.width,
          height: project.height
        })

        setExportProgress(Math.round(((frame + 1) / project.durationFrames) * 90))
      }

      // Finalize
      const result = await api.exportFinalize({
        projectId: project.id,
        totalFrames: project.durationFrames
      })

      exportRenderer.destroy()
      document.body.removeChild(exportContainer)

      setExportProgress(100)

      if (!result.success) {
        console.error('Export failed:', result.error)
      }
    } catch (err) {
      console.error('Export error:', err)
    } finally {
      setIsExporting(false)
    }
  }, [])

  return { exportProject }
}
