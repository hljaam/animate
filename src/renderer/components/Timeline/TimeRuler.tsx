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
  const onionSkinEnabled = useEditorStore((s) => s.onionSkinEnabled)
  const onionSkinBefore = useEditorStore((s) => s.onionSkinBefore)
  const onionSkinAfter = useEditorStore((s) => s.onionSkinAfter)
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
          background: isMajor ? 'var(--text-muted)' : 'var(--border)'
        }}
      />,
      isMajor && (
        <div
          key={`lbl-${f}`}
          style={{
            position: 'absolute',
            left: x + 2,
            top: 4,
            fontSize: 10,
            color: 'var(--text-secondary)',
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

  // Onion skin range
  const onionElements: React.ReactNode[] = []
  if (onionSkinEnabled) {
    const beforeStart = Math.max(0, currentFrame - onionSkinBefore)
    const afterEnd = Math.min(totalFrames - 1, currentFrame + onionSkinAfter)
    // Green (before) range
    if (onionSkinBefore > 0 && beforeStart < currentFrame) {
      const left = labelOffset + beforeStart * pixelsPerFrame
      const width = (currentFrame - beforeStart) * pixelsPerFrame
      onionElements.push(
        <div key="onion-before" style={{
          position: 'absolute', left, top: RULER_HEIGHT - 4, height: 3, width,
          background: 'rgba(74, 222, 128, 0.5)', borderRadius: 1, pointerEvents: 'none'
        }} />
      )
    }
    // Blue (after) range
    if (onionSkinAfter > 0 && afterEnd > currentFrame) {
      const left = labelOffset + currentFrame * pixelsPerFrame
      const width = (afterEnd - currentFrame) * pixelsPerFrame
      onionElements.push(
        <div key="onion-after" style={{
          position: 'absolute', left, top: RULER_HEIGHT - 4, height: 3, width,
          background: 'rgba(96, 165, 250, 0.5)', borderRadius: 1, pointerEvents: 'none'
        }} />
      )
    }
  }

  // Frame labels
  const frameLabels = project?.frameLabels
  const labelElements: React.ReactNode[] = []
  if (frameLabels) {
    for (const [frameStr, label] of Object.entries(frameLabels)) {
      const f = parseInt(frameStr)
      if (isNaN(f) || f < 0 || f >= totalFrames) continue
      const x = labelOffset + f * pixelsPerFrame
      labelElements.push(
        <div key={`flabel-${f}`} style={{
          position: 'absolute',
          left: x,
          top: 0,
          fontSize: 8,
          color: '#f59e0b',
          fontWeight: 600,
          pointerEvents: 'none',
          whiteSpace: 'nowrap',
          transform: 'translateX(-50%)'
        }}>
          {label}
        </div>
      )
      // Small flag marker
      labelElements.push(
        <div key={`flag-${f}`} style={{
          position: 'absolute',
          left: x - 1,
          top: RULER_HEIGHT - 8,
          width: 3,
          height: 6,
          background: '#f59e0b',
          borderRadius: 1,
          pointerEvents: 'none'
        }} />
      )
    }
  }

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
      {onionElements}
      {labelElements}

      {/* Playhead indicator */}
      <div
        style={{
          position: 'absolute',
          left: playheadX,
          top: 0,
          width: 3,
          height: '100%',
          background: 'var(--accent)',
          pointerEvents: 'none'
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: playheadX - 7,
          top: 0,
          width: 14,
          height: 12,
          background: 'var(--accent)',
          clipPath: 'polygon(50% 100%, 0 0, 100% 0)',
          pointerEvents: 'none'
        }}
      />
      {/* Frame number label */}
      <div
        style={{
          position: 'absolute',
          left: playheadX + 6,
          top: 2,
          fontSize: 10,
          color: 'var(--accent)',
          fontFamily: 'monospace',
          pointerEvents: 'none'
        }}
      >
        {currentFrame}
      </div>
    </div>
  )
}
