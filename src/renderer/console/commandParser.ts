import type { TrackProperty } from '../types/project'

export type ParsedCommand =
  | { type: 'add-image'; assetName: string }
  | { type: 'add-text'; content: string }
  | { type: 'select'; target: string }
  | { type: 'move'; target: string; x: number; y: number }
  | { type: 'scale'; target: string; value: number }
  | { type: 'rotate'; target: string; value: number }
  | { type: 'opacity'; target: string; value: number }
  | { type: 'frame'; value: number }
  | { type: 'keyframe'; target: string; property: TrackProperty }
  | { type: 'duplicate'; target: string }
  | { type: 'delete'; target: string }
  | { type: 'hide'; target: string }
  | { type: 'lock'; target: string }
  | { type: 'export-mp4' }
  | { type: 'run' }

export type ParseResult = { ok: ParsedCommand } | { error: string }

const VALID_PROPERTIES: TrackProperty[] = ['x', 'y', 'scaleX', 'scaleY', 'rotation', 'opacity']

function parseNumber(s: string): number | null {
  const n = Number(s)
  return isNaN(n) ? null : n
}

/**
 * Tokenizes input respecting quoted strings.
 * e.g. add text "hello world" => ['add', 'text', 'hello world']
 */
function tokenize(input: string): string[] {
  const tokens: string[] = []
  let i = 0
  const s = input.trim()
  while (i < s.length) {
    if (s[i] === '"' || s[i] === "'") {
      const quote = s[i]
      i++
      let str = ''
      while (i < s.length && s[i] !== quote) {
        str += s[i++]
      }
      i++ // closing quote
      tokens.push(str)
    } else if (s[i] === ' ') {
      i++
    } else {
      let word = ''
      while (i < s.length && s[i] !== ' ') {
        word += s[i++]
      }
      tokens.push(word)
    }
  }
  return tokens
}

export function parseCommand(input: string): ParseResult {
  const tokens = tokenize(input)
  if (tokens.length === 0) return { error: 'Empty command' }

  const cmd = tokens[0].toLowerCase()

  // export mp4
  if (cmd === 'export' && tokens[1]?.toLowerCase() === 'mp4') {
    return { ok: { type: 'export-mp4' } }
  }

  // frame <n>
  if (cmd === 'frame') {
    const n = parseNumber(tokens[1])
    if (n === null || !Number.isInteger(n) || n < 0) return { error: 'Usage: frame <n>  (n must be a non-negative integer)' }
    return { ok: { type: 'frame', value: n } }
  }

  // add image <assetName>
  // add text "<content>"
  if (cmd === 'add') {
    const sub = tokens[1]?.toLowerCase()
    if (sub === 'image') {
      const assetName = tokens.slice(2).join(' ')
      if (!assetName) return { error: 'Usage: add image <assetName>' }
      return { ok: { type: 'add-image', assetName } }
    }
    if (sub === 'text') {
      const content = tokens.slice(2).join(' ')
      if (!content) return { error: 'Usage: add text "<content>"' }
      return { ok: { type: 'add-text', content } }
    }
    return { error: 'Usage: add image <assetName>  or  add text "<content>"' }
  }

  // select <layerName>
  if (cmd === 'select') {
    const target = tokens.slice(1).join(' ')
    if (!target) return { error: 'Usage: select <layerName>' }
    return { ok: { type: 'select', target } }
  }

  // move <target> x <n> y <n>
  if (cmd === 'move') {
    // tokens: move <target> x <n> y <n>
    // target could be multi-word before 'x'
    const xIdx = tokens.findIndex((t) => t.toLowerCase() === 'x')
    const yIdx = tokens.findIndex((t) => t.toLowerCase() === 'y')
    if (xIdx === -1 || yIdx === -1) return { error: 'Usage: move <target> x <n> y <n>' }
    const target = tokens.slice(1, xIdx).join(' ') || 'selected'
    const x = parseNumber(tokens[xIdx + 1])
    const y = parseNumber(tokens[yIdx + 1])
    if (x === null || y === null) return { error: 'Usage: move <target> x <n> y <n>  (x and y must be numbers)' }
    return { ok: { type: 'move', target, x, y } }
  }

  // scale <target> <value>
  if (cmd === 'scale') {
    if (tokens.length < 3) return { error: 'Usage: scale <target> <value>' }
    const value = parseNumber(tokens[tokens.length - 1])
    if (value === null) return { error: 'Usage: scale <target> <value>  (value must be a number)' }
    const target = tokens.slice(1, tokens.length - 1).join(' ') || 'selected'
    return { ok: { type: 'scale', target, value } }
  }

  // rotate <target> <degrees>
  if (cmd === 'rotate') {
    if (tokens.length < 3) return { error: 'Usage: rotate <target> <degrees>' }
    const value = parseNumber(tokens[tokens.length - 1])
    if (value === null) return { error: 'Usage: rotate <target> <degrees>  (degrees must be a number)' }
    const target = tokens.slice(1, tokens.length - 1).join(' ') || 'selected'
    return { ok: { type: 'rotate', target, value } }
  }

  // opacity <target> <0-100>
  if (cmd === 'opacity') {
    if (tokens.length < 3) return { error: 'Usage: opacity <target> <0-100>' }
    const value = parseNumber(tokens[tokens.length - 1])
    if (value === null || value < 0 || value > 100) return { error: 'Usage: opacity <target> <0-100>  (value must be 0–100)' }
    const target = tokens.slice(1, tokens.length - 1).join(' ') || 'selected'
    return { ok: { type: 'opacity', target, value } }
  }

  // keyframe <target> <property>
  if (cmd === 'keyframe') {
    if (tokens.length < 3) return { error: 'Usage: keyframe <target> <property>' }
    const property = tokens[tokens.length - 1] as TrackProperty
    if (!VALID_PROPERTIES.includes(property)) {
      return { error: `Unknown property "${property}". Valid: ${VALID_PROPERTIES.join(', ')}` }
    }
    const target = tokens.slice(1, tokens.length - 1).join(' ') || 'selected'
    return { ok: { type: 'keyframe', target, property } }
  }

  // duplicate <target>
  if (cmd === 'duplicate') {
    const target = tokens.slice(1).join(' ') || 'selected'
    return { ok: { type: 'duplicate', target } }
  }

  // delete <target>
  if (cmd === 'delete') {
    const target = tokens.slice(1).join(' ') || 'selected'
    return { ok: { type: 'delete', target } }
  }

  // hide <target>
  if (cmd === 'hide') {
    const target = tokens.slice(1).join(' ') || 'selected'
    return { ok: { type: 'hide', target } }
  }

  // lock <target>
  if (cmd === 'lock') {
    const target = tokens.slice(1).join(' ') || 'selected'
    return { ok: { type: 'lock', target } }
  }

  // run (batch script from file)
  if (cmd === 'run') {
    return { ok: { type: 'run' } }
  }

  return { error: `Unknown command "${tokens[0]}". Press Tab or see suggestions.` }
}
