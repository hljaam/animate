import React, { useRef, useEffect, memo } from 'react'
import { usePixiStage } from '../../hooks/usePixiStage'
import { useProjectStore } from '../../store/projectStore'

const StageContainer = memo(function StageContainer(): React.ReactElement {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = usePixiStage(containerRef)
  const project = useProjectStore((s) => s.project)

  // Handle container resize — update PixiJS renderer dimensions
  useEffect(() => {
    const el = containerRef.current
    if (!el) return

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0]
      if (!entry) return
      const { width, height } = entry.contentRect
      const renderer = rendererRef.current
      if (!renderer || width === 0 || height === 0) return

      renderer.resize(width, height)
      const proj = useProjectStore.getState().project
      if (proj) {
        renderer.applyViewport(width, height, proj.width, proj.height)
      }
    })

    observer.observe(el)
    return () => observer.disconnect()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div
      ref={containerRef}
      style={styles.container}
    >
      {!project && (
        <div style={styles.empty}>
          <span style={styles.emptyText}>No project open</span>
          <span style={styles.emptyHint}>Create a new project to get started</span>
        </div>
      )}
    </div>
  )
})

export default StageContainer

const styles: Record<string, React.CSSProperties> = {
  container: {
    flex: 1,
    background: '#111',
    position: 'relative',
    overflow: 'hidden',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center'
  },
  empty: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 8,
    pointerEvents: 'none'
  },
  emptyText: {
    color: 'var(--text-secondary)',
    fontSize: 18
  },
  emptyHint: {
    color: 'var(--text-muted)',
    fontSize: 13
  }
}
