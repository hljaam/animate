import React, { useState, useRef, useEffect } from 'react'
import type { Layer } from '../../types/project'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import KeyframeTrack from './KeyframeTrack'
import LayerContextMenu from './LayerContextMenu'

interface Props {
  layer: Layer
  pixelsPerFrame: number
  totalFrames: number
  onDragStart?: (layerId: string, e: React.PointerEvent) => void
  isDragging?: boolean
  rowHeight: number
  onToggleDragStart?: (layerId: string, column: 'visible' | 'locked' | 'outlineMode', value: boolean) => void
  onToggleDragEnter?: (layerId: string) => void
}

const OUTLINE_COLORS = ['#ef4444', '#3b82f6', '#22c55e', '#f59e0b', '#a855f7', '#06b6d4', '#ec4899', '#84cc16']

function LayerTypeIcon({ type }: { type: string }): React.ReactElement {
  if (type === 'text') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <path d="M3 3h8M7 3v8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
      </svg>
    )
  }
  if (type === 'shape') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      </svg>
    )
  }
  if (type === 'symbol') {
    return (
      <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
        <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
        <path d="M5 5h4M5 7h4M5 9h4" stroke="currentColor" strokeWidth="1" strokeLinecap="round"/>
      </svg>
    )
  }
  // image
  return (
    <svg width="14" height="14" viewBox="0 0 14 14" fill="none" style={{ flexShrink: 0 }}>
      <rect x="2" y="2" width="10" height="10" rx="1" stroke="currentColor" strokeWidth="1.3"/>
      <circle cx="5" cy="5.5" r="1" fill="currentColor"/>
      <path d="M2 10l3-3 2 2 2-2 3 3" stroke="currentColor" strokeWidth="1" strokeLinejoin="round"/>
    </svg>
  )
}

