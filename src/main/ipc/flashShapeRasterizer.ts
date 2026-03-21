/**
 * Rasterizes Flash DOMShape elements to PNG images.
 * Parses the Flash edge format and renders filled shapes using scanline fill.
 */

interface Point {
  x: number
  y: number
}

interface FillDef {
  index: number
  color: { r: number; g: number; b: number; a: number }
  bitmapPath?: string
  bitmapMatrix?: { a: number; b: number; c: number; d: number; tx: number; ty: number }
}

interface StrokeDef {
  index: number
  color: { r: number; g: number; b: number; a: number }
  weight: number
}

interface ParsedShape {
  fills: FillDef[]
  strokes: StrokeDef[]
  paths: Array<{
    fillIndex: number
    strokeIndex?: number
    points: Point[]
  }>
  bounds: { minX: number; minY: number; maxX: number; maxY: number }
  transform: { tx: number; ty: number }
}

/**
 * Parse a hex color string like "#0066CC" to RGBA.
 */
function parseColor(hex: string): { r: number; g: number; b: number; a: number } {
  hex = hex.replace('#', '')
  const r = parseInt(hex.substring(0, 2), 16) || 0
  const g = parseInt(hex.substring(2, 4), 16) || 0
  const b = parseInt(hex.substring(4, 6), 16) || 0
  return { r, g, b, a: 255 }
}

/**
 * Parse Flash edge format string into a continuous path.
 * ! x y = moveTo (sets current point; continues path if adjacent to previous point)
 * | x y = lineTo
 * [ cx cy x y = quadratic bezier curveTo
 * Coordinates are in twips (1/20 pixel).
 *
 * Flash uses ! before every curve segment to confirm the start point.
 * A moveTo that matches the previous endpoint is a continuation, not a new sub-path.
 */
