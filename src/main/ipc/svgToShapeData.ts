import { readFileSync } from 'fs'

type ShapeSegment =
  | { type: 'move'; x: number; y: number }
  | { type: 'line'; x: number; y: number }
  | { type: 'cubic'; cx1: number; cy1: number; cx2: number; cy2: number; x: number; y: number }
  | { type: 'quadratic'; cx: number; cy: number; x: number; y: number }
  | { type: 'close' }

interface ShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  hasBitmapFill?: boolean
  segments: ShapeSegment[]
  subPaths?: ShapeSegment[][]
}

interface ShapeData {
  paths: ShapePath[]
  originX: number
  originY: number
}

/**
 * Parse a JPEXS-exported SVG file into the app's ShapeData format.
 */
export function parseSvgFile(svgPath: string): ShapeData | null {
  const svgContent = readFileSync(svgPath, 'utf-8')
  return parseSvgContent(svgContent)
}

/**
 * Parse SVG content string into ShapeData.
 */
export function parseSvgContent(svg: string): ShapeData | null {
  const paths: ShapePath[] = []

  // Extract all <path> elements
  const pathPattern = /<path\s([^>]*)\/?>|<path\s([^>]*)>[\s\S]*?<\/path>/g
  let pm: RegExpExecArray | null
  while ((pm = pathPattern.exec(svg)) !== null) {
    const attrs = pm[1] || pm[2] || ''
    const d = getAttr(attrs, 'd')
    if (!d) continue

    const fill = getAttr(attrs, 'fill') || getStyleProp(attrs, 'fill')
    const stroke = getAttr(attrs, 'stroke') || getStyleProp(attrs, 'stroke')
    const strokeWidth = getAttr(attrs, 'stroke-width') || getStyleProp(attrs, 'stroke-width')

    const fillRule = getAttr(attrs, 'fill-rule') || getStyleProp(attrs, 'fill-rule')

    const subPaths = parseSvgPathD(d)
    const validSubPaths = subPaths.filter((segs) => segs.length >= 2)
    if (validSubPaths.length === 0) continue

    const isBitmapFill = fill ? fill.startsWith('url(') : false
    const hasFill = fill && fill !== 'none'
    if (hasFill && fillRule === 'evenodd' && validSubPaths.length > 1) {
      // Find the sub-path with the largest absolute area (outer contour)
      let outerIdx = 0
      let maxArea = 0
      for (let sp = 0; sp < validSubPaths.length; sp++) {
        const area = Math.abs(signedPolygonArea(flattenSegments(validSubPaths[sp])))
        if (area > maxArea) {
          maxArea = area
          outerIdx = sp
        }
      }

      const outerSegments = validSubPaths[outerIdx]
      const holeSubPaths = validSubPaths.filter((_, idx) => idx !== outerIdx)

      const shapePath: ShapePath = { segments: outerSegments }
      if (isBitmapFill) {
        shapePath.hasBitmapFill = true
      }
      const c = normalizeColor(fill!)
      if (c) shapePath.fillColor = c
      if (stroke && stroke !== 'none') {
        const sc = normalizeColor(stroke)
        if (sc) {
          shapePath.strokeColor = sc
          shapePath.strokeWidth = strokeWidth ? parseFloat(strokeWidth) : 1
        }
      }
      if (holeSubPaths.length > 0) {
        shapePath.subPaths = holeSubPaths
      }
      if (shapePath.fillColor || shapePath.strokeColor || shapePath.hasBitmapFill) {
        paths.push(shapePath)
      }
    } else {
      for (const segments of validSubPaths) {
        const shapePath: ShapePath = { segments }
        if (isBitmapFill) {
          shapePath.hasBitmapFill = true
        }
        if (hasFill) {
          const c = normalizeColor(fill!)
          if (c) shapePath.fillColor = c
        }
        if (stroke && stroke !== 'none') {
          const c = normalizeColor(stroke)
          if (c) {
            shapePath.strokeColor = c
            shapePath.strokeWidth = strokeWidth ? parseFloat(strokeWidth) : 1
          }
        }
        if (!shapePath.fillColor && !shapePath.strokeColor && !shapePath.hasBitmapFill) continue
        paths.push(shapePath)
      }
    }
  }

  // Also handle <rect>
  const rectPattern = /<rect\s([^>]*)\/?>|<rect\s([^>]*)>/g
  let rm: RegExpExecArray | null
  while ((rm = rectPattern.exec(svg)) !== null) {
    const attrs = rm[1] || rm[2] || ''
    const x = parseFloat(getAttr(attrs, 'x') || '0')
    const y = parseFloat(getAttr(attrs, 'y') || '0')
    const w = parseFloat(getAttr(attrs, 'width') || '0')
    const h = parseFloat(getAttr(attrs, 'height') || '0')
    if (w <= 0 || h <= 0) continue

    const fill = getAttr(attrs, 'fill') || getStyleProp(attrs, 'fill')
    const stroke = getAttr(attrs, 'stroke') || getStyleProp(attrs, 'stroke')
    const segments: ShapeSegment[] = [
      { type: 'move', x, y },
      { type: 'line', x: x + w, y },
      { type: 'line', x: x + w, y: y + h },
      { type: 'line', x, y: y + h },
      { type: 'close' }
    ]
    const shapePath: ShapePath = { segments }
    if (fill && fill !== 'none') {
      const c = normalizeColor(fill)
      if (c) shapePath.fillColor = c
    }
    if (stroke && stroke !== 'none') {
      const c = normalizeColor(stroke)
      if (c) shapePath.strokeColor = c
    }
    if (shapePath.fillColor || shapePath.strokeColor) {
      paths.push(shapePath)
    }
  }

  if (paths.length === 0) return null

  return {
    paths,
    originX: 0,
    originY: 0
  }
}

