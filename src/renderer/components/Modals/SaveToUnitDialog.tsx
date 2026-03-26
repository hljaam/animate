import React, { useState } from 'react'
import { useEditorStore } from '../../store/editorStore'
import { useProjectStore } from '../../store/projectStore'
import { generateId } from '../../utils/idGenerator'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '../ui/dialog'
import { Button } from '../ui/button'
import { Input } from '../ui/input'

export default function SaveToUnitDialog(): React.ReactElement | null {
  const dialogData = useEditorStore((s) => s.showSaveToUnitDialog)
  const setDialog = useEditorStore((s) => s.setShowSaveToUnitDialog)
  const project = useProjectStore((s) => s.project)

  const [selectedUnitId, setSelectedUnitId] = useState<string | null>(null)
  const [creatingNew, setCreatingNew] = useState(false)
  const [newUnitName, setNewUnitName] = useState('')

  const units = project?.units ?? []

  // Resolve item name for the title
  const itemName = (() => {
    if (!dialogData || !project) return ''
    if (dialogData.itemType === 'symbol') {
      return project.symbols?.find((s) => s.id === dialogData.itemId)?.name ?? ''
    }
    return project.shapeObjects?.find((o) => o.id === dialogData.itemId)?.name ?? ''
  })()

  function handleSave(): void {
    if (!dialogData) return

    if (creatingNew) {
      const trimmed = newUnitName.trim()
      if (!trimmed) return
      const newUnitId = generateId()
      useProjectStore.getState().applyAction(`Create unit "${trimmed}" and add ${dialogData.itemType}`, (draft) => {
        if (!draft.units) draft.units = []
        const newUnit = {
          id: newUnitId,
          name: trimmed,
          shapeObjectIds: [] as string[],
          symbolIds: [] as string[]
        }
        if (dialogData.itemType === 'shapeObject') {
          newUnit.shapeObjectIds.push(dialogData.itemId)
        } else {
          newUnit.symbolIds.push(dialogData.itemId)
        }
        draft.units.push(newUnit)
      })
    } else if (selectedUnitId) {
      const unit = units.find((u) => u.id === selectedUnitId)
      if (!unit) return
      useProjectStore.getState().applyAction(`Add to unit "${unit.name}"`, (draft) => {
        const u = draft.units?.find((u) => u.id === selectedUnitId)
        if (!u) return
        if (dialogData.itemType === 'shapeObject') {
          if (!u.shapeObjectIds.includes(dialogData.itemId)) {
            u.shapeObjectIds.push(dialogData.itemId)
          }
        } else {
          if (!u.symbolIds.includes(dialogData.itemId)) {
            u.symbolIds.push(dialogData.itemId)
          }
        }
      })
    }

    setDialog(null)
  }

  function handleCancel(): void {
    setDialog(null)
  }

  if (!dialogData) return null

  const canSave = creatingNew ? newUnitName.trim().length > 0 : selectedUnitId != null

  return (
    <Dialog open onOpenChange={(open) => { if (!open) handleCancel() }}>
      <DialogContent className="min-w-[360px]">
        <DialogHeader>
          <DialogTitle>Save to Unit</DialogTitle>
        </DialogHeader>

        <p style={styles.subtitle}>
          Add <strong>{itemName || dialogData.itemType}</strong> to a unit:
        </p>

        {/* Existing units list */}
        {units.length > 0 && !creatingNew && (
          <div style={styles.unitList}>
            {units.map((unit) => {
              const isSelected = selectedUnitId === unit.id
              const count = unit.shapeObjectIds.length + unit.symbolIds.length
              // Check if item already in this unit
              const alreadyIn = dialogData.itemType === 'shapeObject'
                ? unit.shapeObjectIds.includes(dialogData.itemId)
                : unit.symbolIds.includes(dialogData.itemId)
              return (
                <button
                  key={unit.id}
                  onClick={() => setSelectedUnitId(unit.id)}
                  disabled={alreadyIn}
                  style={{
                    ...styles.unitOption,
                    borderColor: isSelected ? 'var(--accent)' : 'var(--border)',
                    background: isSelected ? 'var(--accent-dim)' : 'var(--bg-tertiary)',
                    opacity: alreadyIn ? 0.5 : 1
                  }}
                >
                  <div style={styles.unitOptionContent}>
                    <span style={styles.unitName}>{unit.name}</span>
                    <span style={styles.unitMeta}>
                      {alreadyIn ? 'Already added' : `${count} item${count !== 1 ? 's' : ''}`}
                    </span>
                  </div>
                  {isSelected && <span style={styles.checkmark}>&#10003;</span>}
                </button>
              )
            })}
          </div>
        )}

        {/* Create new unit option */}
        {!creatingNew ? (
          <button
            onClick={() => { setCreatingNew(true); setSelectedUnitId(null) }}
            style={styles.createNewBtn}
          >
            + Create New Unit
          </button>
        ) : (
          <div style={styles.createNewWrap}>
            <Input
              value={newUnitName}
              onChange={(e) => setNewUnitName(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && newUnitName.trim()) handleSave()
                if (e.key === 'Escape') { setCreatingNew(false); setNewUnitName('') }
              }}
              placeholder="New unit name..."
              autoFocus
            />
            {units.length > 0 && (
              <button
                onClick={() => { setCreatingNew(false); setNewUnitName('') }}
                style={styles.backLink}
              >
                Back to list
              </button>
            )}
          </div>
        )}

        <DialogFooter className="mt-4">
          <Button variant="default" onClick={handleCancel}>Cancel</Button>
          <Button variant="primary" onClick={handleSave} disabled={!canSave}>Save</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

const styles: Record<string, React.CSSProperties> = {
  subtitle: {
    fontSize: 12,
    color: 'var(--text-secondary)',
    marginBottom: 12
  },
  unitList: {
    display: 'flex',
    flexDirection: 'column',
    gap: 4,
    maxHeight: 200,
    overflowY: 'auto',
    marginBottom: 8
  },
  unitOption: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '8px 12px',
    borderRadius: 6,
    border: '1px solid var(--border)',
    cursor: 'pointer',
    textAlign: 'left',
    fontSize: 12,
    color: 'var(--text-primary)',
    transition: 'border-color 0.1s, background 0.1s',
    minHeight: 'auto'
  },
  unitOptionContent: {
    display: 'flex',
    flexDirection: 'column',
    gap: 2
  },
  unitName: {
    fontSize: 12,
    fontWeight: 500
  },
  unitMeta: {
    fontSize: 10,
    color: 'var(--text-muted)'
  },
  checkmark: {
    color: 'var(--accent)',
    fontSize: 14,
    fontWeight: 700
  },
  createNewBtn: {
    display: 'block',
    width: '100%',
    padding: '8px 12px',
    background: 'none',
    border: '1px dashed var(--border-light)',
    borderRadius: 6,
    color: 'var(--text-secondary)',
    fontSize: 12,
    cursor: 'pointer',
    textAlign: 'left',
    minHeight: 'auto',
    transition: 'border-color 0.1s'
  },
  createNewWrap: {
    display: 'flex',
    flexDirection: 'column',
    gap: 6
  },
  backLink: {
    background: 'none',
    border: 'none',
    color: 'var(--text-muted)',
    fontSize: 11,
    cursor: 'pointer',
    padding: 0,
    minHeight: 'auto',
    minWidth: 'auto',
    textAlign: 'left'
  }
}