function parseEdges(edgesStr: string): Point[][] {
  const subPaths: Point[][] = []
  let current: Point[] = []
  const cmdPattern = /([!\|\[])([^!\|\[]*)/g
  let m: RegExpExecArray | null

  while ((m = cmdPattern.exec(edgesStr)) !== null) {
    const cmd = m[1]
    const coordStr = m[2].trim().replace(/[\r\n]+/g, ' ')
    const coords = coordStr.split(/\s+/).map(Number).filter(n => !isNaN(n))

    if (cmd === '!') {
      // moveTo — only start a new sub-path if it's a genuine jump
      if (coords.length >= 2) {
        const nx = coords[0] / 20
        const ny = coords[1] / 20
        if (current.length === 0) {
          current.push({ x: nx, y: ny })
        } else {
          const last = current[current.length - 1]
          const dist = Math.abs(last.x - nx) + Math.abs(last.y - ny)
          if (dist > 0.5) {
            // Genuine jump — save current sub-path and start a new one
            if (current.length >= 3) subPaths.push(current)
            current = [{ x: nx, y: ny }]
          }
          // Otherwise skip — it's just confirming the current position
        }
      }
    } else if (cmd === '|') {
      // lineTo
      if (coords.length >= 2) {
        current.push({ x: coords[0] / 20, y: coords[1] / 20 })
      }
    } else if (cmd === '[') {
      // quadratic bezier: cx cy endX endY
      if (coords.length >= 4 && current.length > 0) {
        const prev = current[current.length - 1]
        const cx = coords[0] / 20
        const cy = coords[1] / 20
        const ex = coords[2] / 20
        const ey = coords[3] / 20
        // Subdivide curve into line segments
        const steps = 8
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const t1 = 1 - t
          const x = t1 * t1 * prev.x + 2 * t1 * t * cx + t * t * ex
          const y = t1 * t1 * prev.y + 2 * t1 * t * cy + t * t * ey
          current.push({ x, y })
        }
      }
    }
  }

  if (current.length >= 3) subPaths.push(current)
  return subPaths
}

/**
 * Parse Flash cubic edge format string into paths.
 * The cubics attribute uses: ! (moveTo), (;hint data q/Q pairs);
 * where q = on-curve anchor point, Q = off-curve control point (quadratic bezier).
 * Coordinates are in twips (1/20 pixel).
 */
function parseCubicEdges(cubicsStr: string): Point[][] {
  const subPaths: Point[][] = []
  let current: Point[] = []

  // Split into segments: ! for moveTo, (;...); for cubic curve blocks
  // Inside cubic blocks, q = anchor, Q = control point
  const tokens: Array<{ type: string; coords: number[] }> = []

  // Parse moveTo commands
  const movePattern = /!(\s*-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
  let m: RegExpExecArray | null
  while ((m = movePattern.exec(cubicsStr)) !== null) {
    tokens.push({ type: 'move', coords: [parseFloat(m[1]), parseFloat(m[2])] })
  }

  // Parse the q/Q point sequences inside (;...); blocks
  // Extract each cubic block
  const blockPattern = /\(;[^)]*?((?:[qQ]-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?\s*)+)\);/g
  while ((m = blockPattern.exec(cubicsStr)) !== null) {
    const blockContent = m[1]
    // Parse q and Q tokens
    const pointPattern = /([qQ])(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
    let pm: RegExpExecArray | null
    while ((pm = pointPattern.exec(blockContent)) !== null) {
      tokens.push({
        type: pm[1] === 'Q' ? 'control' : 'anchor',
        coords: [parseFloat(pm[2]), parseFloat(pm[3])]
      })
    }
  }

  // Now process tokens in order of appearance in the original string
  // Re-parse sequentially
  current = []
  let lastAnchor: Point | null = null
  let pendingControl: Point | null = null

  const seqPattern = /(!-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?)|(\(;[^)]*?\);)|([qQ]-?\d+(?:\.\d+)?\s+-?\d+(?:\.\d+)?)/g
  // Simpler: just parse all commands sequentially
  const cmdPattern = /(!)\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)|([qQ])\s*(-?\d+(?:\.\d+)?)\s+(-?\d+(?:\.\d+)?)/g
  let cm: RegExpExecArray | null

  while ((cm = cmdPattern.exec(cubicsStr)) !== null) {
    if (cm[1] === '!') {
      // moveTo
      const nx = parseFloat(cm[2]) / 20
      const ny = parseFloat(cm[3]) / 20
      if (current.length === 0) {
        current.push({ x: nx, y: ny })
      } else {
        const last = current[current.length - 1]
        const dist = Math.abs(last.x - nx) + Math.abs(last.y - ny)
        if (dist > 0.5) {
          if (current.length >= 3) subPaths.push(current)
          current = [{ x: nx, y: ny }]
        }
      }
      lastAnchor = { x: nx, y: ny }
      pendingControl = null
    } else if (cm[4] === 'Q') {
      // Off-curve control point
      pendingControl = { x: parseFloat(cm[5]) / 20, y: parseFloat(cm[6]) / 20 }
    } else if (cm[4] === 'q') {
      // On-curve anchor point — draw curve from last anchor through control to here
      const ax = parseFloat(cm[5]) / 20
      const ay = parseFloat(cm[6]) / 20
      if (pendingControl && current.length > 0) {
        // Quadratic bezier subdivision
        const prev = current[current.length - 1]
        const cx = pendingControl.x
        const cy = pendingControl.y
        const steps = 8
        for (let i = 1; i <= steps; i++) {
          const t = i / steps
          const t1 = 1 - t
          const x = t1 * t1 * prev.x + 2 * t1 * t * cx + t * t * ax
          const y = t1 * t1 * prev.y + 2 * t1 * t * cy + t * t * ay
          current.push({ x, y })
        }
      } else {
        // No control point — straight line
        current.push({ x: ax, y: ay })
      }
      lastAnchor = { x: ax, y: ay }
      pendingControl = null
    }
  }

  if (current.length >= 3) subPaths.push(current)
  return subPaths
}

/**
 * Chain a bag of directed edge segments into closed contours.
 * Two segments chain when the endpoint of one is within 0.5px of the
 * start-point of another (Manhattan distance).
 */
