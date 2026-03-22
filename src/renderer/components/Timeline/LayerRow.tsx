import React, { useState } from 'react'
import type { Layer } from '../../types/project'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import KeyframeTrack from './KeyframeTrack'
import LayerContextMenu from './LayerContextMenu'

interface Props {
  layer: Layer
  pixelsPerFrame: number
  totalFrames: number
}

const ROW_HEIGHT = 36

export default function LayerRow({ layer, pixelsPerFrame, totalFrames }: Props): React.ReactElement {
  const selectedLayerId = useEditorStore((s) => s.selectedLayerId)
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)
  const isSelected = selectedLayerId === layer.id
  const [hovered, setHovered] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    setSelectedLayerId(layer.id)
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleVisibleToggle(e: React.MouseEvent): void {
    e.stopPropagation()
    useProjectStore.getState().updateLayer(layer.id, { visible: !layer.visible })
  }

  let rowBg: string | undefined
  if (isSelected) rowBg = 'rgba(74, 158, 255, 0.18)'
  else if (hovered) rowBg = 'rgba(255, 255, 255, 0.03)'

  return (
    <>
      <div
        onClick={() => setSelectedLayerId(layer.id)}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => setHovered(true)}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={() => {
          if (layer.type === 'symbol' && layer.symbolId) {
            useEditorStore.getState().setEditingSymbolId(layer.symbolId)
          }
        }}
        style={{
          ...styles.row,
          background: rowBg,
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent'
        }}
      >
        {/* Layer label */}
        <div style={styles.label}>
          <span
            onClick={handleVisibleToggle}
            title={layer.visible ? 'Hide' : 'Show'}
            style={{ cursor: 'pointer', color: layer.visible ? 'var(--text-label)' : 'var(--text-muted)', fontSize: 11 }}
          >
            {layer.visible ? '👁' : '—'}
          </span>
          <span
            style={{
              fontSize: 12,
              overflow: 'hidden',
              textOverflow: 'ellipsis',
              whiteSpace: 'nowrap',
              color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
            }}
            title={layer.name}
          >
            {layer.type === 'text' ? '\uD835\uDD4B ' : layer.type === 'shape' ? '\u25C6 ' : layer.type === 'symbol' ? '\u229E ' : '\uD83D\uDDBC '}{layer.name}
          </span>
        </div>

        {/* Keyframe track area */}
        <div style={styles.trackArea}>
          <KeyframeTrack layer={layer} pixelsPerFrame={pixelsPerFrame} totalFrames={totalFrames} />
        </div>
      </div>
      {contextMenu && (
        <LayerContextMenu
          layer={layer}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
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
