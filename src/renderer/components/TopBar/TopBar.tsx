import React from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { useExport } from '../../hooks/useExport'
import { Button } from '../ui/button'
import { Separator } from '../ui/separator'
import {
  DropdownMenu,
  DropdownMenuTrigger,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
} from '../ui/dropdown-menu'

function resetViewToCenter(): void {
  useEditorStore.getState().setViewport(1, 0, 0)
}

export default function TopBar(): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const history = useProjectStore((s) => s.history)
  useProjectStore((s) => s.historyVersion)
  const setShowNewProjectDialog = useEditorStore((s) => s.setShowNewProjectDialog)
  const { exportProject } = useExport()
  const zoom = useEditorStore((s) => s.zoom)
  const fitZoom = useEditorStore((s) => s.fitZoom)
  const editingSymbolId = useEditorStore((s) => s.editingSymbolId)

  const effectiveZoom = zoom || fitZoom
  const zoomPercent = Math.round(effectiveZoom * 100)

  async function handleSave(): Promise<void> {
    if (!project) return
    const json = JSON.stringify(project, null, 2)
    await window.electronAPI.saveProject(json)
  }

  async function handleOpen(): Promise<void> {
    const result = await window.electronAPI.openProject()
    if (!result) return
    const parsed = JSON.parse(result.data)
    useProjectStore.getState().setProject(parsed)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
    resetViewToCenter()
  }

  async function handleOpenSwf(): Promise<void> {
    const result = await window.electronAPI.importSwf()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
    resetViewToCenter()
  }

  async function handleOpenPsd(): Promise<void> {
    const result = await window.electronAPI.importPsd()
    if (!result) return
    useProjectStore.getState().setProject(result as any)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setCurrentFrame(0)
    resetViewToCenter()
  }

  const editingSymbol = editingSymbolId
    ? project?.symbols?.find((s) => s.id === editingSymbolId)
    : null

  return (
    <div className="flex items-center justify-between px-4 bg-secondary border-b border-border h-full gap-4">
      {/* Left: Logo + Menu + Breadcrumb */}
      <div className="flex items-center gap-3 shrink-0">
        <span className="font-extrabold text-[14px] text-foreground tracking-[1.5px] whitespace-nowrap">
          ANIMATEPRO
        </span>

        <div className="flex items-center ml-2">
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="sm" className="text-base text-text-secondary px-2.5 min-w-0 min-h-0">
                File
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start">
              <DropdownMenuItem onSelect={() => setShowNewProjectDialog(true)}>
                New Project
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOpen}>
                Open Project
              </DropdownMenuItem>
              <DropdownMenuItem disabled={!project} onSelect={handleSave}>
                Save Project
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onSelect={handleOpenSwf}>
                Import SWF...
              </DropdownMenuItem>
              <DropdownMenuItem onSelect={handleOpenPsd}>
                Import PSD...
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem disabled={!project} onSelect={() => exportProject()}>
                Export MP4
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          <Button variant="ghost" size="sm" className="text-base text-text-secondary px-2.5 min-w-0 min-h-0" onClick={handleOpen}>
            Edit
          </Button>
          <Button variant="ghost" size="sm" className="text-base text-text-secondary px-2.5 min-w-0 min-h-0">
            View
          </Button>
          <Button variant="ghost" size="sm" className="text-base text-text-secondary px-2.5 min-w-0 min-h-0">
            Modify
          </Button>
        </div>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <div className="flex items-center gap-1.5">
          <span className="text-base text-text-muted">Project</span>
          <span className="text-xs text-text-muted">&gt;</span>
          <span className="text-base font-semibold text-foreground">
            {editingSymbol ? editingSymbol.name : (project?.name ?? 'Untitled')}
          </span>
        </div>
      </div>

      {/* Center: Viewport + Zoom + Console hint */}
      <div className="flex items-center gap-4 flex-1 justify-center">
        {project && (
          <>
            <span className="text-sm text-text-secondary whitespace-nowrap">
              Viewport: {project.width} x {project.height}
            </span>
            <span className="text-sm text-text-secondary whitespace-nowrap">
              Zoom: {zoomPercent}%
            </span>
          </>
        )}
        <span className="text-xs text-text-muted whitespace-nowrap">
          Press &apos;Ctrl+K&apos; for Command Console
        </span>
      </div>

      {/* Right: Status + Undo/Redo + Export */}
      <div className="flex items-center gap-2 shrink-0">
        <span className="text-sm text-text-muted">Status:</span>
        <span className="text-sm text-success font-medium">Saved</span>

        <Separator orientation="vertical" className="h-6 mx-1" />

        <Button
          variant="icon"
          size="icon"
          title="Undo (Ctrl+Z)"
          onClick={() => history.undo()}
          disabled={!history.canUndo()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M3 8h10M3 8l3-3M3 8l3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Button>
        <Button
          variant="icon"
          size="icon"
          title="Redo (Ctrl+Y)"
          onClick={() => history.redo()}
          disabled={!history.canRedo()}
        >
          <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
            <path d="M13 8H3M13 8l-3-3M13 8l-3 3" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
          </svg>
        </Button>

        <Button
          variant="export"
          onClick={exportProject}
          disabled={!project}
        >
          Export
        </Button>
      </div>
    </div>
  )
}
