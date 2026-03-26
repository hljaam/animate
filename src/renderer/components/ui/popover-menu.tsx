import * as React from 'react'
import { cn } from '../../lib/utils'

interface PopoverMenuProps extends React.HTMLAttributes<HTMLDivElement> {
  x: number
  y: number
}

const PopoverMenu = React.forwardRef<HTMLDivElement, PopoverMenuProps>(
  ({ className, x, y, style, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'fixed z-[1000] min-w-[160px] rounded-md border border-border bg-secondary py-1 shadow-[0_4px_12px_rgba(0,0,0,0.4)]',
        className
      )}
      style={{ left: x, top: y, ...style }}
      {...props}
    />
  )
)
PopoverMenu.displayName = 'PopoverMenu'

interface MenuItemProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  active?: boolean
}

const MenuItem = React.forwardRef<HTMLButtonElement, MenuItemProps>(
  ({ className, active, ...props }, ref) => (
    <button
      ref={ref}
      className={cn(
        'block w-full px-3 py-1.5 bg-transparent border-none text-sm text-left cursor-pointer transition-colors hover:bg-primary-dim',
        active ? 'text-primary font-semibold' : 'text-text-secondary hover:text-foreground',
        'disabled:pointer-events-none disabled:text-text-muted',
        className
      )}
      {...props}
    />
  )
)
MenuItem.displayName = 'MenuItem'

const MenuSeparator = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('h-px bg-border my-1', className)} {...props} />
)
MenuSeparator.displayName = 'MenuSeparator'

const MenuLabel = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div className={cn('px-4 py-0.5 text-[10px] text-text-muted', className)} {...props} />
)
MenuLabel.displayName = 'MenuLabel'

export { PopoverMenu, MenuItem, MenuSeparator, MenuLabel }