// ── SVG Path D Parser ─────────────────────────────────────────────────────

/**
 * Parse an SVG path `d` attribute into arrays of ShapeSegments.
 * Preserves bezier curves as cubic/quadratic segments instead of flattening.
 */
function parseSvgPathD(d: string): ShapeSegment[][] {
  const allPaths: ShapeSegment[][] = []
  let currentPath: ShapeSegment[] = []
  let curX = 0,
    curY = 0
  let startX = 0,
    startY = 0
  // For smooth curve reflection
  let lastCx = 0,
    lastCy = 0
  let lastCmd = ''

  const tokens = d.match(/[MmLlHhVvCcSsQqTtAaZz]|[+-]?(?:\d+\.?\d*|\.\d+)(?:[eE][+-]?\d+)?/g)
  if (!tokens) return allPaths

  let cmd = ''
  let i = 0

  function nextNum(): number {
    return i < tokens!.length ? parseFloat(tokens![i++]) : 0
  }

  while (i < tokens.length) {
    const token = tokens[i]
    if (/[A-Za-z]/.test(token)) {
      cmd = token
      i++
    }

    switch (cmd) {
      case 'M': {
        if (currentPath.length > 0) allPaths.push(currentPath)
        curX = nextNum()
        curY = nextNum()
        startX = curX
        startY = curY
        currentPath = [{ type: 'move', x: curX, y: curY }]
        cmd = 'L'
        break
      }
      case 'm': {
        if (currentPath.length > 0) allPaths.push(currentPath)
        curX += nextNum()
        curY += nextNum()
        startX = curX
        startY = curY
        currentPath = [{ type: 'move', x: curX, y: curY }]
        cmd = 'l'
        break
      }
      case 'L':
        curX = nextNum()
        curY = nextNum()
        currentPath.push({ type: 'line', x: curX, y: curY })
        break
      case 'l':
        curX += nextNum()
        curY += nextNum()
        currentPath.push({ type: 'line', x: curX, y: curY })
        break
      case 'H':
        curX = nextNum()
        currentPath.push({ type: 'line', x: curX, y: curY })
        break
      case 'h':
        curX += nextNum()
        currentPath.push({ type: 'line', x: curX, y: curY })
        break
      case 'V':
        curY = nextNum()
        currentPath.push({ type: 'line', x: curX, y: curY })
        break
      case 'v':
        curY += nextNum()
        currentPath.push({ type: 'line', x: curX, y: curY })
        break
      case 'C': {
        const cx1 = nextNum(), cy1 = nextNum()
        const cx2 = nextNum(), cy2 = nextNum()
        const ex = nextNum(), ey = nextNum()
        currentPath.push({ type: 'cubic', cx1, cy1, cx2, cy2, x: ex, y: ey })
        lastCx = cx2
        lastCy = cy2
        curX = ex
        curY = ey
        lastCmd = 'C'
        continue
      }
      case 'c': {
        const cx1 = curX + nextNum(), cy1 = curY + nextNum()
        const cx2 = curX + nextNum(), cy2 = curY + nextNum()
        const ex = curX + nextNum(), ey = curY + nextNum()
        currentPath.push({ type: 'cubic', cx1, cy1, cx2, cy2, x: ex, y: ey })
        lastCx = cx2
        lastCy = cy2
        curX = ex
        curY = ey
        lastCmd = 'C'
        continue
      }
      case 'S': {
        // Smooth cubic — reflect previous control point
        const rcx1 = lastCmd === 'C' ? 2 * curX - lastCx : curX
        const rcy1 = lastCmd === 'C' ? 2 * curY - lastCy : curY
        const cx2 = nextNum(), cy2 = nextNum()
        const ex = nextNum(), ey = nextNum()
        currentPath.push({ type: 'cubic', cx1: rcx1, cy1: rcy1, cx2, cy2, x: ex, y: ey })
        lastCx = cx2
        lastCy = cy2
        curX = ex
        curY = ey
        lastCmd = 'C'
        continue
      }
      case 's': {
        const rcx1 = lastCmd === 'C' ? 2 * curX - lastCx : curX
        const rcy1 = lastCmd === 'C' ? 2 * curY - lastCy : curY
        const cx2 = curX + nextNum(), cy2 = curY + nextNum()
        const ex = curX + nextNum(), ey = curY + nextNum()
        currentPath.push({ type: 'cubic', cx1: rcx1, cy1: rcy1, cx2, cy2, x: ex, y: ey })
        lastCx = cx2
        lastCy = cy2
        curX = ex
        curY = ey
        lastCmd = 'C'
        continue
      }
      case 'Q': {
        const cx = nextNum(), cy = nextNum()
        const ex = nextNum(), ey = nextNum()
        currentPath.push({ type: 'quadratic', cx, cy, x: ex, y: ey })
        lastCx = cx
        lastCy = cy
        curX = ex
        curY = ey
        lastCmd = 'Q'
        continue
      }
      case 'q': {
        const cx = curX + nextNum(), cy = curY + nextNum()
        const ex = curX + nextNum(), ey = curY + nextNum()
        currentPath.push({ type: 'quadratic', cx, cy, x: ex, y: ey })
        lastCx = cx
        lastCy = cy
        curX = ex
        curY = ey
        lastCmd = 'Q'
        continue
      }
      case 'T': {
        const rcx = lastCmd === 'Q' ? 2 * curX - lastCx : curX
        const rcy = lastCmd === 'Q' ? 2 * curY - lastCy : curY
        const ex = nextNum(), ey = nextNum()
        currentPath.push({ type: 'quadratic', cx: rcx, cy: rcy, x: ex, y: ey })
        lastCx = rcx
        lastCy = rcy
        curX = ex
        curY = ey
        lastCmd = 'Q'
        continue
      }
      case 't': {
        const rcx = lastCmd === 'Q' ? 2 * curX - lastCx : curX
        const rcy = lastCmd === 'Q' ? 2 * curY - lastCy : curY
        const ex = curX + nextNum(), ey = curY + nextNum()
        currentPath.push({ type: 'quadratic', cx: rcx, cy: rcy, x: ex, y: ey })
        lastCx = rcx
        lastCy = rcy
        curX = ex
        curY = ey
        lastCmd = 'Q'
        continue
      }
      case 'Z':
      case 'z':
        currentPath.push({ type: 'close' })
        curX = startX
        curY = startY
        allPaths.push(currentPath)
        currentPath = []
        break
      default:
        i++
        break
    }
    lastCmd = cmd
  }

  if (currentPath.length > 0) allPaths.push(currentPath)
  return allPaths
}

