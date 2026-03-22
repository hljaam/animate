import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { createImageLayer, createSymbolLayer } from '../../utils/layerFactory'
import { AddLayerCommand } from '../../store/commands/AddLayerCommand'
import LibraryItem from './LibraryItem'

type FilterMode = 'all' | 'images' | 'symbols'

export default function LibraryPanel(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const [filter, setFilter] = useState<FilterMode>('all')
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
      state.history.push(new AddLayerCommand(layer))
    }
  }

  function handleImageClick(assetId: string): void {
    if (!project) return
    const asset = project.assets.find((a) => a.id === assetId)
    if (!asset) return
    const layer = createImageLayer(asset, project)
    const state = useProjectStore.getState()
    state.history.push(new AddLayerCommand(layer))
    useEditorStore.getState().setSelectedLayerId(layer.id)
  }

  function handleSymbolClick(symbolId: string): void {
    if (!project) return
    const sym = project.symbols?.find((s) => s.id === symbolId)
    if (!sym) return
    const layer = createSymbolLayer(sym, project)
    const state = useProjectStore.getState()
    state.history.push(new AddLayerCommand(layer))
    useEditorStore.getState().setSelectedLayerId(layer.id)
  }

  const lowerSearch = search.toLowerCase()
  const images = (filter === 'all' || filter === 'images')
    ? (project?.assets ?? []).filter((a) => a.name.toLowerCase().includes(lowerSearch))
    : []
  const symbols = (filter === 'all' || filter === 'symbols')
    ? (project?.symbols ?? []).filter((s) => s.name.toLowerCase().includes(lowerSearch))
    : []

  return (
    <div className="panel" style={styles.panel}>
      <div className="panel-header">
        Library
        <button
          className="icon-btn"
          style={{ fontSize: 16, lineHeight: 1, padding: '0 6px' }}
          title="Import Image"
          onClick={handleImport}
          disabled={!project}
        >
          +
        </button>
      </div>

      {/* Filter + search */}
      <div style={styles.controls}>
        <div style={styles.filterRow}>
          {(['all', 'images', 'symbols'] as const).map((f) => (
            <button
              key={f}
              className="icon-btn"
              style={{
                fontSize: 10,
                padding: '2px 6px',
                background: filter === f ? 'var(--accent)' : undefined,
                color: filter === f ? '#fff' : undefined,
                borderRadius: 3
              }}
              onClick={() => setFilter(f)}
            >
              {f.charAt(0).toUpperCase() + f.slice(1)}
            </button>
          ))}
        </div>
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
        {images.map((asset) => (
          <LibraryItem
            key={asset.id}
            kind="image"
            asset={asset}
            onClick={() => handleImageClick(asset.id)}
          />
        ))}
        {symbols.map((sym) => (
          <LibraryItem
            key={sym.id}
            kind="symbol"
            symbol={sym}
            onClick={() => handleSymbolClick(sym.id)}
          />
        ))}
        {!project && (
          <div style={styles.empty}>Create a project first</div>
        )}
        {project && images.length === 0 && symbols.length === 0 && (
          <div style={styles.empty}>
            {search ? 'No matches' : 'No assets yet.\nClick + to import.'}
          </div>
        )}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden'
  },
  controls: {
    padding: '6px 8px',
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    borderBottom: '1px solid var(--border)'
  },
  filterRow: {
    display: 'flex',
    gap: 4
  },
  searchInput: {
    fontSize: 11,
    padding: '3px 6px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--border)',
    borderRadius: 3,
    color: 'var(--text)',
    outline: 'none'
  },
  list: {
    flex: 1,
    overflowY: 'auto',
    padding: 8,
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
