import React from 'react'
import TopBar from './TopBar/TopBar'
import LibraryPanel from './LibraryPanel/LibraryPanel'
import StageContainer from './Stage/StageContainer'
import PropertiesPanel from './PropertiesPanel/PropertiesPanel'
import Timeline from './Timeline/Timeline'
import NewProjectDialog from './Modals/NewProjectDialog'
import ExportProgressModal from './Modals/ExportProgressModal'
import CommandConsole from './CommandConsole/CommandConsole'
import { useEditorStore } from '../store/editorStore'
import { useProjectStore } from '../store/projectStore'
import { usePlayback } from '../hooks/usePlayback'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

export default function App(): React.ReactElement {
  const showNewProjectDialog = useEditorStore((s) => s.showNewProjectDialog)
  const isExporting = useEditorStore((s) => s.isExporting)
  const showCommandConsole = useEditorStore((s) => s.showCommandConsole)
  const project = useProjectStore((s) => s.project)

  usePlayback()
  useKeyboardShortcuts()

  return (
    <div style={styles.root}>
      <TopBar />
      <div style={styles.workArea}>
        <LibraryPanel />
        <StageContainer />
        <PropertiesPanel />
      </div>
      <Timeline />

      {showNewProjectDialog && <NewProjectDialog />}
      {isExporting && <ExportProgressModal />}
      {showCommandConsole && <CommandConsole />}
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
  workArea: {
    display: 'grid',
    gridTemplateColumns: 'var(--left-panel-width) 1fr var(--right-panel-width)',
    overflow: 'hidden'
  }
}
