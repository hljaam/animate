import React, { useRef } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'

interface Props {
  pixelsPerFrame: number
  totalFrames: number
  labelOffset: number // left offset to align with track area (skip layer labels)
}

const RULER_HEIGHT = 24

export default function TimeRuler({ pixelsPerFrame, totalFrames, labelOffset }: Props): React.ReactElement {
  const { currentFrame, setCurrentFrame, setIsPlaying } = useEditorStore()
  const project = useProjectStore((s) => s.project)
  const rulerRef = useRef<HTMLDivElement>(null)
  const isDragging = useRef(false)

  function getFrameFromX(x: number): number {
    const adjusted = x - labelOffset
    const frame = Math.round(adjusted / pixelsPerFrame)
    return Math.max(0, Math.min(frame, totalFrames - 1))
  }

  function handleMouseDown(e: React.MouseEvent): void {
    setIsPlaying(false)
    isDragging.current = true
    setCurrentFrame(getFrameFromX(e.nativeEvent.offsetX))

    function onMove(me: MouseEvent): void {
      if (!isDragging.current || !rulerRef.current) return
      const rect = rulerRef.current.getBoundingClientRect()
      setCurrentFrame(getFrameFromX(me.clientX - rect.left))
    }

    function onUp(): void {
      isDragging.current = false
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }

    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
  }

  // Draw frame ticks
  const ticks: React.ReactNode[] = []
  const step = pixelsPerFrame >= 10 ? 1 : pixelsPerFrame >= 4 ? 5 : 10

  for (let f = 0; f < totalFrames; f += step) {
    const x = labelOffset + f * pixelsPerFrame
    const isMajor = f % (step * 5) === 0
    ticks.push(
      <div
        key={f}
        style={{
          position: 'absolute',
          left: x,
          top: isMajor ? 8 : 14,
          width: 1,
          height: isMajor ? 16 : 10,
          background: 'var(--border-light)'
        }}
      />,
      isMajor && (
        <div
          key={`lbl-${f}`}
          style={{
            position: 'absolute',
            left: x + 2,
            top: 4,
            fontSize: 9,
            color: 'var(--text-muted)',
            fontFamily: 'monospace',
            pointerEvents: 'none'
          }}
        >
          {f}
        </div>
      )
    )
  }

  // Playhead
  const playheadX = labelOffset + currentFrame * pixelsPerFrame

  return (
    <div
      ref={rulerRef}
      onMouseDown={handleMouseDown}
      style={{
        height: RULER_HEIGHT,
        background: 'var(--bg-tertiary)',
        borderBottom: '1px solid var(--border)',
        position: 'relative',
        cursor: 'col-resize',
        overflow: 'hidden',
        flexShrink: 0
      }}
    >
      {ticks}

      {/* Playhead indicator */}
      <div
        style={{
          position: 'absolute',
          left: playheadX,
          top: 0,
          width: 2,
          height: '100%',
          background: 'var(--accent)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: playheadX - 5,
          top: 0,
          width: 10,
          height: 10,
          background: 'var(--accent)',
          clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
          pointerEvents: 'none'
        }}
      />
    </div>
  )
}
