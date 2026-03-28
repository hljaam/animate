import React, { useState } from 'react'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { generateId } from '../../utils/idGenerator'
import type { Project } from '../../types/project'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'
import { Label } from '../ui/label'
import { cn } from '../../lib/utils'

interface Preset {
  label: string
  sub: string
  width: number
  height: number
}

const PRESETS: Preset[] = [
  { label: 'YouTube', sub: '16:9 - 1920x1080', width: 1920, height: 1080 },
  { label: 'TikTok / Reels', sub: '9:16 - 1080x1920', width: 1080, height: 1920 },
  { label: 'Instagram', sub: '1:1 - 1080x1080', width: 1080, height: 1080 },
  { label: 'Custom', sub: 'Enter your own size', width: 0, height: 0 }
]

export default function NewProjectDialog(): React.ReactElement {
  const setProject = useProjectStore((s) => s.setProject)
  const setShowDialog = useEditorStore((s) => s.setShowNewProjectDialog)

  const [selected, setSelected] = useState(0)
  const [name, setName] = useState('My Project')
  const [customW, setCustomW] = useState(1280)
  const [customH, setCustomH] = useState(720)
  const [fps, setFps] = useState(30)
  const [durationSec, setDurationSec] = useState(5)

  const preset = PRESETS[selected]
  const isCustom = preset.label === 'Custom'
  const width = isCustom ? customW : preset.width
  const height = isCustom ? customH : preset.height

  function handleCreate(): void {
    const project: Project = {
      id: generateId(),
      name: name.trim() || 'My Project',
      width,
      height,
      fps,
      durationFrames: Math.round(durationSec * fps),
      backgroundColor: '#000000',
      assets: [],
      layers: []
    }
    setProject(project)
    setShowDialog(false)
    useEditorStore.getState().setCurrentFrame(0)
    useEditorStore.getState().setSelectedLayerId(null)
    useEditorStore.getState().setShowSwapObjectDialog(null)
    useEditorStore.getState().setShowCreateObjectDialog(null)
    useEditorStore.getState().setShowSaveToUnitDialog(null)
  }

  return (
    <Dialog open onOpenChange={(open) => { if (!open) setShowDialog(false) }}>
      <DialogContent className="min-w-[460px]">
        <DialogHeader>
          <DialogTitle>New Project</DialogTitle>
        </DialogHeader>

        {/* Project name */}
        <div className="flex items-center gap-1.5 mb-4">
          <Label className="w-[70px] shrink-0">Name</Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            autoFocus
          />
        </div>

        {/* Presets */}
        <div className="mb-4">
          <Label className="block mb-2">Canvas Size</Label>
          <div className="grid grid-cols-2 gap-2">
            {PRESETS.map((p, i) => (
              <button
                key={p.label}
                onClick={() => setSelected(i)}
                className={cn(
                  'flex flex-col items-start p-2.5 px-3.5 rounded-md border cursor-pointer text-left transition-colors',
                  selected === i
                    ? 'border-primary bg-primary-dim'
                    : 'border-border bg-bg-tertiary hover:border-border-light'
                )}
              >
                <strong className="text-base">{p.label}</strong>
                <span className="text-xs text-text-muted mt-0.5">{p.sub}</span>
              </button>
            ))}
          </div>

          {isCustom && (
            <div className="flex gap-2 mt-2.5">
              <div className="flex items-center gap-1.5 flex-1">
                <Label className="w-[50px] shrink-0">Width</Label>
                <Input
                  type="number"
                  value={customW}
                  min={1}
                  onChange={(e) => setCustomW(parseInt(e.target.value) || 1)}
                />
              </div>
              <div className="flex items-center gap-1.5 flex-1">
                <Label className="w-[50px] shrink-0">Height</Label>
                <Input
                  type="number"
                  value={customH}
                  min={1}
                  onChange={(e) => setCustomH(parseInt(e.target.value) || 1)}
                />
              </div>
            </div>
          )}
        </div>

        {/* Timing */}
        <div className="flex gap-3 mb-5">
          <div className="flex items-center gap-1.5 flex-1">
            <Label className="w-[70px] shrink-0">FPS</Label>
            <select
              value={fps}
              onChange={(e) => setFps(parseInt(e.target.value))}
              className="flex w-full rounded-sm border border-border bg-background px-2 py-1 text-sm text-foreground outline-none cursor-pointer"
            >
              <option value={24}>24</option>
              <option value={30}>30</option>
              <option value={60}>60</option>
            </select>
          </div>
          <div className="flex items-center gap-1.5 flex-1">
            <Label className="w-[70px] shrink-0">Duration</Label>
            <Input
              type="number"
              value={durationSec}
              min={1}
              max={600}
              onChange={(e) => setDurationSec(parseFloat(e.target.value) || 5)}
            />
            <span className="text-xs text-text-muted">sec</span>
          </div>
        </div>

        <div className="text-xs text-text-muted mb-5">
          {width} x {height}px &middot; {fps} fps &middot; {Math.round(durationSec * fps)} frames
        </div>

        <DialogFooter>
          <Button variant="default" onClick={() => setShowDialog(false)}>Cancel</Button>
          <Button variant="primary" onClick={handleCreate}>Create Project</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
