import React from 'react'
import { useProjectStore } from '../../store/projectStore'

export default function DocumentTab(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const update = useProjectStore((s) => s.updateProjectSettings)

  if (!project) return <div style={{ padding: 12, color: 'var(--text-muted)' }}>No project</div>

  return (
    <div style={styles.container}>
      <div className="field-row">
        <label>Name</label>
        <input
          type="text"
          value={project.name}
          onChange={(e) => update({ name: e.target.value })}
        />
      </div>
      <div className="divider" />

      <div style={styles.section}>Canvas</div>
      <div className="field-row">
        <label>Width</label>
        <input
          type="number"
          value={project.width}
          min={1}
          onChange={(e) => update({ width: parseInt(e.target.value) || project.width })}
        />
        <span style={styles.unit}>px</span>
      </div>
      <div className="field-row">
        <label>Height</label>
        <input
          type="number"
          value={project.height}
          min={1}
          onChange={(e) => update({ height: parseInt(e.target.value) || project.height })}
        />
        <span style={styles.unit}>px</span>
      </div>
      <div className="field-row">
        <label>BG Color</label>
        <input
          type="color"
          value={project.backgroundColor}
          onChange={(e) => update({ backgroundColor: e.target.value })}
          style={{ width: 40, padding: '1px 3px' }}
        />
        <input
          type="text"
          value={project.backgroundColor}
          onChange={(e) => {
            if (/^#[0-9a-fA-F]{0,6}$/.test(e.target.value)) {
              update({ backgroundColor: e.target.value })
            }
          }}
          style={{ flex: 1 }}
        />
      </div>

      <div className="divider" />
      <div style={styles.section}>Timing</div>
      <div className="field-row">
        <label>FPS</label>
        <input
          type="number"
          value={project.fps}
          min={1}
          max={120}
          onChange={(e) => update({ fps: parseInt(e.target.value) || project.fps })}
        />
      </div>
      <div className="field-row">
        <label>Frames</label>
        <input
          type="number"
          value={project.durationFrames}
          min={1}
          onChange={(e) => update({ durationFrames: parseInt(e.target.value) || project.durationFrames })}
        />
      </div>
      <div style={{ color: 'var(--text-muted)', fontSize: 11, marginTop: 4 }}>
        {(project.durationFrames / project.fps).toFixed(1)}s at {project.fps} fps
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  container: {
    padding: '10px 12px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4
  },
  section: {
    fontSize: 11,
    fontWeight: 600,
    color: 'var(--text-secondary)',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginTop: 4,
    marginBottom: 2
  },
  unit: {
    color: 'var(--text-muted)',
    fontSize: 11,
    flexShrink: 0
  }
}
