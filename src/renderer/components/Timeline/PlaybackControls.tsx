import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

export default function PlaybackControls(): React.ReactElement {
  const { isPlaying, setIsPlaying, currentFrame, setCurrentFrame } = useEditorStore()
  const project = useProjectStore((s) => s.project)
  const fps = project?.fps ?? 30
  const total = project?.durationFrames ?? 0

  const seconds = total > 0 ? (currentFrame / fps).toFixed(2) : '0.00'
  const totalSeconds = (total / fps).toFixed(2)

  return (
    <div style={styles.controls}>
      <button
        className="icon-btn"
        title="Go to start"
        onClick={() => { setCurrentFrame(0); setIsPlaying(false) }}
        disabled={!project}
      >
        ⏮
      </button>
      <button
        className="icon-btn"
        title="Previous frame"
        onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
        disabled={!project}
      >
        ◀
      </button>
      <button
        style={styles.playBtn}
        title={isPlaying ? 'Pause (Space)' : 'Play (Space)'}
        onClick={() => setIsPlaying(!isPlaying)}
        disabled={!project}
      >
        {isPlaying ? '⏸' : '▶'}
      </button>
      <button
        className="icon-btn"
        title="Next frame"
        onClick={() => setCurrentFrame(Math.min(total - 1, currentFrame + 1))}
        disabled={!project}
      >
        ▶
      </button>
      <span style={styles.timecode}>
        {seconds}s / {totalSeconds}s
      </span>
      <span style={styles.frame}>
        F {currentFrame}
      </span>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 2,
    padding: '0 8px',
    borderRight: '1px solid var(--border)',
    flexShrink: 0
  },
  playBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 4,
    width: 28,
    height: 28,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    fontSize: 14
  },
  timecode: {
    color: 'var(--text-secondary)',
    fontSize: 11,
    fontFamily: 'monospace',
    marginLeft: 8
  },
  frame: {
    color: 'var(--text-muted)',
    fontSize: 10,
    fontFamily: 'monospace'
  }
}
