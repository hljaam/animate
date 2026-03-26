import React, { useState, useRef, useEffect } from 'react'
import type { UnitDef, ShapeObjectDef, SymbolDef } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { findLayersByReference } from '../../utils/layerLookup'
import { UnitHeaderMenu, UnitItemMenu } from './UnitContextMenu'

interface Props {
  unit: UnitDef
}

export default function UnitItem({ unit }: Props): React.ReactElement {
  const project = useProjectStore((s) => s.project)
  const [expanded, setExpanded] = useState(false)
  const [renaming, setRenaming] = useState(false)
  const [renameName, setRenameName] = useState(unit.name)
  const renameRef = useRef<HTMLInputElement>(null)

  const [headerMenu, setHeaderMenu] = useState<{ x: number; y: number } | null>(null)
  const [itemMenu, setItemMenu] = useState<{ x: number; y: number; itemType: 'symbol' | 'shapeObject'; itemId: string } | null>(null)

  useEffect(() => {
    if (renaming && renameRef.current) {
      renameRef.current.focus()
      renameRef.current.select()
    }
  }, [renaming])

  // Resolve referenced items, filtering out dangling references
  const shapeObjects: ShapeObjectDef[] = unit.shapeObjectIds
    .map((id) => project?.shapeObjects?.find((o) => o.id === id))
    .filter((o): o is ShapeObjectDef => o != null)

  const symbols: SymbolDef[] = unit.symbolIds
    .map((id) => project?.symbols?.find((s) => s.id === id))
    .filter((s): s is SymbolDef => s != null)

  const totalItems = shapeObjects.length + symbols.length

  function handleHeaderContextMenu(e: React.MouseEvent): void {
    e.preventDefault()
    setHeaderMenu({ x: e.clientX, y: e.clientY })
  }

  function handleRename(): void {
    setRenameName(unit.name)
    setRenaming(true)
  }

  function commitRename(): void {
    const trimmed = renameName.trim()
    if (trimmed && trimmed !== unit.name) {
      useProjectStore.getState().applyAction(`Rename unit to "${trimmed}"`, (draft) => {
        const u = draft.units?.find((u) => u.id === unit.id)
        if (u) u.name = trimmed
      })
    }
    setRenaming(false)
  }

  function handleDelete(): void {
    useProjectStore.getState().applyAction(`Delete unit "${unit.name}"`, (draft) => {
      if (draft.units) {
        draft.units = draft.units.filter((u) => u.id !== unit.id)
      }
    })
  }

  function handleRemoveItem(itemType: 'symbol' | 'shapeObject', itemId: string): void {
    useProjectStore.getState().applyAction('Remove from unit', (draft) => {
      const u = draft.units?.find((u) => u.id === unit.id)
      if (!u) return
      if (itemType === 'shapeObject') {
        u.shapeObjectIds = u.shapeObjectIds.filter((id) => id !== itemId)
      } else {
        u.symbolIds = u.symbolIds.filter((id) => id !== itemId)
      }
    })
  }

  function handleItemClick(itemType: 'symbol' | 'shapeObject', itemId: string): void {
    if (!project) return
    const matchingIds = findLayersByReference(project, itemType, itemId)
    if (matchingIds.length > 0) {
      useEditorStore.getState().setSelectedLayerIds(matchingIds)
    }
  }

  function handleItemContextMenu(e: React.MouseEvent, itemType: 'symbol' | 'shapeObject', itemId: string): void {
    e.preventDefault()
    e.stopPropagation()
    setItemMenu({ x: e.clientX, y: e.clientY, itemType, itemId })
  }

  return (
    <>
      {/* Unit header row */}
      <div
        style={styles.header}
        onClick={() => setExpanded(!expanded)}
        onContextMenu={handleHeaderContextMenu}
      >
        <span style={{ ...styles.chevron, transform: expanded ? 'rotate(90deg)' : 'rotate(0deg)' }}>
          &#9656;
        </span>
        {renaming ? (
          <input
            ref={renameRef}
            value={renameName}
            onChange={(e) => setRenameName(e.target.value)}
            onBlur={commitRename}
            onKeyDown={(e) => {
              if (e.key === 'Enter') commitRename()
              if (e.key === 'Escape') setRenaming(false)
            }}
            onClick={(e) => e.stopPropagation()}
            style={styles.renameInput}
          />
        ) : (
          <span style={styles.name}>{unit.name}</span>
        )}
        <span style={styles.badge}>{totalItems}</span>
      </div>

      {/* Expanded items */}
      {expanded && (
        <div style={styles.items}>
          {shapeObjects.map((obj) => (
            <div
              key={obj.id}
              style={styles.item}
              onClick={() => handleItemClick('shapeObject', obj.id)}
              onContextMenu={(e) => handleItemContextMenu(e, 'shapeObject', obj.id)}
            >
              <span style={styles.shapeIcon}>&#9671;</span>
              <span style={styles.itemName}>{obj.name}</span>
            </div>
          ))}
          {symbols.map((sym) => (
            <div
              key={sym.id}
              style={styles.item}
              onClick={() => handleItemClick('symbol', sym.id)}
              onContextMenu={(e) => handleItemContextMenu(e, 'symbol', sym.id)}
            >
              <span style={styles.symbolIcon}>&#8862;</span>
              <span style={styles.itemName}>{sym.name}</span>
            </div>
          ))}
          {totalItems === 0 && (
            <div style={styles.emptyItems}>No items</div>
          )}
        </div>
      )}

      {/* Context menus */}
      {headerMenu && (
        <UnitHeaderMenu
          x={headerMenu.x}
          y={headerMenu.y}
          onRename={handleRename}
          onDelete={handleDelete}
          onClose={() => setHeaderMenu(null)}
        />
      )}
      {itemMenu && (
        <UnitItemMenu
          x={itemMenu.x}
          y={itemMenu.y}
          onRemove={() => handleRemoveItem(itemMenu.itemType, itemMenu.itemId)}
          onClose={() => setItemMenu(null)}
        />
      )}
    </>
  )
}

