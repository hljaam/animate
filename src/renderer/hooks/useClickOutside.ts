import { useEffect, type RefObject } from 'react'

/**
 * Dismisses a popover/menu when clicking outside the ref element.
 * Uses pointerdown in the capture phase so it fires before PixiJS or other
 * handlers can call stopPropagation / preventDefault.
 * setTimeout(0) avoids closing from the same pointer event that opened it.
 */
export function useClickOutside(
  ref: RefObject<HTMLElement | null>,
  onClose: (() => void) | null
): void {
  useEffect(() => {
    if (!onClose) return
    function handleClick(e: PointerEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) {
        onClose!()
      }
    }
    const id = setTimeout(() => document.addEventListener('pointerdown', handleClick, true), 0)
    return () => {
      clearTimeout(id)
      document.removeEventListener('pointerdown', handleClick, true)
    }
  }, [ref, onClose])
}
