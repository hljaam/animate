import React from 'react'
import type { Layer } from '../../types/project'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import KeyframeTrack from './KeyframeTrack'

interface Props {
  layer: Layer
  pixelsPerFrame: number
  totalFrames: number
}

const ROW_HEIGHT = 32

export default function LayerRow({ layer, pixelsPerFrame, totalFrames }: Props): React.ReactElement {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)
  const isSelected = selectedLayerId === layer.id

  function handleVisibleToggle(e: React.MouseEvent): void {
    e.stopPropagation()
    useProjectStore.getState().updateLayer(layer.id, { visible: !layer.visible })
  }

  return (
    <div
      onClick={() => setSelectedLayerId(layer.id)}
      style={{
        ...styles.row,
        background: isSelected ? 'rgba(74, 158, 255, 0.12)' : undefined,
        borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent'
      }}
    >
      {/* Layer label */}
      <div style={styles.label}>
        <span
          onClick={handleVisibleToggle}
          title={layer.visible ? 'Hide' : 'Show'}
          style={{ cursor: 'pointer', color: layer.visible ? 'var(--text-secondary)' : 'var(--text-muted)', fontSize: 11 }}
        >
          {layer.visible ? '👁' : '—'}
        </span>
        <span
          style={{
            fontSize: 11,
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
            color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
          }}
          title={layer.name}
        >
          {layer.type === 'text' ? '𝕋 ' : '🖼 '}{layer.name}
        </span>
      </div>

      {/* Keyframe track area */}
      <div style={styles.trackArea}>
        <KeyframeTrack layer={layer} pixelsPerFrame={pixelsPerFrame} totalFrames={totalFrames} />
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  row: {
    display: 'flex',
    height: ROW_HEIGHT,
    borderBottom: '1px solid var(--border)',
    cursor: 'pointer'
  },
  label: {
    width: 160,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    gap: 6,
    padding: '0 8px',
    borderRight: '1px solid var(--border)',
    overflow: 'hidden'
  },
  trackArea: {
    flex: 1,
    overflow: 'hidden',
    position: 'relative'
  }
}
