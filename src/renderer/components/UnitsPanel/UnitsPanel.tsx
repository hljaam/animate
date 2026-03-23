import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { createShapeObjectLayer } from '../../utils/layerFactory'
import LibraryItem from '../LibraryPanel/LibraryItem'

export default function UnitsPanel(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const [search, setSearch] = useState('')
  const [selectedObjectId, setSelectedObjectId] = useState<string | null>(null)

  function handleShapeObjectClick(shapeObjectId: string): void {
    setSelectedObjectId(shapeObjectId)
  }

  function handleShapeObjectDoubleClick(shapeObjectId: string): void {
    if (!project) return
    const obj = project.shapeObjects?.find((o) => o.id === shapeObjectId)
    if (!obj) return
    const layer = createShapeObjectLayer(obj, project)
    const state = useProjectStore.getState()
    state.applyAction(`Add layer "${layer.name}"`, (draft) => {
      draft.layers.push(layer)
      draft.layers.sort((a, b) => a.order - b.order)
    })
    useEditorStore.getState().setSelectedLayerId(layer.id)
  }

  const lowerSearch = search.toLowerCase()
  const shapeObjects = (project?.shapeObjects ?? []).filter((o) =>
    o.name.toLowerCase().includes(lowerSearch)
  )

  return (
    <div className="panel" style={styles.panel}>
      <div style={styles.header}>
        <span style={styles.headerTitle}>Units</span>
      </div>

      {shapeObjects.length > 3 && (
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

      <div style={styles.list}>
        {shapeObjects.map((obj) => (
          <LibraryItem
            key={obj.id}
            kind="shapeObject"
            shapeObject={obj}
            onClick={() => handleShapeObjectClick(obj.id)}
            onDoubleClick={() => handleShapeObjectDoubleClick(obj.id)}
            selected={selectedObjectId === obj.id}
          />
        ))}
        {project && shapeObjects.length === 0 && (
          <div style={styles.empty}>
            {search ? 'No matches' : 'No objects yet.\nRight-click a shape\nto create one.'}
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
