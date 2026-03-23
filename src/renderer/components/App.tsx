import React, { useState } from 'react'
import TopBar from './TopBar/TopBar'
import ToolSidebar from './ToolSidebar/ToolSidebar'
import LibraryPanel from './LibraryPanel/LibraryPanel'
import UnitsPanel from './UnitsPanel/UnitsPanel'
import StageContainer from './Stage/StageContainer'
import PropertiesPanel from './PropertiesPanel/PropertiesPanel'
import Timeline from './Timeline/Timeline'
import NewProjectDialog from './Modals/NewProjectDialog'
import ExportProgressModal from './Modals/ExportProgressModal'
import CreateObjectDialog from './Modals/CreateObjectDialog'
import CommandConsole from './CommandConsole/CommandConsole'
import CanvasContextMenu from './Stage/CanvasContextMenu'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { usePlayback } from '../hooks/usePlayback'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

export default function App(): React.ReactElement {
  const showNewProjectDialog = useEditorStore((s) => s.showNewProjectDialog)
  const isExporting = useEditorStore((s) => s.isExporting)
  const showCommandConsole = useEditorStore((s) => s.showCommandConsole)
  const showCreateObjectDialog = useEditorStore((s) => s.showCreateObjectDialog)
  const project = useProjectStore((s) => s.project)
  const [activePanel, setActivePanel] = useState('library')

  usePlayback()
  useKeyboardShortcuts()

  return (
    <div style={styles.root}>
      <TopBar />
      <div style={styles.body}>
        <ToolSidebar activePanel={activePanel} onPanelChange={setActivePanel} />
        <div style={styles.leftPanel}>
          {activePanel === 'library' && <LibraryPanel />}
          {activePanel === 'assets' && <LibraryPanel />}
          {(activePanel !== 'library' && activePanel !== 'assets') && <UnitsPanel />}
        </div>
        <StageContainer />
        <PropertiesPanel />
      </div>
      <Timeline />

      {showNewProjectDialog && <NewProjectDialog />}
      {isExporting && <ExportProgressModal />}
      {showCreateObjectDialog && <CreateObjectDialog />}
      {showCommandConsole && <CommandConsole />}
      <CanvasContextMenu />
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  root: {
    display: 'grid',
    gridTemplateRows: 'var(--topbar-height) 1fr var(--timeline-height)',
    gridTemplateColumns: '1fr',
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    background: 'var(--bg-primary)'
  },
  body: {
    display: 'flex',
    overflow: 'hidden'
  },
  leftPanel: {
    width: 'var(--left-panel-width)',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    flexShrink: 0
  }
}
