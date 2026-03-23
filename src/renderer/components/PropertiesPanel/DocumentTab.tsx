import React, { useState, useRef } from 'react'
import { useProjectStore } from '../../store/projectStore'

export default function DocumentTab(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const update = useProjectStore((s) => s.updateProjectSettings)
  const [scaleFrameSpans, setScaleFrameSpans] = useState(false)
  const prevFpsRef = useRef(project?.fps ?? 24)

  if (!project) return <div style={{ padding: 12, color: 'var(--text-muted)' }}>No project</div>

  return (
    <div style={styles.container}>
      {/* PROJECT section */}
      <div style={styles.sectionHeader}>PROJECT</div>
      <div style={styles.fieldCol}>
        <label style={styles.fieldLabel}>Name</label>
        <input
          type="text"
          value={project.name}
          onChange={(e) => update({ name: e.target.value })}
          style={styles.fieldInput}
        />
      </div>

      {/* CANVAS section */}
      <div style={{ ...styles.sectionHeader, marginTop: 16 }}>CANVAS</div>
      <div style={styles.fieldPairRow}>
        <div style={styles.fieldCol}>
          <label style={styles.fieldLabel}>Width</label>
          <div style={styles.fieldInputWrap}>
            <input
              type="number"
              value={project.width}
              min={1}
              onChange={(e) => update({ width: parseInt(e.target.value) || project.width })}
              style={styles.fieldInput}
            />
            <span style={styles.fieldUnit}>px</span>
          </div>
        </div>
        <div style={styles.fieldCol}>
          <label style={styles.fieldLabel}>Height</label>
          <div style={styles.fieldInputWrap}>
            <input
              type="number"
              value={project.height}
              min={1}
              onChange={(e) => update({ height: parseInt(e.target.value) || project.height })}
              style={styles.fieldInput}
            />
            <span style={styles.fieldUnit}>px</span>
          </div>
        </div>
      </div>

      <div style={styles.fieldCol}>
        <label style={styles.fieldLabel}>Background</label>
        <div style={styles.colorRow}>
          <input
            type="color"
            value={project.backgroundColor}
            onChange={(e) => update({ backgroundColor: e.target.value })}
            style={styles.colorSwatch}
          />
          <input
            type="text"
            value={project.backgroundColor}
            onChange={(e) => {
              if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
                update({ backgroundColor: e.target.value })
              }
            }}
            style={{ ...styles.fieldInput, flex: 1 }}
          />
        </div>
      </div>

      {/* TIMING section */}
      <div style={{ ...styles.sectionHeader, marginTop: 16 }}>TIMING</div>
      <div style={styles.fieldPairRow}>
        <div style={styles.fieldCol}>
          <label style={styles.fieldLabel}>FPS</label>
          <input
            type="number"
            value={project.fps}
            min={1}
            max={120}
            onChange={(e) => {
              const newFps = parseInt(e.target.value) || project.fps
              const oldFps = prevFpsRef.current
              prevFpsRef.current = newFps
              if (scaleFrameSpans && oldFps !== newFps && oldFps > 0) {
                // Scale all keyframe positions and duration proportionally
                const ratio = newFps / oldFps
                useProjectStore.getState().applyAction(`Change FPS ${oldFps} → ${newFps} with scaling`, (draft) => {
                  draft.fps = newFps
                  draft.durationFrames = Math.round(draft.durationFrames * ratio)
                  for (const layer of draft.layers) {
                    layer.startFrame = Math.round(layer.startFrame * ratio)
                    layer.endFrame = Math.round(layer.endFrame * ratio)
                    for (const track of layer.tracks) {
                      for (const kf of track.keyframes) {
                        kf.frame = Math.round(kf.frame * ratio)
                      }
                    }
                  }
                })
              } else {
                update({ fps: newFps })
              }
            }}
            style={styles.fieldInput}
          />
        </div>
        <div style={styles.fieldCol}>
          <label style={styles.fieldLabel}>Frames</label>
          <input
            type="number"
            value={project.durationFrames}
            min={1}
            onChange={(e) => update({ durationFrames: parseInt(e.target.value) || project.durationFrames })}
            style={styles.fieldInput}
          />
        </div>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
        <input
          type="checkbox"
          id="scaleFrameSpans"
          checked={scaleFrameSpans}
          onChange={(e) => setScaleFrameSpans(e.target.checked)}
          style={{ width: 14, height: 14 }}
        />
        <label htmlFor="scaleFrameSpans" style={{ color: 'var(--text-secondary)', fontSize: 11, cursor: 'pointer' }}>
          Scale Frame Spans
        </label>
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
        {(project.durationFrames / project.fps).toFixed(1)}s at {project.fps} fps
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '12px 16px',
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  sectionHeader: {
    fontSize: 10,
    fontWeight: 700,
    color: 'var(--text-muted)',
    textTransform: 'uppercase',
    letterSpacing: 1.2,
    marginTop: 4,
    marginBottom: 6
  },
  fieldPairRow: {
    display: 'flex',
    gap: 8,
    marginBottom: 4
  },
  fieldCol: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    marginBottom: 4
  },
  fieldLabel: {
    fontSize: 11,
    color: 'var(--text-secondary)',
    textTransform: 'none',
    letterSpacing: 0
  },
  fieldInputWrap: {
    display: 'flex',
    alignItems: 'center',
    gap: 4
  },
  fieldInput: {
    flex: 1,
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '6px 8px',
    color: 'var(--text-primary)',
    fontSize: 12
  },
  fieldUnit: {
    fontSize: 10,
    color: 'var(--text-muted)',
    flexShrink: 0
  },
  colorRow: {
    display: 'flex',
    alignItems: 'center',
    gap: 8
  },
  colorSwatch: {
    width: 32,
    height: 32,
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    padding: 0,
    flexShrink: 0
  }
}
