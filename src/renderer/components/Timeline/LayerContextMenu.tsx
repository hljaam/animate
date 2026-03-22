import React, { useEffect, useRef } from 'react'
import type { Layer } from '../../types/project'
import { useProjectStore } from '../../store/projectStore'
import { useEditorStore } from '../../store/editorStore'
import { RemoveLayerCommand } from '../../store/commands/RemoveLayerCommand'
import { DuplicateLayerCommand } from '../../store/commands/DuplicateLayerCommand'
import { CreateSymbolCommand } from '../../store/commands/CreateSymbolCommand'

interface Props {
  layer: Layer
  x: number
  y: number
  onClose: () => void
}

export default function LayerContextMenu({ layer, x, y, onClose }: Props): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  const history = useProjectStore((s) => s.history)

  useEffect(() => {
    function handleClick(e: MouseEvent): void {
      if (ref.current && !ref.current.contains(e.target as Node)) onClose()
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [onClose])

  function handleDuplicate(): void {
    history.push(new DuplicateLayerCommand(layer))
    onClose()
  }

  function handleDelete(): void {
    history.push(new RemoveLayerCommand(layer))
    useEditorStore.getState().setSelectedLayerId(null)
    onClose()
  }

  function handleConvertToSymbol(): void {
    history.push(new CreateSymbolCommand([layer.id]))
    onClose()
  }

  function handleToggleVisibility(): void {
    useProjectStore.getState().updateLayer(layer.id, { visible: !layer.visible })
    onClose()
  }

  function handleToggleLock(): void {
    useProjectStore.getState().updateLayer(layer.id, { locked: !layer.locked })
    onClose()
  }

  function handleEditSymbol(): void {
    if (layer.type === 'symbol' && layer.symbolId) {
      useEditorStore.getState().setEditingSymbolId(layer.symbolId)
    }
    onClose()
  }

  const items = [
    { label: 'Duplicate', action: handleDuplicate },
    { label: 'Delete', action: handleDelete },
    { label: '---' },
    { label: layer.visible ? 'Hide' : 'Show', action: handleToggleVisibility },
    { label: layer.locked ? 'Unlock' : 'Lock', action: handleToggleLock },
    { label: '---' },
    ...(layer.type !== 'symbol'
      ? [{ label: 'Convert to Symbol', action: handleConvertToSymbol }]
      : [{ label: 'Edit Symbol', action: handleEditSymbol }])
  ]

  return (
    <div ref={ref} style={{ ...styles.menu, left: x, top: y }}>
      {items.map((item, i) =>
        item.label === '---' ? (
          <div key={i} style={styles.separator} />
        ) : (
          <button key={i} style={styles.item} onClick={item.action}>
            {item.label}
          </button>
        )
      )}
    </div>
  )
}

const styles: Record<string, React.CSSProperties> = {
  menu: {
    position: 'fixed',
    background: 'var(--bg-secondary)',
    border: '1px solid var(--border)',
    borderRadius: 4,
    padding: '4px 0',
    zIndex: 1000,
    minWidth: 160,
    boxShadow: '0 4px 12px rgba(0,0,0,0.4)'
  },
  item: {
    display: 'block',
    width: '100%',
    padding: '5px 12px',
    background: 'none',
    border: 'none',
    color: 'var(--text)',
    fontSize: 12,
    textAlign: 'left',
    cursor: 'pointer'
  },
  separator: {
    height: 1,
    background: 'var(--border)',
    margin: '4px 0'
  }
}
