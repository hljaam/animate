import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { createImageLayer, createSymbolLayer, createShapeObjectLayer } from '../../utils/layerFactory'
import LibraryItem from './LibraryItem'

export default function LibraryPanel({ embedded }: { embedded?: boolean }): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const [search, setSearch] = useState('')

  async function handleImport(): Promise<void> {
    if (!project) return
    const results = await window.electronAPI.importAsset(project.id)
    if (!results) return

    const state = useProjectStore.getState()
    for (const assetData of results) {
      const asset = {
        id: assetData.id,
        type: 'image' as const,
        name: assetData.name,
        localBundlePath: assetData.localBundlePath,
        width: assetData.width,
        height: assetData.height
      }
      state.addAsset(asset)
      const layer = createImageLayer(asset, project)
      state.applyAction(`Add layer "${layer.name}"`, (draft) => {
        draft.layers.push(layer)
        draft.layers.sort((a, b) => a.order - b.order)
      })
    }
  }

  function handleImageClick(assetId: string): void {
    if (!project) return
    const asset = project.assets.find((a) => a.id === assetId)
    if (!asset) return
    const layer = createImageLayer(asset, project)
    const state = useProjectStore.getState()
    state.applyAction(`Add layer "${layer.name}"`, (draft) => {
      draft.layers.push(layer)
      draft.layers.sort((a, b) => a.order - b.order)
    })
    useEditorStore.getState().setSelectedLayerId(layer.id)
  }

  function handleSymbolClick(symbolId: string): void {
    if (!project) return
    const sym = project.symbols?.find((s) => s.id === symbolId)
    if (!sym) return
    const layer = createSymbolLayer(sym, project)
    const state = useProjectStore.getState()
    state.applyAction(`Add layer "${layer.name}"`, (draft) => {
      draft.layers.push(layer)
      draft.layers.sort((a, b) => a.order - b.order)
    })
    useEditorStore.getState().setSelectedLayerId(layer.id)
  }

  function handleShapeObjectClick(shapeObjectId: string): void {
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
  const images = (project?.assets ?? []).filter((a) => a.name.toLowerCase().includes(lowerSearch))
  const symbols = (project?.symbols ?? []).filter((s) => s.name.toLowerCase().includes(lowerSearch))
  const shapeObjects = (project?.shapeObjects ?? []).filter((o) => o.name.toLowerCase().includes(lowerSearch))

  const content = (
    <>
      {/* Header with + button */}
      <div style={styles.header}>
        <span style={styles.headerTitle}>Library</span>
        <button
          style={styles.addBtn}
          title="Import Image"
          onClick={handleImport}
          disabled={!project}
        >
          +
        </button>
      </div>

      {/* Search */}
      <div style={styles.searchWrap}>
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={styles.searchInput}
        />
      </div>

      {/* Items list */}
      <div style={styles.list}>
        {/* Raster Assets Section */}
        {images.length > 0 && (
          <>
            <div style={styles.sectionHeader}>RASTER ASSETS</div>
            <div style={styles.imageGrid}>
              {images.map((asset) => (
                <LibraryItem
                  key={asset.id}
                  kind="image"
                  asset={asset}
                  onClick={() => handleImageClick(asset.id)}
                />
              ))}
            </div>
          </>
        )}

        {/* Symbols */}
        {symbols.length > 0 && (
          <>
            <div style={styles.sectionHeader}>SYMBOLS</div>
            {symbols.map((sym) => (
              <LibraryItem
                key={sym.id}
                kind="symbol"
                symbol={sym}
                onClick={() => handleSymbolClick(sym.id)}
              />
            ))}
          </>
        )}

        {/* Shape Objects Section */}
        {shapeObjects.length > 0 && (
          <>
            <div style={styles.sectionHeader}>SHAPE OBJECTS</div>
            {shapeObjects.map((obj) => (
              <LibraryItem
                key={obj.id}
                kind="shapeObject"
                shapeObject={obj}
                onClick={() => handleShapeObjectClick(obj.id)}
              />
            ))}
          </>
        )}

        {!project && (
          <div style={styles.empty}>Create a project first</div>
        )}
        {project && images.length === 0 && symbols.length === 0 && shapeObjects.length === 0 && (
          <div style={styles.empty}>
            {search ? 'No matches' : 'No assets yet.\nClick + to import.'}
          </div>
        )}
      </div>
    </>
  )

  if (embedded) {
    return <div style={{ display: 'flex', flexDirection: 'column', flex: 1, overflow: 'hidden' }}>{content}</div>
  }

  return (
    <div className="panel" style={styles.panel}>
      {content}
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
    border: 'none',
    borderRadius: 4,
    color: '#fff',
    fontSize: 16,
    cursor: 'pointer',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto',
    lineHeight: 1
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
  sectionHeader: {
    fontSize: 10,
    fontWeight: 600,
    color: 'var(--text-muted)',
    letterSpacing: 1,
    textTransform: 'uppercase',
    marginTop: 4,
    marginBottom: 4
  },
  imageGrid: {
    display: 'grid',
    gridTemplateColumns: '1fr 1fr',
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
