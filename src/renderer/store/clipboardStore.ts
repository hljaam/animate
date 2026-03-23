import type { Layer } from '../types/project'

/**
 * Simple in-memory clipboard for layer copy/paste.
 * Stores deep-cloned snapshots of copied layers,
 * plus the center position of the copied group so paste
 * can place layers relative to a new target position.
 */
let clipboard: Layer[] = []
let clipboardCenterX = 0
let clipboardCenterY = 0

function getTrackValue(layer: Layer, prop: 'x' | 'y'): number {
  const track = layer.tracks.find((t) => t.property === prop)
  if (!track || track.keyframes.length === 0) return 0
  return track.keyframes[0].value
}

export function copyLayers(layers: Layer[]): void {
  clipboard = JSON.parse(JSON.stringify(layers))

  // Compute center of the copied group (using first keyframe positions)
  if (layers.length > 0) {
    let sumX = 0
    let sumY = 0
    for (const layer of layers) {
      sumX += getTrackValue(layer, 'x')
      sumY += getTrackValue(layer, 'y')
    }
    clipboardCenterX = sumX / layers.length
    clipboardCenterY = sumY / layers.length
  }
}

export function getClipboard(): Layer[] {
  return clipboard
}

export function getClipboardCenter(): { x: number; y: number } {
  return { x: clipboardCenterX, y: clipboardCenterY }
}

export function hasClipboardContent(): boolean {
  return clipboard.length > 0
}

// ── Frame-level clipboard ────────────────────────────────────────────────────

import type { Keyframe as KF, TrackProperty } from '../types/project'

interface FrameClipboardEntry {
  property: TrackProperty
  value: number
  easing: KF['easing']
}

let frameClipboard: FrameClipboardEntry[] = []

export function copyFrameKeyframes(entries: FrameClipboardEntry[]): void {
  frameClipboard = JSON.parse(JSON.stringify(entries))
}

export function getFrameClipboard(): FrameClipboardEntry[] {
  return frameClipboard
}

export function hasFrameClipboard(): boolean {
  return frameClipboard.length > 0
}
