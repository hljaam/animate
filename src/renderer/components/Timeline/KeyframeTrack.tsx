import React, { useState } from 'react'
import type { Layer } from '../../types/project'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  layer: Layer
  pixelsPerFrame: number
  totalFrames: number
}

function KeyframeDot({ frame, pixelsPerFrame, onClick }: {
  frame: number
  pixelsPerFrame: number
  onClick: () => void
}): React.ReactElement {
  const [hovered, setHovered] = useState(false)

  return (
    <div
      title={`Frame ${frame}`}
      onClick={onClick}
      onMouseEnter={() => setHovered(true)}
      onMouseLeave={() => setHovered(false)}
      style={{
        position: 'absolute',
        top: '50%',
        left: frame * pixelsPerFrame - 5.5,
        width: 11,
        height: 11,
        background: hovered ? '#6cb3ff' : 'var(--accent)',
        transform: `translateY(-50%) rotate(45deg) ${hovered ? 'scale(1.3)' : 'scale(1)'}`,
        transition: 'background 0.1s, transform 0.1s',
        cursor: 'pointer',
        zIndex: 1
      }}
    />
  )
}

export default function KeyframeTrack({ layer, pixelsPerFrame, totalFrames }: Props): React.ReactElement {
  const setCurrentFrame = useEditorStore((s) => s.setCurrentFrame)

  // Collect unique keyframe positions from all tracks
  const keyframeFrames = new Set<number>()
  for (const track of layer.tracks) {
    for (const kf of track.keyframes) {
      keyframeFrames.add(kf.frame)
    }
  }

  return (
    <div style={styles.track}>
      {Array.from(keyframeFrames).map((frame) => (
        <KeyframeDot
          key={frame}
          frame={frame}
          pixelsPerFrame={pixelsPerFrame}
          onClick={() => setCurrentFrame(frame)}
        />
      ))}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  track: {
    position: 'relative',
    flex: 1,
    height: '100%',
    background: 'var(--bg-primary)',
    borderRadius: 2
  }
}
