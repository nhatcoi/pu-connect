import React from 'react'
import { Loader2 } from 'lucide-react'
import { cn } from '@/lib/api'

type Variant = 'primary' | 'secondary' | 'outline' | 'ghost' | 'danger' | 'danger-soft'
type Size = 'sm' | 'md' | 'icon' | 'icon-sm'

const VARIANTS: Record<Variant, string> = {
  primary: 'bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs',
  secondary: 'bg-muted text-foreground hover:bg-muted/70',
  outline: 'border border-border bg-card text-foreground hover:bg-accent shadow-xs',
  ghost: 'text-muted-foreground hover:bg-accent hover:text-foreground',
  danger: 'bg-red-600 text-white hover:bg-red-600/90 shadow-xs',
  'danger-soft': 'text-danger hover:bg-red-500/10'
}

const SIZES: Record<Size, string> = {
  sm: 'h-8 px-3 text-xs gap-1.5 [&_svg]:size-3.5',
  md: 'h-9 px-4 text-sm gap-2 [&_svg]:size-4',
  icon: 'size-9 [&_svg]:size-4',
  'icon-sm': 'size-8 [&_svg]:size-4'
}

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  loading?: boolean
}

export const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ variant = 'outline', size = 'md', loading, className, children, disabled, type = 'button', ...props }, ref) => (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      className={cn(
        'inline-flex shrink-0 items-center justify-center rounded-md font-medium whitespace-nowrap cursor-pointer transition-colors select-none outline-none',
        'focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 [&_svg]:shrink-0',
        VARIANTS[variant],
        SIZES[size],
        className
      )}
      {...props}
    >
      {loading ? <Loader2 className="animate-spin" /> : null}
      {children}
    </button>
  )
)
Button.displayName = 'Button'