// ── Flatten segments to points (for area calculation) ────────────────────

function flattenSegments(segments: ShapeSegment[]): Array<{ x: number; y: number }> {
  const pts: Array<{ x: number; y: number }> = []
  let curX = 0, curY = 0
  for (const seg of segments) {
    switch (seg.type) {
      case 'move':
        curX = seg.x; curY = seg.y
        pts.push({ x: curX, y: curY })
        break
      case 'line':
        curX = seg.x; curY = seg.y
        pts.push({ x: curX, y: curY })
        break
      case 'cubic': {
        // Subdivide for area estimation
        const steps = 8
        for (let s = 1; s <= steps; s++) {
          const t = s / steps, mt = 1 - t
          pts.push({
            x: mt*mt*mt*curX + 3*mt*mt*t*seg.cx1 + 3*mt*t*t*seg.cx2 + t*t*t*seg.x,
            y: mt*mt*mt*curY + 3*mt*mt*t*seg.cy1 + 3*mt*t*t*seg.cy2 + t*t*t*seg.y
          })
        }
        curX = seg.x; curY = seg.y
        break
      }
      case 'quadratic': {
        const steps = 6
        for (let s = 1; s <= steps; s++) {
          const t = s / steps, mt = 1 - t
          pts.push({
            x: mt*mt*curX + 2*mt*t*seg.cx + t*t*seg.x,
            y: mt*mt*curY + 2*mt*t*seg.cy + t*t*seg.y
          })
        }
        curX = seg.x; curY = seg.y
        break
      }
      case 'close':
        break
    }
  }
  return pts
}

