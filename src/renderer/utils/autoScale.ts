/**
 * Computes a uniform scale factor so the asset fits inside the canvas.
 * Returns 1 if the asset already fits.
 */
export function computeFitScale(
  assetWidth: number,
  assetHeight: number,
  canvasWidth: number,
  canvasHeight: number
): number {
  if (assetWidth <= 0 || assetHeight <= 0) return 1
  const scaleX = canvasWidth / assetWidth
  const scaleY = canvasHeight / assetHeight
  const scale = Math.min(scaleX, scaleY, 1)
  return scale
}