export default function LayerRow({ layer, pixelsPerFrame, totalFrames, onDragStart, isDragging, rowHeight, onToggleDragStart, onToggleDragEnter }: Props): React.ReactElement {
  const selectedLayerIds = useEditorStore((s) => s.selectedLayerIds)
  const isSelected = selectedLayerIds.includes(layer.id)
  const [hovered, setHovered] = useState(false)
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null)
  const [isRenaming, setIsRenaming] = useState(false)
  const [renameValue, setRenameValue] = useState(layer.name)
  const renameRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isRenaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [isRenaming])

  function handleClick(e: React.MouseEvent): void {
    if (e.shiftKey) {
      useEditorStore.getState().toggleLayerSelection(layer.id)
    } else {
      useEditorStore.getState().setSelectedLayerId(layer.id)
    }
  }

  function handleContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    if (!isSelected) {
      useEditorStore.getState().setSelectedLayerId(layer.id)
    }
    setContextMenu({ x: e.clientX, y: e.clientY })
  }

  function handleVisibleToggle(e: React.MouseEvent): void {
    e.stopPropagation()
    if (e.altKey) {
      // Alt+Click: Solo — show only this layer, hide all others
      const project = useProjectStore.getState().project
      if (!project) return
      const otherLayers = project.layers.filter((l) => l.id !== layer.id)
      const allOthersHidden = otherLayers.every((l) => !l.visible)
      useProjectStore.getState().applyAction('Solo visibility', (draft) => {
        if (allOthersHidden) {
          // Restore all
          for (const l of draft.layers) l.visible = true
        } else {
          // Hide all others, show this
          for (const l of draft.layers) l.visible = l.id === layer.id
        }
      })
    } else if (e.shiftKey) {
      // Shift+Click: Toggle semi-transparent
      useProjectStore.getState().updateLayer(layer.id, { semiTransparent: !layer.semiTransparent })
    } else {
      // Start bulk drag toggle
      const newValue = !layer.visible
      useProjectStore.getState().updateLayer(layer.id, { visible: newValue })
      onToggleDragStart?.(layer.id, 'visible', newValue)
    }
  }

  function handleLockToggle(e: React.MouseEvent): void {
    e.stopPropagation()
    if (e.altKey) {
      // Alt+Click: Solo lock — lock all others, unlock this
      const project = useProjectStore.getState().project
      if (!project) return
      const otherLayers = project.layers.filter((l) => l.id !== layer.id)
      const allOthersLocked = otherLayers.every((l) => l.locked)
      useProjectStore.getState().applyAction('Solo lock', (draft) => {
        if (allOthersLocked) {
          for (const l of draft.layers) l.locked = false
        } else {
          for (const l of draft.layers) l.locked = l.id !== layer.id
        }
      })
    } else {
      const newValue = !layer.locked
      useProjectStore.getState().updateLayer(layer.id, { locked: newValue })
      onToggleDragStart?.(layer.id, 'locked', newValue)
    }
  }

  function handleOutlineToggle(e: React.MouseEvent): void {
    e.stopPropagation()
    const newValue = !layer.outlineMode
    const color = layer.outlineColor || OUTLINE_COLORS[layer.order % OUTLINE_COLORS.length]
    useProjectStore.getState().updateLayer(layer.id, { outlineMode: newValue, outlineColor: color })
    onToggleDragStart?.(layer.id, 'outlineMode', newValue)
  }

  function handleDoubleClickName(e: React.MouseEvent): void {
    e.stopPropagation()
    setRenameValue(layer.name)
    setIsRenaming(true)
  }

  function commitRename(): void {
    const trimmed = renameValue.trim()
    if (trimmed && trimmed !== layer.name) {
      useProjectStore.getState().applyAction(`Rename layer "${layer.name}" to "${trimmed}"`, (draft) => {
        const l = draft.layers.find((dl) => dl.id === layer.id)
        if (l) l.name = trimmed
      })
    }
    setIsRenaming(false)
  }

  function handleRenameKeyDown(e: React.KeyboardEvent): void {
    if (e.key === 'Enter') {
      commitRename()
    } else if (e.key === 'Escape') {
      setIsRenaming(false)
    }
  }

  function handleDoubleClickRow(): void {
    if (layer.type === 'symbol' && layer.symbolId) {
      useEditorStore.getState().setEditingSymbolId(layer.symbolId)
    } else if (layer.shapeObjectId) {
      useEditorStore.getState().setEditingObjectId(layer.shapeObjectId)
    }
  }

  const outlineColor = layer.outlineColor || OUTLINE_COLORS[layer.order % OUTLINE_COLORS.length]

  let rowBg: string | undefined
  if (isSelected) rowBg = 'var(--accent-dim)'
  else if (hovered) rowBg = 'rgba(255, 255, 255, 0.02)'

  return (
    <>
      <div
        onClick={handleClick}
        onContextMenu={handleContextMenu}
        onMouseEnter={() => { setHovered(true); onToggleDragEnter?.(layer.id) }}
        onMouseLeave={() => setHovered(false)}
        onDoubleClick={handleDoubleClickRow}
        style={{
          display: 'flex',
          height: rowHeight,
          borderBottom: '1px solid var(--border)',
          cursor: 'pointer',
          background: rowBg,
          borderLeft: isSelected ? '2px solid var(--accent)' : '2px solid transparent',
          opacity: isDragging ? 0.4 : 1
        }}
      >
        {/* Layer label */}
        <div
          style={{
            width: 160,
            flexShrink: 0,
            display: 'flex',
            alignItems: 'center',
            gap: 4,
            padding: '0 6px',
            borderRight: '1px solid var(--border)',
            overflow: 'hidden'
          }}
          onPointerDown={(e) => {
            if (e.button === 0 && onDragStart) {
              onDragStart(layer.id, e)
            }
          }}
        >
          {/* Visibility */}
          <span
            onClick={handleVisibleToggle}
            onPointerDown={(e) => e.stopPropagation()}
            title={layer.semiTransparent ? 'Semi-transparent (Shift+click)' : layer.visible ? 'Hide (Alt=solo, Shift=transparent)' : 'Show'}
            style={{
              cursor: 'pointer',
              color: layer.semiTransparent ? '#f59e0b' : layer.visible ? 'var(--text-label)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {layer.visible ? (
                <>
                  <path d="M1 7s2.5-4 6-4 6 4 6 4-2.5 4-6 4-6-4-6-4z" stroke="currentColor" strokeWidth="1.2"/>
                  <circle cx="7" cy="7" r="2" stroke="currentColor" strokeWidth="1.2"/>
                </>
              ) : (
                <path d="M2 2l10 10M1 7s2-3.5 5.2-3.9M8.5 4.5c2 1 3.5 2.5 3.5 2.5s-2.5 4-6 4c-.8 0-1.5-.2-2.2-.4" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round"/>
              )}
            </svg>
          </span>

          {/* Lock */}
          <span
            onClick={handleLockToggle}
            onPointerDown={(e) => e.stopPropagation()}
            title={layer.locked ? 'Unlock (Alt=solo)' : 'Lock (Alt=solo)'}
            style={{
              cursor: 'pointer',
              color: layer.locked ? 'var(--accent)' : 'var(--text-muted)',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
              {layer.locked ? (
                <>
                  <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 6V4a2 2 0 014 0v2" stroke="currentColor" strokeWidth="1.2"/>
                </>
              ) : (
                <>
                  <rect x="3" y="6" width="8" height="6" rx="1" stroke="currentColor" strokeWidth="1.2"/>
                  <path d="M5 6V4a2 2 0 014 0" stroke="currentColor" strokeWidth="1.2"/>
                </>
              )}
            </svg>
          </span>

          {/* Outline toggle */}
          <span
            onClick={handleOutlineToggle}
            onPointerDown={(e) => e.stopPropagation()}
            title={layer.outlineMode ? 'Outline On' : 'Outline Off'}
            style={{
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              flexShrink: 0
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
              <rect
                x="1" y="1" width="10" height="10" rx="2"
                fill={layer.outlineMode ? outlineColor : 'transparent'}
                stroke={outlineColor}
                strokeWidth="1.5"
                opacity={layer.outlineMode ? 1 : 0.4}
              />
            </svg>
          </span>

          {/* Type icon */}
          <LayerTypeIcon type={layer.type} />

          {/* Name (inline rename on double-click) */}
          {isRenaming ? (
            <input
              ref={renameRef}
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              onBlur={commitRename}
              onKeyDown={handleRenameKeyDown}
              onClick={(e) => e.stopPropagation()}
              onPointerDown={(e) => e.stopPropagation()}
              onDoubleClick={(e) => e.stopPropagation()}
              style={{
                fontSize: 12,
                background: 'var(--bg-primary)',
                border: '1px solid var(--accent)',
                borderRadius: 2,
                color: 'var(--text-primary)',
                padding: '1px 4px',
                width: '100%',
                outline: 'none',
                minWidth: 0
              }}
            />
          ) : (
            <span
              onDoubleClick={handleDoubleClickName}
              style={{
                fontSize: 12,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
                color: isSelected ? 'var(--text-primary)' : 'var(--text-secondary)'
              }}
              title={layer.name}
            >
              {layer.name}
            </span>
          )}
        </div>

        {/* Keyframe track area */}
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          <KeyframeTrack layer={layer} pixelsPerFrame={pixelsPerFrame} totalFrames={totalFrames} />
        </div>
      </div>
      {contextMenu && (
        <LayerContextMenu
          layer={layer}
          x={contextMenu.x}
          y={contextMenu.y}
          onClose={() => setContextMenu(null)}
        />
      )}
    </>
  )
}
