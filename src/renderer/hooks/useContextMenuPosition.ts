import { useLayoutEffect, RefObject } from 'react'

/**
 * Flips a fixed-position context menu so it opens away from viewport edges.
 * If the menu would overflow the bottom, it opens upward from the click point.
 * If it would overflow the right, it opens leftward from the click point.
 */
export function useContextMenuPosition(
  ref: RefObject<HTMLDivElement | null>,
  x: number,
  y: number
): void {
  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return
    const rect = el.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight

    // Flip left if overflows right edge
    const nx = x + rect.width > vw ? x - rect.width : x
    // Flip up if overflows bottom edge
    const ny = y + rect.height > vh ? y - rect.height : y

    el.style.left = `${Math.max(0, nx)}px`
    el.style.top = `${Math.max(0, ny)}px`
  }, [ref, x, y])
}
