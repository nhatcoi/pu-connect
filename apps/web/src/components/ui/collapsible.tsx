'use client'

import * as React from 'react'
import { motion, AnimatePresence, type HTMLMotionProps } from 'motion/react'
import { Slot } from '@radix-ui/react-slot'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

/* -------------------------------------------------------------------------- */
/* Low-Level Headless Primitives                                              */
/* -------------------------------------------------------------------------- */

interface CollapsibleContextValue {
  open: boolean
  toggle: () => void
  disabled?: boolean
  contentId: string
  triggerId: string
}

const CollapsibleContext = React.createContext<CollapsibleContextValue | null>(null)

export function useCollapsible() {
  const ctx = React.useContext(CollapsibleContext)
  if (!ctx) {
    throw new Error('useCollapsible must be used within a <Collapsible />')
  }
  return ctx
}

export interface CollapsibleProps extends React.HTMLAttributes<HTMLDivElement> {
  open?: boolean
  defaultOpen?: boolean
  onOpenChange?: (open: boolean) => void
  disabled?: boolean
  children: React.ReactNode
}

export function Collapsible({
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  className,
  children,
  id: propId,
  ...props
}: CollapsibleProps) {
  const [uncontrolledOpen, setUncontrolledOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const open = isControlled ? controlledOpen : uncontrolledOpen

  const autoId = React.useId()
  const baseId = propId || autoId
  const contentId = `${baseId}-content`
  const triggerId = `${baseId}-trigger`

  const toggle = React.useCallback(() => {
    if (disabled) return
    const next = !open
    if (!isControlled) {
      setUncontrolledOpen(next)
    }
    onOpenChange?.(next)
  }, [disabled, isControlled, onOpenChange, open])

  return (
    <CollapsibleContext.Provider value={{ open, toggle, disabled, contentId, triggerId }}>
      <div
        id={baseId}
        data-state={open ? 'open' : 'closed'}
        data-disabled={disabled ? '' : undefined}
        className={cn('w-full', className)}
        {...props}
      >
        {children}
      </div>
    </CollapsibleContext.Provider>
  )
}

export interface CollapsibleTriggerProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean
}

export const CollapsibleTrigger = React.forwardRef<HTMLButtonElement, CollapsibleTriggerProps>(
  ({ className, onClick, children, asChild = false, disabled: buttonDisabled, ...props }, ref) => {
    const { open, toggle, disabled, contentId, triggerId } = useCollapsible()
    const isDisabled = disabled || buttonDisabled

    const Comp = asChild ? Slot : 'button'

    return (
      <Comp
        ref={ref}
        type={asChild ? undefined : 'button'}
        id={triggerId}
        aria-expanded={open}
        aria-controls={contentId}
        disabled={isDisabled}
        data-state={open ? 'open' : 'closed'}
        data-disabled={isDisabled ? '' : undefined}
        onClick={(e: React.MouseEvent<HTMLButtonElement>) => {
          onClick?.(e)
          if (!e.defaultPrevented) {
            toggle()
          }
        }}
        className={cn('cursor-pointer select-none text-left disabled:cursor-not-allowed disabled:opacity-60', className)}
        {...props}
      >
        {children}
      </Comp>
    )
  }
)
CollapsibleTrigger.displayName = 'CollapsibleTrigger'

export interface CollapsibleContentProps extends Omit<HTMLMotionProps<'div'>, 'children'> {
  children?: React.ReactNode
  innerClassName?: string
  forceMount?: boolean
}

