import * as React from 'react'
import { cn } from '../../lib/utils'

interface ProgressProps extends React.HTMLAttributes<HTMLDivElement> {
  value?: number
}

const Progress = React.forwardRef<HTMLDivElement, ProgressProps>(
  ({ className, value = 0, ...props }, ref) => (
    <div
      ref={ref}
      className={cn(
        'w-full h-2 bg-background rounded-sm overflow-hidden border border-border',
        className
      )}
      {...props}
    >
      <div
        className="h-full bg-primary rounded-sm transition-[width] duration-300 ease-out"
        style={{ width: `${value}%` }}
      />
    </div>
  )
)
Progress.displayName = 'Progress'

export { Progress }
