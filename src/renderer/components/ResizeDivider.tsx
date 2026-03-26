import React, { useCallback, useRef } from 'react'

interface Props {
  direction: 'horizontal' | 'vertical'
  onResize: (delta: number) => void
}

export default function ResizeDivider({ direction, onResize }: Props): React.ReactElement {
  const dragging = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    e.preventDefault()
    dragging.current = true
    ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
  }, [])

  const handlePointerMove = useCallback((e: React.PointerEvent) => {
    if (!dragging.current) return
    const delta = direction === 'horizontal' ? e.movementX : e.movementY
    if (delta !== 0) onResize(delta)
  }, [direction, onResize])

  const handlePointerUp = useCallback(() => {
    dragging.current = false
  }, [])

  const isHorizontal = direction === 'horizontal'

  return (
    <div
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      style={{
        flexShrink: 0,
        width: isHorizontal ? 5 : '100%',
        height: isHorizontal ? '100%' : 5,
        cursor: isHorizontal ? 'col-resize' : 'row-resize',
        background: 'transparent',
        position: 'relative',
        zIndex: 20
      }}
    >
      <div
        style={{
          position: 'absolute',
          [isHorizontal ? 'left' : 'top']: 2,
          [isHorizontal ? 'width' : 'height']: 1,
          [isHorizontal ? 'top' : 'left']: 0,
          [isHorizontal ? 'bottom' : 'right']: 0,
          background: 'var(--border)'
        }}
      />
    </div>
  )
}
