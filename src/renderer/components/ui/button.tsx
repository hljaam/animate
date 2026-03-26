import * as React from 'react'
import { Slot } from '@radix-ui/react-slot'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '../../lib/utils'

const buttonVariants = cva(
  'inline-flex items-center justify-center whitespace-nowrap rounded-sm text-base font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:pointer-events-none disabled:opacity-35 disabled:grayscale-[0.5]',
  {
    variants: {
      variant: {
        default: 'bg-bg-tertiary text-foreground border border-border-light hover:bg-bg-hover active:bg-primary active:text-white',
        primary: 'bg-primary text-white border border-primary hover:bg-primary-hover',
        destructive: 'bg-destructive text-white hover:bg-destructive/90',
        outline: 'border border-border-light bg-transparent hover:bg-bg-hover text-foreground',
        ghost: 'bg-transparent border-none text-text-secondary hover:text-foreground hover:bg-bg-hover',
        icon: 'bg-transparent border-none p-1 min-w-[36px] min-h-[36px] text-text-secondary hover:text-foreground hover:bg-bg-hover active:bg-primary-dim',
        export: 'bg-export border-none rounded-md px-5 py-1.5 text-white font-semibold text-base hover:brightness-110',
      },
      size: {
        default: 'h-8 px-3 text-base',
        sm: 'h-7 px-2 text-sm',
        lg: 'h-10 px-6 text-base',
        icon: 'h-8 w-8',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : 'button'
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = 'Button'

export { Button, buttonVariants }
