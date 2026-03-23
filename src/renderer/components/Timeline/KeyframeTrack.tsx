import React, { useState, useCallback, useRef } from 'react'
import type { Layer, EasingType } from '../../types/project'
import { DEFAULT_EASING } from '../../types/project'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import KeyframeContextMenu from './KeyframeContextMenu'

interface Props {
  layer: Layer
  pixelsPerFrame: number
  totalFrames: number
}

interface SpanData {
  start: number   // keyframe frame at span start
  end: number     // keyframe frame at span end (or endFrame+1 for last span)
  easing: EasingType
  isTween: boolean
}

/** Find the span that contains a given frame */
function findSpanForFrame(spans: SpanData[], frame: number): SpanData | null {
  for (let i = spans.length - 1; i >= 0; i--) {
    if (frame >= spans[i].start && frame < spans[i].end) return spans[i]
  }
  return null
}

export default function KeyframeTrack({ layer, pixelsPerFrame, totalFrames }: Props): React.ReactElement {
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame)
  const selectedSpan = useEditorStore((s) => s.selectedSpan)
  const setSelectedSpan = useEditorStore((s) => s.setSelectedSpan)
  const [dragState, setDragState] = useState<{
    sourceFrame: number
    targetFrame: number
    startX: number
  } | null>(null)
  const [contextMenu, setContextMenu] = useState<{ frame: number; x: number; y: number } | null>(null)
  const trackRef = useRef<HTMLDivElement>(null)

  // Collect unique keyframe positions from all tracks
  const keyframeFrames = new Set<number>()
  for (const track of layer.tracks) {
    for (const kf of track.keyframes) {
      keyframeFrames.add(kf.frame)
    }
  }

  // Build span data: each span runs from one keyframe to the next (or endFrame)
  const sortedFrames = [...keyframeFrames].sort((a, b) => a - b)
  const spans: SpanData[] = []
  for (let i = 0; i < sortedFrames.length; i++) {
    let easing: EasingType = DEFAULT_EASING
    for (const track of layer.tracks) {
      const kf = track.keyframes.find((k) => k.frame === sortedFrames[i])
      if (kf) { easing = kf.easing; break }
    }
    const end = i < sortedFrames.length - 1 ? sortedFrames[i + 1] : layer.endFrame + 1
    spans.push({ start: sortedFrames[i], end, easing, isTween: easing !== 'step' })
  }

  // Is a span on THIS layer currently selected?
  const isSpanSelected = selectedSpan && selectedSpan.layerId === layer.id

  const showGridLines = pixelsPerFrame >= 6

  // --- Keyframe drag ---
  const handleDragStart = useCallback((frame: number, e: React.PointerEvent) => {
    e.stopPropagation()
    setDragState({ sourceFrame: frame, targetFrame: frame, startX: e.clientX })

    function onMove(ev: PointerEvent): void {
      if (!trackRef.current) return
      const rect = trackRef.current.getBoundingClientRect()
      const relX = ev.clientX - rect.left
      const newFrame = Math.max(0, Math.round(relX / pixelsPerFrame))
      setDragState((prev) => prev ? { ...prev, targetFrame: newFrame } : null)
    }

    function onUp(): void {
      setDragState((prev) => {
        if (prev && prev.sourceFrame !== prev.targetFrame) {
          const kfData: Array<{ property: any; value: number; easing: EasingType }> = []
          for (const track of layer.tracks) {
            const kf = track.keyframes.find((k) => k.frame === prev.sourceFrame)
            if (kf) kfData.push({ property: track.property, value: kf.value, easing: kf.easing })
          }
          if (kfData.length > 0) {
            const oldFrame = prev.sourceFrame
            const newFrame = prev.targetFrame
            useProjectStore.getState().applyAction(
              `Move keyframe ${oldFrame} \u2192 ${newFrame}`,
              (draft) => {
                const draftLayer = draft.layers.find((l) => l.id === layer.id)
                if (!draftLayer) return
                for (const kd of kfData) {
                  const track = draftLayer.tracks.find((t) => t.property === kd.property)
                  if (!track) continue
                  track.keyframes = track.keyframes.filter((kf) => kf.frame !== oldFrame)
                  const existIdx = track.keyframes.findIndex((kf) => kf.frame === newFrame)
                  if (existIdx !== -1) {
                    track.keyframes[existIdx] = { frame: newFrame, value: kd.value, easing: kd.easing }
                  } else {
                    track.keyframes.push({ frame: newFrame, value: kd.value, easing: kd.easing })
                    track.keyframes.sort((a, b) => a.frame - b.frame)
                  }
                }
              }
            )
            useEditorStore.getState().setCurrentFrame(prev.targetFrame)
          }
        }
        return null
      })
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
    }

    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
  }, [layer, pixelsPerFrame])

  // --- Click on track (not on keyframe) ---
  function handleTrackClick(e: React.MouseEvent): void {
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const frame = Math.max(0, Math.round(relX / pixelsPerFrame))
    setCurrentFrame(frame)

    // Select the span this frame belongs to
    const span = findSpanForFrame(spans, frame)
    if (span && !keyframeFrames.has(frame)) {
      setSelectedSpan({ layerId: layer.id, startFrame: span.start, endFrame: span.end })
    } else {
      setSelectedSpan(null)
    }
  }

  // --- Right-click ---
  function handleTrackContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    if (!trackRef.current) return
    const rect = trackRef.current.getBoundingClientRect()
    const relX = e.clientX - rect.left
    const frame = Math.max(0, Math.round(relX / pixelsPerFrame))
    setCurrentFrame(frame)
    setContextMenu({ frame, x: e.clientX, y: e.clientY })
  }

  function handleKeyframeClick(frame: number): void {
    setCurrentFrame(frame)
    setSelectedSpan(null)
  }

  function handleKeyframeRightClick(frame: number, e: React.MouseEvent): void {
    setCurrentFrame(frame)
    setSelectedSpan(null)
    setContextMenu({ frame, x: e.clientX, y: e.clientY })
  }

  // --- Grid lines via CSS repeating gradient ---
  const gridBg = showGridLines
    ? `repeating-linear-gradient(90deg, transparent, transparent ${pixelsPerFrame - 1}px, rgba(255,255,255,0.04) ${pixelsPerFrame - 1}px, rgba(255,255,255,0.04) ${pixelsPerFrame}px)`
    : undefined

  return (
    <>
      <div
        ref={trackRef}
        onClick={handleTrackClick}
        onContextMenu={handleTrackContextMenu}
        style={{
          position: 'relative',
          flex: 1,
          height: '100%',
          background: 'var(--bg-primary)',
          borderRadius: 2,
          backgroundImage: gridBg
        }}
      >
        {/* Span blocks — colored fill for each span */}
        {spans.map((span) => {
          const left = span.start * pixelsPerFrame
          const width = (span.end - span.start) * pixelsPerFrame
          const isThisSpanSelected = isSpanSelected
            && selectedSpan!.startFrame === span.start
            && selectedSpan!.endFrame === span.end

          return (
            <div
              key={`span-${span.start}`}
              style={{
                position: 'absolute',
                left,
                top: 2,
                bottom: 2,
                width,
                background: span.isTween
                  ? 'rgba(96, 165, 250, 0.25)'
                  : 'rgba(100, 100, 115, 0.18)',
                borderRadius: 2,
                zIndex: 0,
                pointerEvents: 'none',
                outline: isThisSpanSelected ? '1.5px solid rgba(96, 165, 250, 0.7)' : undefined
              }}
            >
              {/* Tween arrow indicator */}
              {span.isTween && width > 24 && (
                <svg
                  width="8" height="8" viewBox="0 0 8 8"
                  style={{ position: 'absolute', right: 4, top: '50%', transform: 'translateY(-50%)' }}
                >
                  <path d="M1 1l4 3-4 3" fill="rgba(96, 165, 250, 0.6)" />
                </svg>
              )}
            </div>
          )
        })}

        {/* Span-end markers — small vertical tick at the last frame before each keyframe */}
        {sortedFrames.map((kfFrame, i) => {
          if (i === 0) return null
          const endFrame = kfFrame - 1
          if (endFrame < 0) return null
          return (
            <div
              key={`end-${kfFrame}`}
              style={{
                position: 'absolute',
                left: kfFrame * pixelsPerFrame - 1,
                top: 4,
                bottom: 4,
                width: 1,
                background: 'rgba(255,255,255,0.12)',
                zIndex: 1,
                pointerEvents: 'none'
              }}
            />
          )
        })}

        {/* Keyframe markers — filled circles */}
        {Array.from(keyframeFrames).map((frame) => {
          const span = findSpanForFrame(spans, frame)
          const isTween = span?.isTween ?? false

          return (
            <div
              key={`kf-${frame}`}
              title={`Frame ${frame}`}
              onClick={(e) => { e.stopPropagation(); handleKeyframeClick(frame) }}
              onPointerDown={(e) => { if (e.button === 0) handleDragStart(frame, e) }}
              onContextMenu={(e) => { e.preventDefault(); e.stopPropagation(); handleKeyframeRightClick(frame, e) }}
              style={{
                position: 'absolute',
                left: frame * pixelsPerFrame + pixelsPerFrame / 2 - 5,
                top: '50%',
                width: 10,
                height: 10,
                transform: 'translateY(-50%) rotate(45deg)',
                background: isTween ? '#60a5fa' : '#d1d5db',
                border: '1px solid rgba(0,0,0,0.3)',
                cursor: 'grab',
                zIndex: 3
              }}
            />
          )
        })}

        {/* Ghost dot during drag */}
        {dragState && dragState.sourceFrame !== dragState.targetFrame && (
          <div
            style={{
              position: 'absolute',
              left: dragState.targetFrame * pixelsPerFrame + pixelsPerFrame / 2 - 5,
              top: '50%',
              width: 10,
              height: 10,
              transform: 'translateY(-50%) rotate(45deg)',
              background: 'var(--accent-dim)',
              border: '1px solid rgba(0,0,0,0.2)',
              zIndex: 2,
              pointerEvents: 'none'
            }}
          />
        )}
      </div>
      {contextMenu && (
        <KeyframeContextMenu
          layer={layer}
          frame={contextMenu.frame}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
