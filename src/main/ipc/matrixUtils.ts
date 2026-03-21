// ── Matrix Types ──────────────────────────────────────────────────────────

export interface Matrix2D {
  a: number
  b: number
  c: number
  d: number
  tx: number
  ty: number
}

export const IDENTITY_MATRIX: Matrix2D = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }

// ── Matrix Math ──────────────────────────────────────────────────────────

export function decomposeMatrix(
  a: number,
  b: number,
  c: number,
  d: number
): { scaleX: number; scaleY: number; rotation: number } {
  const scaleX = Math.sqrt(a * a + b * b)
  const scaleY = Math.sqrt(c * c + d * d)
  const rotation = Math.atan2(b, a) * (180 / Math.PI)
  return { scaleX, scaleY, rotation }
}

export function multiplyMatrices(outer: Matrix2D, inner: Matrix2D): Matrix2D {
  return {
    a: outer.a * inner.a + outer.b * inner.c,
    b: outer.a * inner.b + outer.b * inner.d,
    c: outer.c * inner.a + outer.d * inner.c,
    d: outer.c * inner.b + outer.d * inner.d,
    tx: outer.a * inner.tx + outer.b * inner.ty + outer.tx,
    ty: outer.c * inner.tx + outer.d * inner.ty + outer.ty
  }
}

/**
 * Parse a matrix from JPEXS dumpSWF XML node attributes.
 * JPEXS uses: scaleX, scaleY, rotateSkew0, rotateSkew1, translateX, translateY
 * Values are already in float format (not epsilons).
 */
export function parseMatrixFromXml(node: Record<string, any>): Matrix2D {
  if (!node) return { ...IDENTITY_MATRIX }
  return {
    a: parseFloat(node.scaleX ?? node.ScaleX ?? '1') || 1,
    b: parseFloat(node.rotateSkew0 ?? node.RotateSkew0 ?? '0') || 0,
    c: parseFloat(node.rotateSkew1 ?? node.RotateSkew1 ?? '0') || 0,
    d: parseFloat(node.scaleY ?? node.ScaleY ?? '1') || 1,
    tx: parseFloat(node.translateX ?? node.TranslateX ?? '0') || 0,
    ty: parseFloat(node.translateY ?? node.TranslateY ?? '0') || 0
  }
}

// ── Color Utilities ───────────────────────────────────────────────────────

export function rgbToHex(r: number, g: number, b: number): string {
  return (
    '#' +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()
  )
}

export function rgbaToHex(r: number, g: number, b: number, a: number): string {
  if (a === undefined || a >= 255) return rgbToHex(r, g, b)
  return (
    '#' +
    ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase() +
    a.toString(16).padStart(2, '0').toUpperCase()
  )
}
