import React, { useEffect, useRef, useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminBulkResult, AdminPage } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import { useHashQuery, type SetParams } from '@/hooks/use-hash-query'
import { Pagination, SearchInput, Select } from '@/components/ui'

/* ── State danh sách trên URL ─────────────────────────────── */

export interface ListState {
  params: Record<string, string>
  set: SetParams
  page: number
  pageSize: number
  sort: string
  dir: 'asc' | 'desc'
  onSort: (sort: string, dir: 'asc' | 'desc') => void
}

// Mặc định không ghi lên URL ⇒ link gọn (#/moderation?tab=posts)
export function useListState(defaults: { sort: string; dir?: 'asc' | 'desc' }): ListState {
  const [params, set] = useHashQuery()
  const sort = params.sort || defaults.sort
  const dir = (params.dir as 'asc' | 'desc') || defaults.dir || 'desc'
  return {
    params,
    set,
    page: Number(params.page) || 1,
    pageSize: Number(params.pageSize) || 25,
    sort,
    dir,
    onSort: (s, d) => set({ sort: s, dir: d })
  }
}

/* ── Gọi API phân trang ───────────────────────────────────── */

const PAGING_KEYS = ['page', 'pageSize', 'sort', 'dir'] as const

export function toQs(params: Record<string, string>, keys: readonly string[]) {
  const qs = new URLSearchParams()
  for (const k of [...keys, ...PAGING_KEYS]) if (params[k]) qs.set(k, params[k])
  return qs.toString()
}

export function usePaged<T>(key: string, path: string, params: Record<string, string>, filterKeys: readonly string[]) {
  const qs = toQs(params, filterKeys)
  return useQuery({
    queryKey: ['admin', key, 'page', qs],
    queryFn: () => adminApi.get<AdminPage<T>>(`${path}?${qs}`),
    placeholderData: keepPreviousData
  })
}

/* ── Thao tác hàng loạt (POST …/bulk) ─────────────────────── */

export function useBulk<V extends { ids: string[] }>(path: string, message: (affected: number, v: V) => string, onDone?: () => void) {
  const qc = useQueryClient()
  return useMutation({
    mutationFn: (v: V) => adminApi.post<AdminBulkResult>(path, v),
    onSuccess: (res, v) => {
      if (res.affected === 0) toast.info('Không có thay đổi')
      else toast.success(message(res.affected, v) + (res.skipped ? ` · bỏ qua ${res.skipped}` : ''))
      onDone?.()
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })
}

/* ── Chọn nhiều dòng ──────────────────────────────────────── */

export function useSelection(ids: string[], resetKey: string) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  useEffect(() => setSelected(new Set()), [resetKey])
  const all = ids.length > 0 && ids.every((id) => selected.has(id))
  return {
    selected,
    count: selected.size,
    has: (id: string) => selected.has(id),
    toggle: (id: string, on: boolean) =>
      setSelected((s) => {
        const n = new Set(s)
        if (on) n.add(id)
        else n.delete(id)
        return n
      }),
    all,
    some: selected.size > 0,
    toggleAll: (on: boolean) => setSelected(on ? new Set(ids) : new Set()),
    clear: () => setSelected(new Set()),
    ids: () => [...selected]
  }
}
export type Selection = ReturnType<typeof useSelection>

/* ── Ô tìm kiếm ghi lên URL (debounce) + phím "/" ─────────── */

export function ListSearch({ state, placeholder, className }: { state: ListState; placeholder: string; className?: string }) {
  const [q, setQ] = useState(state.params.q ?? '')
  const debounced = useDebounced(q.trim())
  const wrap = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if ((state.params.q ?? '') !== debounced) state.set({ q: debounced })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [debounced])
  // URL đổi từ nơi khác (VD: "Xóa bộ lọc") ⇒ đồng bộ ô nhập
  useEffect(() => {
    if ((state.params.q ?? '') !== q.trim()) setQ(state.params.q ?? '')
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state.params.q])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement
      if (e.key === '/' && !/INPUT|TEXTAREA|SELECT/.test(t.tagName)) {
        e.preventDefault()
        wrap.current?.querySelector('input')?.focus()
      }
    }
    document.addEventListener('keydown', onKey)
    return () => document.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div ref={wrap} className={className ?? 'min-w-[220px] flex-1 sm:max-w-sm'}>
      <SearchInput value={q} onChange={setQ} placeholder={placeholder} />
    </div>
  )
}

/* ── Select lọc gắn với 1 tham số URL ─────────────────────── */

export function ParamSelect({
  state,
  name,
  all,
  options,
  className = 'w-44'
}: {
  state: ListState
  name: string
  all: string
  options: { value: string; label: string; count?: number }[]
  className?: string
}) {
  return (
    <Select value={state.params[name] ?? ''} onChange={(e) => state.set({ [name]: e.target.value })} className={className}>
      <option value="">{all}</option>
      {options.map((o) => (
        <option key={o.value} value={o.value}>
          {o.label}
          {o.count !== undefined ? ` (${o.count})` : ''}
        </option>
      ))}
    </Select>
  )
}

/* ── Chân danh sách: phân trang ───────────────────────────── */

export function ListFooter({ state, total }: { state: ListState; total: number }) {
  if (total <= 10 && state.page === 1) return null
  return (
    <Pagination
      page={state.page}
      pageSize={state.pageSize}
      total={total}
      onPage={(p) => {
        state.set({ page: p > 1 ? p : undefined }, { resetPage: false })
        window.scrollTo({ top: 0, behavior: 'smooth' })
      }}
      onPageSize={(s) => state.set({ pageSize: s === 25 ? undefined : s })}
    />
  )
}

/* ── Thanh thao tác hàng loạt nổi ─────────────────────────── */

export function BulkBar({ count, onClear, children }: { count: number; onClear: () => void; children: React.ReactNode }) {
  if (count === 0) return null
  return (
    <div
      role="toolbar"
      aria-label="Thao tác hàng loạt"
      className="fixed bottom-4 left-1/2 z-30 flex max-w-[calc(100vw-2rem)] items-center gap-1 overflow-x-auto rounded-xl border border-border bg-popover p-1.5 shadow-2xl shadow-black/20 animate-[bar-in_160ms_ease-out] [scrollbar-width:none]"
      style={{ transform: 'translateX(-50%)' }}
    >
      <span className="flex shrink-0 items-center gap-1 pl-2 pr-1 text-sm font-semibold text-foreground">
        <button type="button" onClick={onClear} aria-label="Bỏ chọn" className="rounded p-0.5 text-muted-foreground hover:text-foreground cursor-pointer">
          <X className="size-4" />
        </button>
        {count} đã chọn
      </span>
      <span className="mx-1 h-5 w-px shrink-0 bg-border" />
      {children}
    </div>
  )
}

/* ── Chọn cách sắp xếp (danh sách dạng thẻ, không có tiêu đề cột) ── */

export function SortSelect({ state, options, className = 'w-44' }: { state: ListState; options: [string, string][]; className?: string }) {
  return (
    <Select value={state.sort} onChange={(e) => state.set({ sort: e.target.value, dir: undefined })} className={className} aria-label="Sắp xếp">
      {options.map(([v, label]) => (
        <option key={v} value={v}>
          {label}
        </option>
      ))}
    </Select>
  )
}
