import React, { useRef } from 'react'
import { PopoverMenu, MenuItem, MenuSeparator } from '../ui/popover-menu'
import { useClickOutside } from '../../hooks/useClickOutside'

interface UnitHeaderMenuProps {
  x: number
  y: number
  onRename: () => void
  onDelete: () => void
  onClose: () => void
}

export function UnitHeaderMenu({ x, y, onRename, onDelete, onClose }: UnitHeaderMenuProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  return (
    <PopoverMenu ref={ref} x={x} y={y}>
      <MenuItem onClick={() => { onRename(); onClose() }}>Rename</MenuItem>
      <MenuSeparator />
      <MenuItem onClick={() => { onDelete(); onClose() }}>Delete Unit</MenuItem>
    </PopoverMenu>
  )
}

interface UnitItemMenuProps {
  x: number
  y: number
  onRemove: () => void
  onClose: () => void
}

export function UnitItemMenu({ x, y, onRemove, onClose }: UnitItemMenuProps): React.ReactElement {
  const ref = useRef<HTMLDivElement>(null)
  useClickOutside(ref, onClose)

  return (
    <PopoverMenu ref={ref} x={x} y={y}>
      <MenuItem onClick={() => { onRemove(); onClose() }}>Remove from Unit</MenuItem>
    </PopoverMenu>
  )
}
