import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

export default function PlaybackControls(): React.ReactElement {
  const { isPlaying, setIsPlaying, currentFrame, setCurrentFrame } = useEditorStore()
  const project = useProjectStore((s) => s.project)
  const fps = project?.fps ?? 24
  const total = project?.durationFrames ?? 0
  const loopPlayback = useEditorStore((s) => s.loopPlayback)
  const setLoopPlayback = useEditorStore((s) => s.setLoopPlayback)
  const onionSkinEnabled = useEditorStore((s) => s.onionSkinEnabled)
  const setOnionSkinEnabled = useEditorStore((s) => s.setOnionSkinEnabled)

  // SMPTE timecode format: HH:MM:SS:FF
  function toSMPTE(frame: number): string {
    const totalSeconds = Math.floor(frame / fps)
    const ff = frame % fps
    const ss = totalSeconds % 60
    const mm = Math.floor(totalSeconds / 60) % 60
    const hh = Math.floor(totalSeconds / 3600)
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}:${String(ss).padStart(2, '0')}:${String(ff).padStart(2, '0')}`
  }

  return (
    <div style={styles.controls}>
      {/* Transport buttons */}
      <div style={styles.transport}>
        <button
          className="icon-btn"
          title="Go to start"
          onClick={() => { setCurrentFrame(0); setIsPlaying(false) }}
          disabled={!project}
          style={styles.transportBtn}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M3 3v8M6 7l5-4v8L6 7z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className="icon-btn"
          title="Previous frame (,)"
          onClick={() => setCurrentFrame(Math.max(0, currentFrame - 1))}
          disabled={!project}
          style={styles.transportBtn}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M9 3L4 7l5 4V3z" fill="currentColor"/>
          </svg>
        </button>
        <button
          style={styles.playBtn}
          title={isPlaying ? 'Pause (Space/Enter)' : 'Play (Space/Enter)'}
          onClick={() => setIsPlaying(!isPlaying)}
          disabled={!project}
        >
          {isPlaying ? (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <rect x="4" y="3" width="3" height="10" rx="0.5" fill="#fff"/>
              <rect x="9" y="3" width="3" height="10" rx="0.5" fill="#fff"/>
            </svg>
          ) : (
            <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
              <path d="M5 3l8 5-8 5V3z" fill="#fff"/>
            </svg>
          )}
        </button>
        <button
          className="icon-btn"
          title="Next frame (.)"
          onClick={() => setCurrentFrame(Math.min(total - 1, currentFrame + 1))}
          disabled={!project}
          style={styles.transportBtn}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M5 3l5 4-5 4V3z" fill="currentColor"/>
          </svg>
        </button>
        <button
          className="icon-btn"
          title="Go to end"
          onClick={() => { setCurrentFrame(Math.max(0, total - 1)); setIsPlaying(false) }}
          disabled={!project}
          style={styles.transportBtn}
        >
          <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
            <path d="M11 3v8M8 7L3 3v8l5-4z" fill="currentColor"/>
          </svg>
        </button>
      </div>

      {/* Timecode */}
      <div style={styles.timecodeWrap}>
        <span style={styles.timecode}>{toSMPTE(currentFrame)}</span>
        <span style={styles.timecodeLabel}>TIMECODE</span>
      </div>

      <div style={styles.sep} />

      {/* FPS */}
      <div style={styles.fpsWrap}>
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="7" cy="7" r="5" stroke="currentColor" strokeWidth="1.2"/>
          <path d="M7 4v3l2 2" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
        </svg>
        <span style={styles.fpsLabel}>{fps} FPS</span>
      </div>

      <div style={styles.sep} />

      {/* Loop toggle */}
      <div
        style={{ ...styles.loopWrap, color: loopPlayback ? 'var(--accent)' : 'var(--text-muted)', cursor: 'pointer' }}
        onClick={() => setLoopPlayback(!loopPlayback)}
        title={loopPlayback ? 'Loop On (click to disable)' : 'Loop Off (click to enable)'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <path d="M2 7a5 5 0 019-3M12 7a5 5 0 01-9 3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
          <path d="M10 2l1 2-2 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
          <path d="M4 12l-1-2 2 0" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 500 }}>{loopPlayback ? 'Loop' : 'Once'}</span>
      </div>

      <div style={styles.sep} />

      {/* Onion Skin toggle */}
      <div
        style={{ ...styles.loopWrap, color: onionSkinEnabled ? '#4ade80' : 'var(--text-muted)', cursor: 'pointer' }}
        onClick={() => setOnionSkinEnabled(!onionSkinEnabled)}
        title={onionSkinEnabled ? 'Onion Skin On' : 'Onion Skin Off'}
      >
        <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
          <circle cx="5" cy="7" r="4" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
          <circle cx="7" cy="7" r="4" stroke="currentColor" strokeWidth="1.2"/>
          <circle cx="9" cy="7" r="4" stroke="currentColor" strokeWidth="1" opacity="0.5"/>
        </svg>
        <span style={{ fontSize: 12, fontWeight: 500 }}>Onion</span>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  controls: {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    padding: '0 12px',
    borderRight: '1px solid var(--border)',
    flexShrink: 0
  },
  transport: {
    display: 'flex',
    alignItems: 'center',
    gap: 2
  },
  transportBtn: {
    padding: '4px 6px',
    minWidth: 28,
    minHeight: 28,
    color: 'var(--text-secondary)'
  },
  playBtn: {
    background: 'var(--accent)',
    border: 'none',
    borderRadius: 6,
    width: 32,
    height: 32,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
    color: '#fff',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto'
  },
  timecodeWrap: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    gap: 1
  },
  timecode: {
    color: 'var(--text-primary)',
    fontSize: 16,
    fontWeight: 700,
    fontFamily: 'monospace',
    letterSpacing: 1
  },
  timecodeLabel: {
    color: 'var(--text-muted)',
    fontSize: 8,
    fontWeight: 600,
    letterSpacing: 1.5,
    textTransform: 'uppercase'
  },
  sep: {
    width: 1,
    height: 24,
    background: 'var(--border)',
    flexShrink: 0
  },
  fpsWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4,
    color: 'var(--text-secondary)'
  },
  fpsLabel: {
    fontSize: 12,
    fontWeight: 500,
    color: 'var(--text-secondary)'
  },
  loopWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  }
}
