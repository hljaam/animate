import React from 'react'
import type { Layer } from '../../types/project'
import { useEditorStore } from '../../store/editorStore'

interface Props {
  layer: Layer
  pixelsPerFrame: number
  totalFrames: number
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
        <div
          key={frame}
          title={`Frame ${frame}`}
          onClick={() => setCurrentFrame(frame)}
          style={{
            ...styles.diamond,
            left: frame * pixelsPerFrame - 5
          }}
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
  },
  diamond: {
    position: 'absolute',
    top: '50%',
    width: 9,
    height: 9,
    background: 'var(--accent)',
    transform: 'translateY(-50%) rotate(45deg)',
    cursor: 'pointer',
    zIndex: 1
  }
}
