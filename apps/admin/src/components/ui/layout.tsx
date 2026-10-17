import React from 'react'
import { cn } from '@/lib/api'

// Tiêu đề trang + hành động + tab gạch chân (kiểu Meta/X admin)
export function PageHeader({
  title,
  description,
  actions,
  tabs
}: {
  title: string
  description?: React.ReactNode
  actions?: React.ReactNode
  tabs?: React.ReactNode
}) {
  return (
    <div className={cn('space-y-4', tabs ? 'mb-5' : 'mb-6')}>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div className="min-w-0">
          <h1 className="text-xl font-bold tracking-tight text-foreground">{title}</h1>
          {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
      {tabs}
    </div>
  )
}

export interface TabItem<T extends string> {
  id: T
  label: string
  count?: number
}

export function Tabs<T extends string>({ items, value, onChange }: { items: TabItem<T>[]; value: T; onChange: (v: T) => void }) {
  return (
    <div className="flex gap-6 overflow-x-auto border-b border-border [scrollbar-width:none]">
      {items.map((t) => {
        const active = t.id === value
        return (
          <button
            key={t.id}
            type="button"
            onClick={() => onChange(t.id)}
            className={cn(
              'relative -mb-px flex shrink-0 items-center gap-1.5 border-b-2 pb-2.5 text-sm font-medium transition-colors cursor-pointer',
              active ? 'border-primary text-foreground' : 'border-transparent text-muted-foreground hover:text-foreground'
            )}
          >
            {t.label}
            {t.count ? (
              <span
                className={cn(
                  'rounded-full px-1.5 text-[11px] font-semibold tabular-nums',
                  active ? 'bg-primary text-primary-foreground' : 'bg-muted text-muted-foreground'
                )}
              >
                {t.count}
              </span>
            ) : null}
          </button>
        )
      })}
    </div>
  )
}

// Nút chuyển nhóm nhỏ (bộ lọc / khoảng thời gian)
export function Segmented<T extends string | number>({
  items,
  value,
  onChange
}: {
  items: { id: T; label: string }[]
  value: T
  onChange: (v: T) => void
}) {
  return (
    <div className="inline-flex shrink-0 rounded-md bg-muted p-0.5">
      {items.map((it) => (
        <button
          key={String(it.id)}
          type="button"
          onClick={() => onChange(it.id)}
          className={cn(
            'h-8 rounded-[5px] px-3 text-xs font-medium whitespace-nowrap transition-colors cursor-pointer',
            it.id === value ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
          )}
        >
          {it.label}
        </button>
      ))}
    </div>
  )
}

export function Card({ className, children }: { className?: string; children: React.ReactNode }) {
  return <div className={cn('rounded-xl border border-border bg-card', className)}>{children}</div>
}

export function CardHeader({
  title,
  description,
  action,
  className
}: {
  title: React.ReactNode
  description?: React.ReactNode
  action?: React.ReactNode
  className?: string
}) {
  return (
    <div className={cn('flex items-start justify-between gap-3 px-5 pt-4 pb-3', className)}>
      <div className="min-w-0">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        {description && <p className="mt-0.5 text-xs text-muted-foreground">{description}</p>}
      </div>
      {action}
    </div>
  )
}

// Thanh công cụ trên bảng: tìm kiếm + bộ lọc
export function Toolbar({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('mb-3 flex flex-wrap items-center gap-2', className)}>{children}</div>
}

// Ô số liệu KPI
export function Stat({
  label,
  value,
  sub,
  tone,
  icon: Icon,
  onClick
}: {
  label: string
  value: React.ReactNode
  sub?: React.ReactNode
  tone?: 'danger' | 'warning'
  icon?: React.ElementType
  onClick?: () => void
}) {
  const Comp = onClick ? 'button' : 'div'
  return (
    <Comp
      type={onClick ? 'button' : undefined}
      onClick={onClick}
      className={cn(
        'rounded-xl border border-border bg-card p-4 text-left transition-colors',
        onClick && 'cursor-pointer hover:border-primary/40'
      )}
    >
      <div className="flex items-center justify-between gap-2 text-muted-foreground">
        <span className="truncate text-xs font-medium">{label}</span>
        {Icon && <Icon className="size-4 shrink-0" />}
      </div>
      <div
        className={cn(
          'mt-2 text-2xl font-bold tracking-tight tabular-nums',
          tone === 'danger' ? 'text-danger' : tone === 'warning' ? 'text-warning' : 'text-foreground'
        )}
      >
        {value}
      </div>
      {sub && <div className="mt-1 truncate text-xs text-muted-foreground">{sub}</div>}
    </Comp>
  )
}