export const CollapsibleContent = React.forwardRef<HTMLDivElement, CollapsibleContentProps>(
  ({ className, innerClassName, children, forceMount = false, ...props }, ref) => {
    const { open, contentId, triggerId } = useCollapsible()

    return (
      <AnimatePresence initial={false}>
        {(open || forceMount) && (
          <motion.div
            ref={ref}
            id={contentId}
            role="region"
            aria-labelledby={triggerId}
            data-state={open ? 'open' : 'closed'}
            initial={{ height: 0, opacity: 0 }}
            animate={{
              height: 'auto',
              opacity: 1,
              transition: {
                height: { type: 'spring', stiffness: 360, damping: 32, mass: 0.8 },
                opacity: { duration: 0.2, ease: 'easeOut' }
              }
            }}
            exit={{
              height: 0,
              opacity: 0,
              transition: {
                height: { type: 'spring', stiffness: 380, damping: 34, mass: 0.8 },
                opacity: { duration: 0.15, ease: 'easeIn' }
              }
            }}
            className={cn('overflow-hidden', className)}
            {...props}
          >
            <div className={innerClassName}>{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    )
  }
)
CollapsibleContent.displayName = 'CollapsibleContent'

/* -------------------------------------------------------------------------- */
/* High-Level Signature Component: AppCollapsible (PU Connector Standard)    */
/* -------------------------------------------------------------------------- */

export type AppCollapsibleVariant = 'card' | 'bordered' | 'ghost' | 'subtle'

export interface AppCollapsibleProps {
  /** Biến thể giao diện */
  variant?: AppCollapsibleVariant
  /** Tiêu đề chính */
  title: React.ReactNode
  /** Phụ đề hoặc mô tả ngắn */
  subtitle?: React.ReactNode
  /** Icon bên trái tiêu đề */
  icon?: React.ReactNode
  /** Badge trạng thái hoặc số lượng (e.g. 5 câu hỏi, Live, Đã xong) */
  badge?: React.ReactNode
  /** Nút thao tác phụ bên phải (e.g. DropdownMenu, Action button) */
  actions?: React.ReactNode
  /** Trạng thái mở kiểm soát (controlled) */
  open?: boolean
  /** Trạng thái mở mặc định (uncontrolled) */
  defaultOpen?: boolean
  /** Callback khi trạng thái mở thay đổi */
  onOpenChange?: (open: boolean) => void
  /** Vô hiệu hóa đóng mở */
  disabled?: boolean
  /** Vị trí của mũi tên xoay */
  chevronPosition?: 'right' | 'left' | 'none'
  /** Lớp CSS ngoài cùng */
  className?: string
  /** Lớp CSS của thanh Trigger Header */
  headerClassName?: string
  /** Lớp CSS của khối nội dung bên trong */
  contentClassName?: string
  /** Nội dung mở rộng bên trong */
  children: React.ReactNode
}

const variantStyles: Record<AppCollapsibleVariant, string> = {
  card: 'rounded-2xl border border-border/70 bg-card/60 backdrop-blur-sm shadow-xs transition-all duration-200 hover:border-border/90 data-[state=open]:border-primary/30 data-[state=open]:shadow-sm',
  bordered: 'rounded-xl border border-border/80 bg-card transition-all duration-200 hover:border-border',
  ghost: 'rounded-xl bg-transparent transition-colors duration-150',
  subtle: 'rounded-xl bg-muted/40 border border-transparent transition-colors duration-200 hover:bg-muted/60 data-[state=open]:bg-muted/50'
}

export function AppCollapsible({
  variant = 'card',
  title,
  subtitle,
  icon,
  badge,
  actions,
  open: controlledOpen,
  defaultOpen = false,
  onOpenChange,
  disabled = false,
  chevronPosition = 'right',
  className,
  headerClassName,
  contentClassName,
  children
}: AppCollapsibleProps) {
  const [internalOpen, setInternalOpen] = React.useState(defaultOpen)
  const isControlled = controlledOpen !== undefined
  const isOpen = isControlled ? controlledOpen : internalOpen

  const handleOpenChange = (next: boolean) => {
    if (!isControlled) {
      setInternalOpen(next)
    }
    onOpenChange?.(next)
  }

  const chevronNode = (
    <motion.span
      animate={{ rotate: isOpen ? 180 : 0 }}
      transition={{ type: 'spring', stiffness: 420, damping: 28 }}
      className="inline-flex shrink-0 text-muted-foreground/80 transition-colors group-hover:text-foreground"
      aria-hidden="true"
    >
      <ChevronDown className="h-4 w-4" />
    </motion.span>
  )

  return (
    <Collapsible
      open={isOpen}
      onOpenChange={handleOpenChange}
      disabled={disabled}
      className={cn(variantStyles[variant], className)}
    >
      <div className="relative flex items-center">
        <CollapsibleTrigger
          className={cn(
            'group flex w-full min-w-0 items-center gap-3 p-3.5 text-left transition-colors',
            variant === 'ghost' && 'p-2 rounded-lg hover:bg-muted/40',
            headerClassName
          )}
        >
          {chevronPosition === 'left' && chevronNode}

          {icon && (
            <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary transition-transform duration-200 group-hover:scale-105">
              {icon}
            </span>
          )}

          <div className="min-w-0 flex-1">
            <div className="flex items-center gap-2">
              <span className="truncate text-sm font-semibold text-foreground tracking-tight">{title}</span>
              {badge && <span className="shrink-0">{badge}</span>}
            </div>
            {subtitle && (
              <p className="mt-0.5 truncate text-xs text-muted-foreground">
                {subtitle}
              </p>
            )}
          </div>

          {chevronPosition === 'right' && chevronNode}
        </CollapsibleTrigger>

        {actions && (
          <div
            onClick={(e) => e.stopPropagation()}
            className="shrink-0 pr-3"
          >
            {actions}
          </div>
        )}
      </div>

      <CollapsibleContent innerClassName={cn('px-3.5 pb-3.5 pt-0', variant === 'ghost' && 'px-2 pb-2', contentClassName)}>
        {children}
      </CollapsibleContent>
    </Collapsible>
  )
}