const styles: Record<string, React.CSSProperties> = {
  header: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '8px 10px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    background: 'var(--bg-tertiary)',
    cursor: 'pointer',
    userSelect: 'none'
  },
  chevron: {
    fontSize: 12,
    color: 'var(--text-muted)',
    transition: 'transform 0.15s',
    flexShrink: 0,
    width: 12,
    textAlign: 'center'
  },
  name: {
    fontSize: 12,
    color: 'var(--text-primary)',
    flex: 1,
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  badge: {
    fontSize: 10,
    color: 'var(--text-muted)',
    background: 'var(--bg-primary)',
    borderRadius: 10,
    padding: '1px 6px',
    flexShrink: 0
  },
  renameInput: {
    flex: 1,
    fontSize: 12,
    padding: '2px 4px',
    background: 'var(--bg-primary)',
    border: '1px solid var(--accent)',
    borderRadius: 3,
    color: 'var(--text-primary)',
    outline: 'none'
  },
  items: {
    paddingLeft: 20,
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  item: {
    display: 'flex',
    alignItems: 'center',
    gap: 8,
    padding: '5px 8px',
    borderRadius: 4,
    cursor: 'pointer',
    fontSize: 11,
    color: 'var(--text-secondary)',
    transition: 'background 0.1s'
  },
  shapeIcon: {
    fontSize: 14,
    color: '#e89b4e',
    width: 18,
    textAlign: 'center',
    flexShrink: 0
  },
  symbolIcon: {
    fontSize: 14,
    color: 'var(--accent)',
    width: 18,
    textAlign: 'center',
    flexShrink: 0
  },
  itemName: {
    overflow: 'hidden',
    textOverflow: 'ellipsis',
    whiteSpace: 'nowrap'
  },
  emptyItems: {
    fontSize: 11,
    color: 'var(--text-muted)',
    padding: '4px 8px',
    fontStyle: 'italic'
  }
}
