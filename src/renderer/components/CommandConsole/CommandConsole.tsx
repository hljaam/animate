import React, { useState, useRef, useEffect, useCallback } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { parseCommand } from '../../console/commandParser'
import { executeCommand } from '../../console/commandExecutor'
import { useExport } from '../../hooks/useExport'

const COMMAND_TEMPLATES = [
  'add image <assetName>',
  'add text "<content>"',
  'select <layerName>',
  'move <target> x <n> y <n>',
  'scale <target> <n>',
  'rotate <target> <degrees>',
  'opacity <target> <0-100>',
  'frame <n>',
  'keyframe <target> <property>',
  'duplicate <target>',
  'delete <target>',
  'hide <target>',
  'lock <target>',
  'export mp4'
]

export default function CommandConsole(): React.ReactElement {
  const setShowCommandConsole = useEditorStore((s) => s.setShowCommandConsole)
  const { exportProject } = useExport()

  const [input, setInput] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [suggestions, setSuggestions] = useState<string[]>([])
  const [suggestionIndex, setSuggestionIndex] = useState(-1)
  const [history, setHistory] = useState<string[]>([])
  const [historyIndex, setHistoryIndex] = useState(-1)

  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    inputRef.current?.focus()
  }, [])

  const dismiss = useCallback(() => {
    setShowCommandConsole(false)
  }, [setShowCommandConsole])

  function updateInput(value: string): void {
    setInput(value)
    setError(null)
    setHistoryIndex(-1)

    if (!value.trim()) {
      setSuggestions([])
      setSuggestionIndex(-1)
      return
    }

    const lower = value.toLowerCase()
    const filtered = COMMAND_TEMPLATES.filter((t) => t.toLowerCase().startsWith(lower)).slice(0, 5)
    setSuggestions(filtered)
    setSuggestionIndex(-1)
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>): void {
    if (e.key === 'Escape') {
      dismiss()
      return
    }

    if (e.key === 'ArrowDown') {
      e.preventDefault()
      if (suggestions.length > 0) {
        setSuggestionIndex((i) => Math.min(i + 1, suggestions.length - 1))
      } else if (history.length > 0) {
        const next = Math.max(historyIndex - 1, 0)
        setHistoryIndex(next)
        setInput(history[next])
        setError(null)
      }
      return
    }

    if (e.key === 'ArrowUp') {
      e.preventDefault()
      if (suggestions.length > 0) {
        setSuggestionIndex((i) => Math.max(i - 1, -1))
      } else if (history.length > 0) {
        const next = Math.min(historyIndex + 1, history.length - 1)
        setHistoryIndex(next)
        setInput(history[next])
        setError(null)
      }
      return
    }

    if (e.key === 'Enter') {
      e.preventDefault()
      const text = suggestionIndex >= 0 ? suggestions[suggestionIndex] : input
      if (!text.trim()) return
      submitCommand(text)
    }

    if (e.key === 'Tab') {
      e.preventDefault()
      if (suggestions.length > 0) {
        const pick = suggestions[Math.max(suggestionIndex, 0)]
        setInput(pick)
        setSuggestions([])
        setSuggestionIndex(-1)
      }
    }
  }

  function submitCommand(text: string): void {
    const parseResult = parseCommand(text)
    if ('error' in parseResult) {
      setError(parseResult.error)
      return
    }

    const execResult = executeCommand(parseResult.ok, exportProject)
    if ('error' in execResult) {
      setError(execResult.error)
      return
    }

    setHistory((h) => [text, ...h].slice(0, 50))
    dismiss()
  }

  function handleSuggestionClick(suggestion: string): void {
    setInput(suggestion)
    setSuggestions([])
    setSuggestionIndex(-1)
    inputRef.current?.focus()
  }

  return (
    <>
      {/* Backdrop */}
      <div onClick={dismiss} style={styles.backdrop} />

      {/* Console panel */}
      <div style={styles.panel}>
        <input
          ref={inputRef}
          value={input}
          onChange={(e) => updateInput(e.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Type a command…"
          spellCheck={false}
          style={styles.input}
        />

        {error && <div style={styles.error}>{error}</div>}

        {suggestions.length > 0 && (
          <ul style={styles.suggestions}>
            {suggestions.map((s, i) => (
              <li
                key={s}
                onClick={() => handleSuggestionClick(s)}
                style={{
                  ...styles.suggestionItem,
                  ...(i === suggestionIndex ? styles.suggestionItemActive : {})
                }}
              >
                {s}
              </li>
            ))}
          </ul>
        )}
      </div>
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  backdrop: {
    position: 'fixed',
    inset: 0,
    zIndex: 900
  },
  panel: {
    position: 'fixed',
    top: 80,
    left: '50%',
    transform: 'translateX(-50%)',
    width: 560,
    zIndex: 901,
    background: 'var(--bg-secondary, #1e1e2e)',
    border: '1px solid var(--border-color, #3a3a4a)',
    borderRadius: 6,
    boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
    overflow: 'hidden'
  },
  input: {
    width: '100%',
    boxSizing: 'border-box',
    padding: '12px 16px',
    fontFamily: 'monospace',
    fontSize: 14,
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: 'var(--text-primary, #cdd6f4)',
    caretColor: 'var(--accent, #89b4fa)'
  },
  error: {
    padding: '6px 16px 10px',
    fontSize: 12,
    color: '#f38ba8',
    fontFamily: 'monospace'
  },
  suggestions: {
    listStyle: 'none',
    margin: 0,
    padding: '4px 0',
    borderTop: '1px solid var(--border-color, #3a3a4a)'
  },
  suggestionItem: {
    padding: '7px 16px',
    fontFamily: 'monospace',
    fontSize: 13,
    cursor: 'pointer',
    color: 'var(--text-secondary, #a6adc8)'
  },
  suggestionItemActive: {
    background: 'var(--accent-muted, #313244)',
    color: 'var(--text-primary, #cdd6f4)'
  }
}
