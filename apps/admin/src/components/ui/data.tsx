import React, { useEffect, useRef } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, ChevronLeft, ChevronRight, X } from 'lucide-react'
import { cn, formatNumber } from '@/lib/api'

// Checkbox gọn, hỗ trợ trạng thái "chọn một phần"
export function Checkbox({
  checked,
  indeterminate,
  onChange,
  label,
  className
}: {
  checked: boolean
  indeterminate?: boolean
  onChange: (v: boolean) => void
  label?: string
  className?: string
}) {
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => {
    if (ref.current) ref.current.indeterminate = !!indeterminate && !checked
  }, [indeterminate, checked])
  return (
    <input
      ref={ref}
      type="checkbox"
      aria-label={label}
      checked={checked}
      onChange={(e) => onChange(e.target.checked)}
      onClick={(e) => e.stopPropagation()}
      className={cn('size-4 shrink-0 cursor-pointer rounded border-input accent-[var(--primary)]', className)}
    />
  )
}

// Tiêu đề cột có thể sắp xếp (bấm lần 1: giảm dần, lần 2: tăng dần)
export function SortTh<T extends string>({
  id,
  sort,
  dir,
  onSort,
  children,
  className,
  align = 'left'
}: {
  id: T
  sort: T
  dir: 'asc' | 'desc'
  onSort: (id: T, dir: 'asc' | 'desc') => void
  children: React.ReactNode
  className?: string
  align?: 'left' | 'right'
}) {
  const active = sort === id
  const Icon = !active ? ArrowUpDown : dir === 'desc' ? ArrowDown : ArrowUp
  return (
    <th className={cn('h-10 px-4 font-medium whitespace-nowrap', align === 'right' && 'text-right', className)}>
      <button
        type="button"
        onClick={() => onSort(id, active && dir === 'desc' ? 'asc' : 'desc')}
        className={cn(
          'inline-flex items-center gap-1 rounded transition-colors cursor-pointer hover:text-foreground',
          align === 'right' && 'flex-row-reverse',
          active && 'text-foreground'
        )}
      >
        {children}
        <Icon className={cn('size-3.5', !active && 'opacity-40')} />
      </button>
    </th>
  )
}

// Dải số trang: 1 … 4 5 [6] 7 8 … 20
function pageWindow(page: number, pages: number): (number | '…')[] {
  if (pages <= 7) return Array.from({ length: pages }, (_, i) => i + 1)
  const out: (number | '…')[] = [1]
  const start = Math.max(2, page - 1)
  const end = Math.min(pages - 1, page + 1)
  if (start > 2) out.push('…')
  for (let i = start; i <= end; i++) out.push(i)
  if (end < pages - 1) out.push('…')
  out.push(pages)
  return out
}

export function Pagination({
  page,
  pageSize,
  total,
  onPage,
  onPageSize,
  sizes = [25, 50, 100]
}: {
  page: number
  pageSize: number
  total: number
  onPage: (p: number) => void
  onPageSize?: (s: number) => void
  sizes?: number[]
}) {
  const pages = Math.max(1, Math.ceil(total / pageSize))
  const from = total === 0 ? 0 : (page - 1) * pageSize + 1
  const to = Math.min(total, page * pageSize)
  const btn = 'inline-flex h-8 min-w-8 items-center justify-center rounded-md px-2 text-sm tabular-nums transition-colors cursor-pointer disabled:pointer-events-none disabled:opacity-40'

  return (
    <div className="flex flex-wrap items-center justify-between gap-3 px-1 pt-3 text-sm text-muted-foreground">
      <div className="flex items-center gap-3">
        <span className="tabular-nums">
          {formatNumber(from)}–{formatNumber(to)} / {formatNumber(total)}
        </span>
        {onPageSize && (
          <select
            value={pageSize}
            onChange={(e) => onPageSize(Number(e.target.value))}
            className="h-8 rounded-md border border-input bg-card px-2 text-xs text-foreground cursor-pointer"
            aria-label="Số dòng mỗi trang"
          >
            {sizes.map((s) => (
              <option key={s} value={s}>
                {s} / trang
              </option>
            ))}
          </select>
        )}
      </div>
      <nav className="flex items-center gap-0.5" aria-label="Phân trang">
        <button type="button" className={cn(btn, 'hover:bg-accent')} disabled={page <= 1} onClick={() => onPage(page - 1)} aria-label="Trang trước">
          <ChevronLeft className="size-4" />
        </button>
        <span className="hidden items-center gap-0.5 sm:flex">
          {pageWindow(page, pages).map((p, i) =>
            p === '…' ? (
              <span key={`e${i}`} className="px-1.5">
                …
              </span>
            ) : (
              <button
                key={p}
                type="button"
                onClick={() => onPage(p)}
                className={cn(btn, p === page ? 'bg-primary text-primary-foreground' : 'hover:bg-accent hover:text-foreground')}
              >
                {p}
              </button>
            )
          )}
        </span>
        <span className="px-2 tabular-nums sm:hidden">
          {page}/{pages}
        </span>
        <button type="button" className={cn(btn, 'hover:bg-accent')} disabled={page >= pages} onClick={() => onPage(page + 1)} aria-label="Trang sau">
          <ChevronRight className="size-4" />
        </button>
      </nav>
    </div>
  )
}

// Chip bộ lọc đang áp dụng (bấm × để bỏ)
export function FilterChip({ label, value, onRemove }: { label: string; value: string; onRemove: () => void }) {
  return (
    <span className="inline-flex h-7 items-center gap-1 rounded-full border border-border bg-card pl-2.5 pr-1 text-xs">
      <span className="text-muted-foreground">{label}:</span>
      <span className="font-medium text-foreground">{value}</span>
      <button
        type="button"
        onClick={onRemove}
        aria-label={`Bỏ lọc ${label}`}
        className="ml-0.5 rounded-full p-0.5 text-muted-foreground hover:bg-accent hover:text-foreground cursor-pointer"
      >
        <X className="size-3" />
      </button>
    </span>
  )
}
