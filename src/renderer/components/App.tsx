import React, { useState, useCallback } from 'react'
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
import SaveToUnitDialog from './Modals/SaveToUnitDialog'
import CommandConsole from './CommandConsole/CommandConsole'
import CanvasContextMenu from './Stage/CanvasContextMenu'
import ResizeDivider from './ResizeDivider'
import { useEditorStore } from '../store/editorStore'
import { usePlayback } from '../hooks/usePlayback'
import { useKeyboardShortcuts } from '../hooks/useKeyboardShortcuts'

const MIN_LEFT = 140
const MAX_LEFT = 500
const MIN_RIGHT = 180
const MAX_RIGHT = 500
const MIN_TIMELINE = 100
const MIN_BODY = 200

export default function App(): React.ReactElement {
  const showNewProjectDialog = useEditorStore((s) => s.showNewProjectDialog)
  const isExporting = useEditorStore((s) => s.isExporting)
  const showCommandConsole = useEditorStore((s) => s.showCommandConsole)
  const showCreateObjectDialog = useEditorStore((s) => s.showCreateObjectDialog)
  const showSaveToUnitDialog = useEditorStore((s) => s.showSaveToUnitDialog)
  const [activePanel, setActivePanel] = useState('library')

  const [leftWidth, setLeftWidth] = useState(220)
  const [rightWidth, setRightWidth] = useState(280)
  const [timelineHeight, setTimelineHeight] = useState(220)

  usePlayback()
  useKeyboardShortcuts()

  const handleLeftResize = useCallback((delta: number) => {
    setLeftWidth((w) => Math.min(MAX_LEFT, Math.max(MIN_LEFT, w + delta)))
  }, [])

  const handleRightResize = useCallback((delta: number) => {
    setRightWidth((w) => Math.min(MAX_RIGHT, Math.max(MIN_RIGHT, w - delta)))
  }, [])

  const handleTimelineResize = useCallback((delta: number) => {
    setTimelineHeight((h) => Math.max(MIN_TIMELINE, h - delta))
  }, [])

  return (
    <div className="grid grid-cols-1 w-screen h-screen overflow-hidden bg-background" style={{ gridTemplateRows: 'var(--topbar-height) 1fr' }}>
      <TopBar />
      <div className="flex flex-col overflow-hidden min-h-0">
        <div className="flex overflow-hidden flex-1" style={{ minHeight: MIN_BODY }}>
          <ToolSidebar activePanel={activePanel} onPanelChange={setActivePanel} />
          <div className="flex flex-col overflow-hidden shrink-0" style={{ width: leftWidth }}>
            {activePanel === 'units' ? <UnitsPanel /> : <LibraryPanel />}
          </div>
          <ResizeDivider direction="horizontal" onResize={handleLeftResize} />
          <StageContainer />
          <ResizeDivider direction="horizontal" onResize={handleRightResize} />
          <div className="shrink-0 flex overflow-hidden" style={{ width: rightWidth }}>
            <PropertiesPanel />
          </div>
        </div>
        <ResizeDivider direction="vertical" onResize={handleTimelineResize} />
        <div className="shrink-0 overflow-hidden" style={{ height: timelineHeight }}>
          <Timeline />
        </div>
      </div>

      {showNewProjectDialog && <NewProjectDialog />}
      {isExporting && <ExportProgressModal />}
      {showCreateObjectDialog && <CreateObjectDialog />}
      {showSaveToUnitDialog && <SaveToUnitDialog />}
      {showCommandConsole && <CommandConsole />}
      <CanvasContextMenu />
    </div>
  )
}
