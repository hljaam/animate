import type { EasingType } from '../types/project'

export function applyEasing(t: number, easing: EasingType): number {
  switch (easing) {
    case 'linear':
      return t
    case 'easeIn':
      return t * t
    case 'easeOut':
      return 1 - (1 - t) * (1 - t)
    case 'easeInOut':
      return t < 0.5 ? 2 * t * t : 1 - Math.pow(-2 * t + 2, 2) / 2
    default:
      return t
  }
}

export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t
}
