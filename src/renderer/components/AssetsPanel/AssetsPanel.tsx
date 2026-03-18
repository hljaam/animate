import React from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import AssetThumbnail from './AssetThumbnail'
import { createImageLayer } from '../../utils/layerFactory'
import { AddLayerCommand } from '../../store/commands/AddLayerCommand'

export default function AssetsPanel(): React.ReactElement {
  const project = useProjectStore((s) => s.project)

  async function handleImport(): Promise<void> {
    if (!project) return
    const results = await window.electronAPI.importAsset(project.id)
    if (!results) return

    const state = useProjectStore.getState()
    const editor = useEditorStore.getState()

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

      // Auto-create a layer for the imported asset
      const layer = createImageLayer(asset, project)
      state.history.push(new AddLayerCommand(layer))
    }
  }

  return (
    <div className="panel" style={styles.panel}>
      <div className="panel-header">
        Assets
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
      <div style={styles.list}>
        {project?.assets.map((asset) => (
          <AssetThumbnail key={asset.id} asset={asset} />
        ))}
        {!project && (
          <div style={styles.empty}>Create a project first</div>
        )}
        {project && project.assets.length === 0 && (
          <div style={styles.empty}>No assets yet.<br />Click + to import.</div>
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
    lineHeight: 1.6
  }
}
