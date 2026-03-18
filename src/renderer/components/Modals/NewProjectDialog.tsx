import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { generateId } from '../../utils/idGenerator'
import type { Project } from '../../types/project'

interface Preset {
  label: string
  sub: string
  width: number
  height: number
}

const PRESETS: Preset[] = [
  { label: 'YouTube', sub: '16:9 – 1920×1080', width: 1920, height: 1080 },
  { label: 'TikTok / Reels', sub: '9:16 – 1080×1920', width: 1080, height: 1920 },
  { label: 'Instagram', sub: '1:1 – 1080×1080', width: 1080, height: 1080 },
  { label: 'Custom', sub: 'Enter your own size', width: 0, height: 0 }
]

export default function NewProjectDialog(): React.ReactElement {
  const setProject = useProjectStore((s) => s.setProject)
  const setShowDialog = useEditorStore((s) => s.setShowNewProjectDialog)

  const [selected, setSelected] = useState(0)
  const [name, setName] = useState('My Project')
  const [customW, setCustomW] = useState(1280)
  const [customH, setCustomH] = useState(720)
  const [fps, setFps] = useState(30)
  const [durationSec, setDurationSec] = useState(5)

  const preset = PRESETS[selected]
  const isCustom = preset.label === 'Custom'
  const width = isCustom ? customW : preset.width
  const height = isCustom ? customH : preset.height

  function handleCreate(): void {
    const project: Project = {
      id: generateId(),
      name: name.trim() || 'My Project',
      width,
      height,
      fps,
      durationFrames: Math.round(durationSec * fps),
      backgroundColor: '#000000',
      assets: [],
      layers: []
    }
    setProject(project)
    setShowDialog(false)
    useEditorStore.getState().setCurrentFrame(0)
    useEditorStore.getState().setSelectedLayerId(null)
  }

  return (
    <div className="modal-overlay">
      <div className="modal" style={{ minWidth: 460 }}>
        <h2>New Project</h2>

        {/* Project name */}
        <div className="field-row" style={{ marginBottom: 16 }}>
          <label style={{ width: 70 }}>Name</label>
          <input
            type="text"
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Presets */}
        <div style={{ marginBottom: 16 }}>
          <label style={{ display: 'block', marginBottom: 8 }}>Canvas Size</label>
          <div style={styles.presets}>
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                style={{
                  ...styles.presetBtn,
                  borderColor: selected === i ? 'var(--accent)' : 'var(--border)',
                  background: selected === i ? 'rgba(74,158,255,0.1)' : 'var(--bg-tertiary)'
                }}
              >
                <strong style={{ fontSize: 13 }}>{p.label}</strong>
                <span style={{ fontSize: 11, color: 'var(--text-muted)', marginTop: 2 }}>
                  {p.sub}
                </span>
              </button>
            ))}
          </div>

          {isCustom && (
            <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
              <div className="field-row" style={{ flex: 1 }}>
                <label style={{ width: 50 }}>Width</label>
                <input
                  type="number"
                  value={customW}
                  min={1}
                  onChange={(e) => setCustomW(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="field-row" style={{ flex: 1 }}>
                <label style={{ width: 50 }}>Height</label>
                <input
                  type="number"
                  value={customH}
                  min={1}
                  onChange={(e) => setCustomH(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Timing */}
        <div style={{ display: 'flex', gap: 12, marginBottom: 20 }}>
          <div className="field-row" style={{ flex: 1 }}>
            <label style={{ width: 70 }}>FPS</label>
            <select value={fps} onChange={(e) => setFps(parseInt(e.target.value))}>
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
          <div className="field-row" style={{ flex: 1 }}>
            <label style={{ width: 70 }}>Duration</label>
            <input
              type="number"
              value={durationSec}
              min={1}
              max={600}
              onChange={(e) => setDurationSec(parseFloat(e.target.value) || 5)}
            />
            <span style={{ color: 'var(--text-muted)', fontSize: 11 }}>sec</span>
          </div>
        </div>

        <div style={{ color: 'var(--text-muted)', fontSize: 11, marginBottom: 20 }}>
          {width} × {height}px · {fps} fps · {Math.round(durationSec * fps)} frames
        </div>

        {/* Actions */}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8 }}>
          <button onClick={() => setShowDialog(false)}>Cancel</button>
          <button className="primary" onClick={handleCreate}>
            Create Project
          </button>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  presets: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
    gap: 8
  },
  presetBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'flex-start',
    padding: '10px 14px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    textAlign: 'left',
    transition: 'border-color 0.1s, background 0.1s'
  }
}
