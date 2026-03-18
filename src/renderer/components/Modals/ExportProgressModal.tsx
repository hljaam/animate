import React, { useEffect } from 'react'
import { useEditorStore } from '../../store/editorStore'

export default function ExportProgressModal(): React.ReactElement {
  const { exportProgress, setExportProgress } = useEditorStore()

  useEffect(() => {
    const cleanup = window.electronAPI.onExportProgress((percent) => {
      setExportProgress(percent)
    })
    return cleanup
  }, [])

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: 360, textAlign: 'center' }}>
        <h2>Exporting MP4…</h2>
        <p style={{ color: 'var(--text-secondary)', marginBottom: 20 }}>
          Please wait while your video is being exported.
        </p>
        <div style={styles.progressBar}>
          <div
            style={{
              ...styles.progressFill,
              width: `${exportProgress}%`
            }}
          />
        </div>
        <div style={{ marginTop: 8, color: 'var(--text-secondary)', fontSize: 12 }}>
          {exportProgress}%
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  progressBar: {
    width: '100%',
    height: 8,
    background: 'var(--bg-primary)',
    borderRadius: 4,
    overflow: 'hidden',
    border: '1px solid var(--border)'
  },
  progressFill: {
    height: '100%',
    background: 'var(--accent)',
    transition: 'width 0.3s ease',
    borderRadius: 4
  }
}