// ── Polygon Area (Shoelace Formula) ───────────────────────────────────────

function signedPolygonArea(pts: Array<{ x: number; y: number }>): number {
  let area = 0
  for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
    area += (pts[j].x - pts[i].x) * (pts[j].y + pts[i].y)
  }
  return area / 2
}

// ── SVG Attribute Helpers ─────────────────────────────────────────────────

function getAttr(attrs: string, name: string): string | null {
  const re = new RegExp(`${name}\\s*=\\s*"([^"]*)"`)
  const m = attrs.match(re)
  return m ? m[1] : null
}

function getStyleProp(attrs: string, prop: string): string | null {
  const styleMatch = attrs.match(/style\s*=\s*"([^"]*)"/)
  if (!styleMatch) return null
  const re = new RegExp(`${prop}\\s*:\\s*([^;]+)`)
  const m = styleMatch[1].match(re)
  return m ? m[1].trim() : null
}

function normalizeColor(color: string): string | null {
  if (color.startsWith('#')) return color.toUpperCase()
  const rgbMatch = color.match(/rgb\(\s*(\d+)\s*,\s*(\d+)\s*,\s*(\d+)\s*\)/)
  if (rgbMatch) {
    const r = parseInt(rgbMatch[1])
    const g = parseInt(rgbMatch[2])
    const b = parseInt(rgbMatch[3])
    return (
      '#' +
      ((1 << 24) | (r << 16) | (g << 8) | b).toString(16).slice(1).toUpperCase()
    )
  }
  if (color.startsWith('url(') || color.startsWith('var(')) return null
  return color
}
