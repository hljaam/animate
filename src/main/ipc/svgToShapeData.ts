import { readFileSync } from 'fs'

interface ShapePath {
  fillColor?: string
  strokeColor?: string
  strokeWidth?: number
  points: Array<{ x: number; y: number }>
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
  let minX = Infinity,
    minY = Infinity,
    maxX = -Infinity,
    maxY = -Infinity

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

    const subPaths = parseSvgPathD(d)
    for (const points of subPaths) {
      if (points.length < 2) continue

      const shapePath: ShapePath = { points }
      if (fill && fill !== 'none') shapePath.fillColor = normalizeColor(fill)
      if (stroke && stroke !== 'none') {
        shapePath.strokeColor = normalizeColor(stroke)
        shapePath.strokeWidth = strokeWidth ? parseFloat(strokeWidth) : 1
      }
      // Skip paths with no visual
      if (!shapePath.fillColor && !shapePath.strokeColor) continue

      paths.push(shapePath)
      for (const p of points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
    }
  }

  // Also handle <rect>, <circle>, <ellipse>, <polygon>, <polyline>
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
    const points = [
      { x, y },
      { x: x + w, y },
      { x: x + w, y: y + h },
      { x, y: y + h },
      { x, y }
    ]
    const shapePath: ShapePath = { points }
    if (fill && fill !== 'none') shapePath.fillColor = normalizeColor(fill)
    if (stroke && stroke !== 'none') shapePath.strokeColor = normalizeColor(stroke)
    if (shapePath.fillColor || shapePath.strokeColor) {
      paths.push(shapePath)
      for (const p of points) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
    }
  }

  if (paths.length === 0) return null

  return {
    paths,
    originX: (minX + maxX) / 2,
    originY: (minY + maxY) / 2
  }
}

// ── SVG Path D Parser ─────────────────────────────────────────────────────

/**
 * Parse an SVG path `d` attribute into arrays of {x,y} points.
 * Handles M, L, H, V, C, Q, S, T, Z (both absolute and relative).
 * Curves are subdivided into line segments.
 */
function parseSvgPathD(d: string): Array<Array<{ x: number; y: number }>> {
  const allPaths: Array<Array<{ x: number; y: number }>> = []
  let currentPath: Array<{ x: number; y: number }> = []
  let curX = 0,
    curY = 0
  let startX = 0,
    startY = 0

  // Tokenize: split into command + numbers
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
        currentPath = [{ x: curX, y: curY }]
        cmd = 'L' // subsequent coords are lineTo
        break
      }
      case 'm': {
        if (currentPath.length > 0) allPaths.push(currentPath)
        curX += nextNum()
        curY += nextNum()
        startX = curX
        startY = curY
        currentPath = [{ x: curX, y: curY }]
        cmd = 'l'
        break
      }
      case 'L':
        curX = nextNum()
        curY = nextNum()
        currentPath.push({ x: curX, y: curY })
        break
      case 'l':
        curX += nextNum()
        curY += nextNum()
        currentPath.push({ x: curX, y: curY })
        break
      case 'H':
        curX = nextNum()
        currentPath.push({ x: curX, y: curY })
        break
      case 'h':
        curX += nextNum()
        currentPath.push({ x: curX, y: curY })
        break
      case 'V':
        curY = nextNum()
        currentPath.push({ x: curX, y: curY })
        break
      case 'v':
        curY += nextNum()
        currentPath.push({ x: curX, y: curY })
        break
      case 'C': {
        const cx1 = nextNum(),
          cy1 = nextNum()
        const cx2 = nextNum(),
          cy2 = nextNum()
        const ex = nextNum(),
          ey = nextNum()
        subdivideCubic(curX, curY, cx1, cy1, cx2, cy2, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 'c': {
        const cx1 = curX + nextNum(),
          cy1 = curY + nextNum()
        const cx2 = curX + nextNum(),
          cy2 = curY + nextNum()
        const ex = curX + nextNum(),
          ey = curY + nextNum()
        subdivideCubic(curX, curY, cx1, cy1, cx2, cy2, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 'Q': {
        const cx = nextNum(),
          cy = nextNum()
        const ex = nextNum(),
          ey = nextNum()
        subdivideQuadratic(curX, curY, cx, cy, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 'q': {
        const cx = curX + nextNum(),
          cy = curY + nextNum()
        const ex = curX + nextNum(),
          ey = curY + nextNum()
        subdivideQuadratic(curX, curY, cx, cy, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 'S': {
        // Smooth cubic — reflect previous control point
        const cx2 = nextNum(),
          cy2 = nextNum()
        const ex = nextNum(),
          ey = nextNum()
        subdivideCubic(curX, curY, curX, curY, cx2, cy2, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 's': {
        const cx2 = curX + nextNum(),
          cy2 = curY + nextNum()
        const ex = curX + nextNum(),
          ey = curY + nextNum()
        subdivideCubic(curX, curY, curX, curY, cx2, cy2, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 'T': {
        const ex = nextNum(),
          ey = nextNum()
        subdivideQuadratic(curX, curY, curX, curY, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 't': {
        const ex = curX + nextNum(),
          ey = curY + nextNum()
        subdivideQuadratic(curX, curY, curX, curY, ex, ey, currentPath)
        curX = ex
        curY = ey
        break
      }
      case 'Z':
      case 'z':
        curX = startX
        curY = startY
        currentPath.push({ x: curX, y: curY })
        allPaths.push(currentPath)
        currentPath = []
        break
      default:
        // Skip unknown commands (e.g., Arc 'A'/'a')
        i++
        break
    }
  }

  if (currentPath.length > 0) allPaths.push(currentPath)
  return allPaths
}

// ── Curve Subdivision ─────────────────────────────────────────────────────

function subdivideCubic(
  x0: number,
  y0: number,
  cx1: number,
  cy1: number,
  cx2: number,
  cy2: number,
  x3: number,
  y3: number,
  out: Array<{ x: number; y: number }>,
  steps = 12
): void {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps
    const mt = 1 - t
    const x =
      mt * mt * mt * x0 + 3 * mt * mt * t * cx1 + 3 * mt * t * t * cx2 + t * t * t * x3
    const y =
      mt * mt * mt * y0 + 3 * mt * mt * t * cy1 + 3 * mt * t * t * cy2 + t * t * t * y3
    out.push({ x, y })
  }
}

function subdivideQuadratic(
  x0: number,
  y0: number,
  cx: number,
  cy: number,
  x2: number,
  y2: number,
  out: Array<{ x: number; y: number }>,
  steps = 8
): void {
  for (let s = 1; s <= steps; s++) {
    const t = s / steps
    const mt = 1 - t
    const x = mt * mt * x0 + 2 * mt * t * cx + t * t * x2
    const y = mt * mt * y0 + 2 * mt * t * cy + t * t * y2
    out.push({ x, y })
  }
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

function normalizeColor(color: string): string {
  if (color.startsWith('#')) return color.toUpperCase()
  // Handle rgb(r, g, b)
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
  return color
}
