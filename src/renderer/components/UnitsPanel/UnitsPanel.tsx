import React, { useState, useRef, useEffect } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { generateId } from '../../utils/idGenerator'
import UnitItem from './UnitItem'

export default function UnitsPanel(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const [search, setSearch] = useState('')
  const [creating, setCreating] = useState(false)
  const [newName, setNewName] = useState('')
  const createRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (creating && createRef.current) {
      createRef.current.focus()
    }
  }, [creating])

  function handleCreate(): void {
    const trimmed = newName.trim()
    if (!trimmed) return
    useProjectStore.getState().applyAction(`Create unit "${trimmed}"`, (draft) => {
      if (!draft.units) draft.units = []
      draft.units.push({
        id: generateId(),
        name: trimmed,
        shapeObjectIds: [],
        symbolIds: []
      })
    })
    setNewName('')
    setCreating(false)
  }

  const lowerSearch = search.toLowerCase()
  const units = (project?.units ?? []).filter((u) =>
    u.name.toLowerCase().includes(lowerSearch)
  )

  return (
    <div className="panel" style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Units</span>
        {project && (
          <button
            className="!min-h-0 !min-w-0 !p-0 !border-none"
            style={styles.addBtn}
            title="Create Unit"
            onClick={() => { setCreating(true); setNewName('') }}
          >
            +
          </button>
        )}
      </div>

      {/* Inline create input */}
      {creating && (
        <div style={styles.createWrap}>
          <input
            ref={createRef}
            type="text"
            placeholder="Unit name..."
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleCreate()
              if (e.key === 'Escape') setCreating(false)
            }}
            onBlur={() => {
              if (newName.trim()) handleCreate()
              else setCreating(false)
            }}
            style={styles.createInput}
          />
        </div>
      )}

      {/* Search */}
      {(project?.units?.length ?? 0) > 3 && (
        <div style={styles.searchWrap}>
          <input
            type="text"
            placeholder="Search..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={styles.searchInput}
          />
        </div>
      )}

      {/* Units list */}
      <div style={styles.list}>
        {units.map((unit) => (
          <UnitItem key={unit.id} unit={unit} />
        ))}
        {project && units.length === 0 && !creating && (
          <div style={styles.empty}>
            {search ? 'No matches' : 'No units yet.\nClick + to create one.'}
          </div>
        )}
        {!project && (
          <div style={styles.empty}>Create a project first</div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flex: 1
  },
  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '10px 12px',
    borderBottom: '1px solid var(--border)'
  },
  headerTitle: {
    fontSize: 11,
    fontWeight: 600,
    textTransform: 'uppercase',
    letterSpacing: 1,
    color: 'var(--text-secondary)'
  },
  addBtn: {
    width: 24,
    height: 24,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    background: 'var(--accent)',
    borderRadius: 4,
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    lineHeight: 1
  },
  createWrap: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)'
  },
  createInput: {
    fontSize: 12,
    padding: '6px 8px',
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-primary)',
    border: '1px solid var(--accent)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none'
  },
  searchWrap: {
    padding: '8px 12px',
    borderBottom: '1px solid var(--border)'
  },
  searchInput: {
    fontSize: 11,
    padding: '6px 8px',
    width: '100%',
    boxSizing: 'border-box',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    color: 'var(--text-primary)',
    outline: 'none'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 12,
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  empty: {
    color: 'var(--text-muted)',
    fontSize: 12,
    textAlign: 'center',
    padding: '20px 8px',
    lineHeight: 1.6,
    whiteSpace: 'pre-line'
  }
}
