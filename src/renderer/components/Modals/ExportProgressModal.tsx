import React, { useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '../ui/dialog'
import { Progress } from '../ui/progress'

export default function ExportProgressModal(): React.ReactElement {
  const { exportProgress, setExportProgress } = useEditorStore()

  useEffect(() => {
    const cleanup = window.electronAPI.onExportProgress((percent) => {
      setExportProgress(percent)
    })
    return cleanup
  }, [])

  return (
    <Dialog open>
      <DialogContent className="min-w-[360px] text-center">
        <DialogHeader>
          <DialogTitle>Exporting MP4...</DialogTitle>
          <DialogDescription>
            Please wait while your video is being exported.
          </DialogDescription>
        </DialogHeader>
        <Progress value={exportProgress} />
        <div className="mt-2 text-sm text-text-secondary">
          {exportProgress}%
        </div>
      </DialogContent>
    </Dialog>
  )
}
