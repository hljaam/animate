import React from 'react'
import { useEditorStore } from '../../store/editorStore'
import type { ActiveTool } from '../../store/editorStore'

interface ToolDef {
  id: string
  label: string
  icon: React.ReactNode
  tool?: ActiveTool
}

const tools: ToolDef[] = [
  {
    id: 'select',
    label: 'Selection',
    tool: 'select',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M4 3l10 7-5 1-2 5L4 3z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'brush',
    label: 'Brush',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M12 3l4 4-7 7H5v-4l7-7z" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
      </svg>
    )
  },
  {
    id: 'transform',
    label: 'Transform',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="1" stroke="currentColor" strokeWidth="1.5"/>
        <circle cx="3" cy="3" r="1.5" fill="currentColor"/>
        <circle cx="17" cy="3" r="1.5" fill="currentColor"/>
        <circle cx="3" cy="17" r="1.5" fill="currentColor"/>
        <circle cx="17" cy="17" r="1.5" fill="currentColor"/>
      </svg>
    )
  },
  {
    id: 'path',
    label: 'Path',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <path d="M3 17C3 10 10 10 10 10S17 10 17 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        <circle cx="3" cy="17" r="2" stroke="currentColor" strokeWidth="1.2"/>
        <circle cx="17" cy="3" r="2" stroke="currentColor" strokeWidth="1.2"/>
      </svg>
    )
  },
  {
    id: 'assets',
    label: 'Assets',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="3" width="14" height="14" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M3 14l4-4 3 3 3-3 4 4" stroke="currentColor" strokeWidth="1.5" strokeLinejoin="round"/>
        <circle cx="13" cy="7" r="1.5" fill="currentColor"/>
      </svg>
    )
  },
  {
    id: 'library',
    label: 'Library',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="3" y="2" width="14" height="16" rx="2" stroke="currentColor" strokeWidth="1.5"/>
        <path d="M7 6h6M7 10h6M7 14h3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  },
  {
    id: 'units',
    label: 'Units',
    icon: (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
        <rect x="2" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="2" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="2" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
        <rect x="11" y="11" width="7" height="7" rx="1.5" stroke="currentColor" strokeWidth="1.5"/>
      </svg>
    )
  }
]

interface ToolSidebarProps {
  activePanel: string
  onPanelChange: (panel: string) => void
}

export default function ToolSidebar({ activePanel, onPanelChange }: ToolSidebarProps): React.ReactElement {
  const activeTool = useEditorStore((s) => s.activeTool)

  function handleClick(tool: ToolDef): void {
    if (tool.tool) {
      useEditorStore.getState().setActiveTool(tool.tool)
    }
    onPanelChange(tool.id)
  }

  return (
    <div style={styles.sidebar}>
      <div style={styles.toolList}>
        {tools.map((tool) => {
          const isActive = activePanel === tool.id || (tool.tool && activeTool === tool.tool)
          return (
            <button
              key={tool.id}
              onClick={() => handleClick(tool)}
              title={tool.label}
              style={{
                ...styles.toolBtn,
                color: isActive ? 'var(--accent)' : 'var(--text-secondary)',
                background: isActive ? 'var(--accent-dim)' : 'transparent'
              }}
            >
              {tool.icon}
              <span style={styles.toolLabel}>{tool.label}</span>
            </button>
          )
        })}
      </div>

      {/* Bottom icons */}
      <div style={styles.bottomTools}>
        <button style={styles.toolBtn} title="Settings">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="3" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M10 2v2M10 16v2M2 10h2M16 10h2M4.9 4.9l1.4 1.4M13.7 13.7l1.4 1.4M4.9 15.1l1.4-1.4M13.7 6.3l1.4-1.4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
          </svg>
          <span style={styles.toolLabel}></span>
        </button>
        <button style={styles.toolBtn} title="Help">
          <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="7" stroke="currentColor" strokeWidth="1.5"/>
            <path d="M8 8a2 2 0 113 1.7c-.5.4-1 .9-1 1.6V12" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
            <circle cx="10" cy="14.5" r="0.75" fill="currentColor"/>
          </svg>
          <span style={styles.toolLabel}></span>
        </button>
      </div>
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  sidebar: {
    width: 'var(--toolbar-width)',
    background: 'var(--bg-secondary)',
    borderRight: '1px solid var(--border)',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    paddingTop: 8,
    paddingBottom: 8,
    flexShrink: 0,
    justifyContent: 'space-between'
  },
  toolList: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2
  },
  toolBtn: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
    width: 44,
    height: 44,
    border: 'none',
    borderRadius: 6,
    cursor: 'pointer',
    color: 'var(--text-secondary)',
    background: 'transparent',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto',
    transition: 'background 0.15s, color 0.15s'
  },
  toolLabel: {
    fontSize: 8,
    letterSpacing: 0.3,
    lineHeight: 1
  },
  bottomTools: {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 2
  }
}
