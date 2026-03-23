import React, { useState, useEffect } from 'react'
import DocumentTab from './DocumentTab'
import LayerTab from './LayerTab'
import LibraryPanel from '../LibraryPanel/LibraryPanel'
import { useEditorStore } from '../../store/editorStore'

type Tab = 'document' | 'layer' | 'library'

export default function PropertiesPanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('layer')
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)

  useEffect(() => {
    setActiveTab(selectedLayerIds.length > 0 ? 'layer' : 'document')
  }, [selectedLayerIds])

  const tabs: { key: Tab; label: string }[] = [
    { key: 'document', label: 'PROPERTIES' },
    { key: 'layer', label: 'LAYER' }
  ]

  return (
    <div className="panel" style={styles.panel}>
      {/* Tabs */}
      <div style={styles.tabs}>
        {tabs.map((t) => {
          const isActive = activeTab === t.key
          return (
            <button
              key={t.key}
              className="icon-btn"
              style={{
                ...styles.tab,
                borderBottom: isActive ? '2px solid var(--accent)' : '2px solid transparent',
                color: isActive ? 'var(--text-primary)' : 'var(--text-muted)'
              }}
              onClick={() => setActiveTab(t.key)}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'document' && <DocumentTab />}
        {activeTab === 'layer' && <LayerTab onSwitchTab={() => setActiveTab('document')} />}
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  panel: {
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    width: 'var(--right-panel-width)',
    flexShrink: 0
  },
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    padding: '0 4px'
  },
  tab: {
    borderRadius: 0,
    padding: '10px 16px',
    fontSize: 11,
    fontWeight: 600,
    letterSpacing: 0.8,
    flex: 1
  },
  content: {
    flex: 1,
    overflowY: 'auto'
  }
}