function chainEdgesIntoContours(edges: Point[][]): Point[][] {
  const remaining = edges.map(e => [...e])
  const contours: Point[][] = []

  while (remaining.length > 0) {
    const contour = remaining.shift()!
    let changed = true
    while (changed) {
      changed = false
      const end = contour[contour.length - 1]
      for (let i = 0; i < remaining.length; i++) {
        const candidateStart = remaining[i][0]
        if (Math.abs(end.x - candidateStart.x) + Math.abs(end.y - candidateStart.y) < 0.5) {
          // Chain: append candidate, skip its first point (it matches our end)
          contour.push(...remaining[i].slice(1))
          remaining.splice(i, 1)
          changed = true
          break
        }
      }
    }
    contours.push(contour)
  }

  return contours
}

/**
 * Parse a DOMShape XML element into a ParsedShape.
 *
 * Flash's edge format is a boundary representation: each Edge element defines
 * a directed segment that borders up to two fill regions (fillStyle0 on the
 * left, fillStyle1 on the right) and optionally a stroke.
 *
 * To reconstruct filled shapes we:
 *  1. Collect every edge segment into per-fill-index buckets.
 *     - fillStyle1 edges go in as-is (right side of the edge direction).
 *     - fillStyle0 edges go in REVERSED (left side → flip direction).
 *  2. Chain the segments in each bucket end-to-start into closed contours.
 *  3. Each closed contour becomes one filled path.
 *  4. Strokes are emitted separately using the original edge direction.
 */
