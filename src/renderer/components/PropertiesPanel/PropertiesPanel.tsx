import React, { useState } from 'react'
import DocumentTab from './DocumentTab'
import LayerTab from './LayerTab'

type Tab = 'document' | 'layer'

export default function PropertiesPanel(): React.ReactElement {
  const [activeTab, setActiveTab] = useState<Tab>('layer')

  return (
    <div className="panel" style={styles.panel}>
      {/* Tabs */}
      <div style={styles.tabs}>
        <button
          className="icon-btn"
          style={{
            ...styles.tab,
            borderBottom: activeTab === 'document' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'document' ? 'var(--text-primary)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveTab('document')}
        >
          Document
        </button>
        <button
          className="icon-btn"
          style={{
            ...styles.tab,
            borderBottom: activeTab === 'layer' ? '2px solid var(--accent)' : '2px solid transparent',
            color: activeTab === 'layer' ? 'var(--text-primary)' : 'var(--text-muted)'
          }}
          onClick={() => setActiveTab('layer')}
        >
          Layer
        </button>
      </div>

      {/* Content */}
      <div style={styles.content}>
        {activeTab === 'document' ? <DocumentTab /> : <LayerTab />}
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
  tabs: {
    display: 'flex',
    borderBottom: '1px solid var(--border)',
    padding: '0 4px'
  },
  tab: {
    borderRadius: 0,
    padding: '8px 12px',
    fontSize: 12,
    flex: 1
  },
  content: {
    flex: 1,
    overflowY: 'auto'
  }
}
