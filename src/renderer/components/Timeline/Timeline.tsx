import React, { useRef } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import PlaybackControls from './PlaybackControls'
import TimeRuler from './TimeRuler'
import LayerRow from './LayerRow'
import { AddLayerCommand } from '../../store/commands/AddLayerCommand'
import { createTextLayer } from '../../utils/layerFactory'

const LABEL_WIDTH = 160
const PIXELS_PER_FRAME = 6

export default function Timeline(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  const { currentFrame, setCurrentFrame, setIsPlaying } = useEditorStore()
  const setSelectedLayerId = useEditorStore((s) => s.setSelectedLayerId)
  const scrollRef = useRef<HTMLDivElement>(null)

  function handleTrackMouseDown(e: React.MouseEvent): void {
    const el = scrollRef.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const relX = e.clientX - rect.left + el.scrollLeft - LABEL_WIDTH
    if (relX < 0) return // click was in the label area

    setIsPlaying(false)
    setCurrentFrame(Math.max(0, Math.min(Math.round(relX / PIXELS_PER_FRAME), totalFrames - 1)))

    function onMove(me: MouseEvent): void {
      const r = el.getBoundingClientRect()
      const rx = me.clientX - r.left + el.scrollLeft - LABEL_WIDTH
      setCurrentFrame(Math.max(0, Math.min(Math.round(rx / PIXELS_PER_FRAME), totalFrames - 1)))
    }
    function onUp(): void {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  const totalFrames = project?.durationFrames ?? 0
  const totalWidth = totalFrames * PIXELS_PER_FRAME + LABEL_WIDTH

  // Sort layers by order (reversed so top layer is at top of timeline)
  const layers = project
    ? [...project.layers].sort((a, b) => b.order - a.order)
    : []

  function handleAddText(): void {
    if (!project) return
    const layer = createTextLayer(project)
    history.push(new AddLayerCommand(layer))
    setSelectedLayerId(layer.id)
  }

  // Playhead line in track area
  const playheadX = LABEL_WIDTH + currentFrame * PIXELS_PER_FRAME

  return (
    <div className="panel" style={styles.panel}>
      {/* Toolbar row */}
      <div style={styles.toolbar}>
        <PlaybackControls />
        <div style={styles.toolbarRight}>
          <button className="icon-btn" onClick={handleAddText} disabled={!project}>
            + Text
          </button>
        </div>
      </div>

      {/* Timeline content */}
      <div style={styles.timelineBody}>
        {/* Fixed ruler */}
        <TimeRuler
          pixelsPerFrame={PIXELS_PER_FRAME}
          totalFrames={totalFrames}
          labelOffset={LABEL_WIDTH}
        />

        {/* Scrollable layer rows */}
        <div ref={scrollRef} style={styles.layerScroll} onMouseDown={handleTrackMouseDown}>
          <div style={{ width: totalWidth, position: 'relative', minWidth: '100%' }}>
            {/* Playhead vertical line */}
            <div
              style={{
                position: 'absolute',
                left: playheadX,
                top: 0,
                bottom: 0,
                width: 1,
                background: 'rgba(74, 158, 255, 0.5)',
                pointerEvents: 'none',
                zIndex: 10
              }}
            />

            {layers.map((layer) => (
              <LayerRow
                key={layer.id}
                layer={layer}
                pixelsPerFrame={PIXELS_PER_FRAME}
                totalFrames={totalFrames}
              />
            ))}

            {layers.length === 0 && (
              <div style={styles.empty}>
                {project ? 'No layers. Import an image or add text.' : 'Create a project to begin.'}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    borderTop: '1px solid var(--border)',
    overflow: 'hidden'
  },
  toolbar: {
    display: 'flex',
    alignItems: 'center',
    height: 40,
    borderBottom: '1px solid var(--border)',
    background: 'var(--bg-secondary)'
  },
  toolbarRight: {
    marginLeft: 'auto',
    padding: '0 8px'
  },
  timelineBody: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  layerScroll: {
    flex: 1,
    overflowY: 'auto',
    overflowX: 'auto',
    position: 'relative'
  },
  empty: {
    padding: 20,
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center'
  }
}