export function parseShape(shapeXml: string): ParsedShape {
  // Parse fills
  const fills: FillDef[] = []
  const fillMatches = [...shapeXml.matchAll(/<FillStyle index="(\d+)">([\s\S]*?)<\/FillStyle>/g)]
  for (const fm of fillMatches) {
    const index = parseInt(fm[1])
    const content = fm[2]
    const bitmapMatch = content.match(/<BitmapFill\s+bitmapPath="([^"]*)"[^>]*>([\s\S]*?)<\/BitmapFill>/)
    if (bitmapMatch) {
      const bitmapPath = bitmapMatch[1]
      const matContent = bitmapMatch[2]
      const matMatch = matContent.match(/<Matrix([^/]*)\/?>/)
      let bitmapMatrix = { a: 1, b: 0, c: 0, d: 1, tx: 0, ty: 0 }
      if (matMatch) {
        const attrs = matMatch[1]
        const getF = (name: string, def: number): number => {
          const m2 = attrs.match(new RegExp(`\\b${name}="([^"]*?)"`))
          return m2 ? parseFloat(m2[1]) : def
        }
        bitmapMatrix = {
          a: getF('a', 1), b: getF('b', 0),
          c: getF('c', 0), d: getF('d', 1),
          tx: getF('tx', 0), ty: getF('ty', 0)
        }
      }
      fills.push({ index, color: { r: 0, g: 0, b: 0, a: 255 }, bitmapPath, bitmapMatrix })
      continue
    }
    const colorMatch = content.match(/<SolidColor(?:\s+color="([^"]*)")?/)
    if (colorMatch) {
      const color = colorMatch[1] ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 255 }
      fills.push({ index, color })
    }
  }

  // Parse strokes
  const strokes: StrokeDef[] = []
  const strokeMatches = [...shapeXml.matchAll(/<StrokeStyle index="(\d+)">([\s\S]*?)<\/StrokeStyle>/g)]
  for (const sm of strokeMatches) {
    const index = parseInt(sm[1])
    const content = sm[2]
    const weightMatch = content.match(/<SolidStroke[^>]*weight="([^"]*)"/)
    const colorMatch = content.match(/<SolidColor(?:\s+color="([^"]*)")?/)
    const weight = weightMatch ? parseFloat(weightMatch[1]) : 1
    const color = colorMatch && colorMatch[1] ? parseColor(colorMatch[1]) : { r: 0, g: 0, b: 0, a: 255 }
    strokes.push({ index, color, weight })
  }

  // ── Collect directed edge segments per fill / stroke ───────────────────
  // fillEdges: fillIndex → list of directed edge segments
  const fillEdges = new Map<number, Point[][]>()
  // strokeEdgePaths: list of { strokeIndex, points }
  const strokeEdgePaths: Array<{ strokeIndex: number; points: Point[] }> = []
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity

  // Match entire <Edge .../> tags so we get ALL attributes regardless of order
  const edgeTagPattern = /<Edge\s+([^>]*)\/?>/g
  for (const tagMatch of shapeXml.matchAll(edgeTagPattern)) {
    const fullAttrs = tagMatch[1]

    const fs0 = parseInt(fullAttrs.match(/fillStyle0="(\d+)"/)?.[1] || '0')
    const fs1 = parseInt(fullAttrs.match(/fillStyle1="(\d+)"/)?.[1] || '0')
    const ss = parseInt(fullAttrs.match(/strokeStyle="(\d+)"/)?.[1] || '0')

    // Parse edge data (an Edge tag may have edges=, cubics=, or both)
    let segments: Point[][] = []
    const edgesAttr = fullAttrs.match(/\bedges="([^"]*)"/)
    const cubicsAttr = fullAttrs.match(/\bcubics="([^"]*)"/)
    if (edgesAttr) segments = parseEdges(edgesAttr[1])
    if (cubicsAttr) segments.push(...parseCubicEdges(cubicsAttr[1]))

    // Update bounds
    for (const seg of segments) {
      for (const p of seg) {
        if (p.x < minX) minX = p.x
        if (p.y < minY) minY = p.y
        if (p.x > maxX) maxX = p.x
        if (p.y > maxY) maxY = p.y
      }
    }

    // fillStyle1 = fill on the RIGHT side of the edge direction → add as-is
    if (fs1 > 0) {
      if (!fillEdges.has(fs1)) fillEdges.set(fs1, [])
      const bucket = fillEdges.get(fs1)!
      for (const seg of segments) {
        if (seg.length >= 2) bucket.push(seg)
      }
    }

    // fillStyle0 = fill on the LEFT side of the edge direction → add REVERSED
    if (fs0 > 0) {
      if (!fillEdges.has(fs0)) fillEdges.set(fs0, [])
      const bucket = fillEdges.get(fs0)!
      for (const seg of segments) {
        if (seg.length >= 2) bucket.push([...seg].reverse())
      }
    }

    // Strokes use the original edge direction
    if (ss > 0) {
      for (const seg of segments) {
        if (seg.length >= 2) strokeEdgePaths.push({ strokeIndex: ss, points: seg })
      }
    }
  }

  // ── Build fill contours by chaining edge segments per fill index ────────
  const paths: ParsedShape['paths'] = []

  for (const [fillIndex, edgeSegs] of fillEdges) {
    const contours = chainEdgesIntoContours(edgeSegs)
    for (const contour of contours) {
      if (contour.length >= 3) {
        paths.push({ fillIndex, points: contour })
      }
    }
  }

  // ── Add stroke paths ───────────────────────────────────────────────────
  for (const sp of strokeEdgePaths) {
    paths.push({ fillIndex: 0, strokeIndex: sp.strokeIndex, points: sp.points })
  }

  // Parse transform
  const matrixMatch = shapeXml.match(/<matrix>\s*<Matrix([^/]*)\/>\s*<\/matrix>/s)
  let tx = 0, ty = 0
  if (matrixMatch) {
    const matAttrs = matrixMatch[1]
    const txMatch = matAttrs.match(/tx="([^"]*)"/)
    const tyMatch = matAttrs.match(/ty="([^"]*)"/)
    if (txMatch) tx = parseFloat(txMatch[1])
    if (tyMatch) ty = parseFloat(tyMatch[1])
  }

  return {
    fills,
    strokes,
    paths,
    bounds: { minX, minY, maxX, maxY },
    transform: { tx, ty }
  }
}

