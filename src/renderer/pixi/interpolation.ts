import type { PropertyTrack, TrackProperty } from '../types/project'
import { applyEasing, lerp } from '../utils/easingFunctions'

export type InterpolatedProps = Record<TrackProperty, number>

export function getInterpolatedProps(
  tracks: PropertyTrack[],
  frame: number,
  defaults: InterpolatedProps
): InterpolatedProps {
  const result = { ...defaults }

  for (const track of tracks) {
    const { keyframes } = track
    if (keyframes.length === 0) continue

    const sorted = keyframes // already sorted by frame
    const prop = track.property

    if (frame <= sorted[0].frame) {
      result[prop] = sorted[0].value
      continue
    }

    if (frame >= sorted[sorted.length - 1].frame) {
      result[prop] = sorted[sorted.length - 1].value
      continue
    }

    // Find surrounding keyframes
    let before = sorted[0]
    let after = sorted[sorted.length - 1]
    for (let i = 0; i < sorted.length - 1; i++) {
      if (sorted[i].frame <= frame && sorted[i + 1].frame >= frame) {
        before = sorted[i]
        after = sorted[i + 1]
        break
      }
    }

    const range = after.frame - before.frame
    if (range === 0) {
      result[prop] = before.value
      continue
    }

    const t = (frame - before.frame) / range
    const easedT = applyEasing(t, before.easing)
    result[prop] = lerp(before.value, after.value, easedT)
  }

  return result
}

/**
 * Returns whether a keyframe exists at exactly the given frame for a property.
 */
export function hasKeyframeAt(tracks: PropertyTrack[], property: TrackProperty, frame: number): boolean {
  const track = tracks.find((t) => t.property === property)
  if (!track) return false
  return track.keyframes.some((kf) => kf.frame === frame)
}
