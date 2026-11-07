'use client'

import React, { useMemo, useState } from 'react'
import { ArrowDown, ArrowUp, ArrowUpDown, Search, X } from 'lucide-react'
import { cn } from '@/lib/utils'
import { FigureFrame, useThrottledValue } from './figure-frame'

/** Khối ```csv / ```tsv — bảng dữ liệu: bấm tiêu đề để sắp xếp, ô tìm để lọc, cột số tự canh phải, phân trang. */

const PAGE = 25

/** Đọc CSV/TSV (có ngoặc kép, dấu phân cách `, ; tab`); dòng cuối đang gõ dở vẫn được đọc. */
export function parseDelimited(text: string): string[][] {
  const src = text.replace(/^﻿/, '').replace(/\r\n?/g, '\n')
  const firstLine = src.split('\n').find((l) => l.trim()) ?? ''
  const count = (ch: string) => {
    let n = 0
    let q = false
    for (const c of firstLine) {
      if (c === '"') q = !q
      else if (!q && c === ch) n++
    }
    return n
  }
  const delim = (['\t', ';', ','] as const).map((d) => [d, count(d)] as const).sort((a, b) => b[1] - a[1])[0]
  const sep = delim[1] > 0 ? delim[0] : ','
  const rows: string[][] = []
  let row: string[] = []
  let cell = ''
  let inQ = false
  for (let i = 0; i < src.length; i++) {
    const ch = src[i]
    if (inQ) {
      if (ch === '"') {
        if (src[i + 1] === '"') {
          cell += '"'
          i++
        } else inQ = false
      } else cell += ch
    } else if (ch === '"' && cell === '') inQ = true
    else if (ch === sep) {
      row.push(cell)
      cell = ''
    } else if (ch === '\n') {
      row.push(cell)
      rows.push(row)
      row = []
      cell = ''
    } else cell += ch
  }
  if (cell !== '' || row.length) {
    row.push(cell)
    rows.push(row)
  }
  return rows.filter((r) => r.some((c) => c.trim() !== '')).map((r) => r.map((c) => c.trim()))
}

const toNumber = (s: string): number | null => {
  const t = s.replace(/[\s%$€₫đ]/g, '').replace(/,(?=\d{3}(\D|$))/g, '')
  if (!t || !/^[-+]?(\d+\.?\d*|\.\d+)([eE][-+]?\d+)?$/.test(t)) return null
  return parseFloat(t)
}

const fold = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/đ/g, 'd').toLowerCase()

const csvCell = (v: string) => (/[",\n;\t]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v)

type Sort = { col: number; dir: 'asc' | 'desc' } | null

export function DataTableBlock({ content, code }: { content: string; code?: React.ReactNode }) {
  const src = useThrottledValue(content)
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState<Sort>(null)
  const [limit, setLimit] = useState(PAGE)

  const table = useMemo(() => {
    const rows = parseDelimited(src)
    if (rows.length === 0) return null
    const head = rows[0]
    const width = Math.max(...rows.map((r) => r.length))
    const header = Array.from({ length: width }, (_, i) => head[i] || `Cột ${i + 1}`)
    const body = rows.slice(1).map((r) => Array.from({ length: width }, (_, i) => r[i] ?? ''))
    const numeric = header.map((_, c) => {
      const cells = body.map((r) => r[c]).filter((v) => v !== '')
      return cells.length > 0 && cells.filter((v) => toNumber(v) !== null).length / cells.length >= 0.8
    })
    return { header, body, numeric }
  }, [src])

  const view = useMemo(() => {
    if (!table) return []
    const q = fold(query.trim())
    let rows = q ? table.body.filter((r) => r.some((c) => fold(c).includes(q))) : table.body
    if (sort) {
      const { col, dir } = sort
      const k = dir === 'asc' ? 1 : -1
      const isNum = table.numeric[col]
      rows = [...rows].sort((a, b) => {
        const x = a[col]
        const y = b[col]
        if (x === '' || y === '') return x === y ? 0 : x === '' ? 1 : -1 // ô trống luôn xuống cuối
        if (isNum) return ((toNumber(x) ?? 0) - (toNumber(y) ?? 0)) * k
        return x.localeCompare(y, 'vi', { numeric: true, sensitivity: 'base' }) * k
      })
    }
    return rows
  }, [table, query, sort])

  const cycle = (col: number) => {
    setSort((s) => (s?.col !== col ? { col, dir: 'asc' } : s.dir === 'asc' ? { col, dir: 'desc' } : null))
    setLimit(PAGE)
  }

  const body = !table ? (
    <div className="h-24 animate-pulse bg-muted/40" />
  ) : (
    <div>
      <div className="flex items-center gap-2 border-b px-3 py-2">
        <div className="relative w-full max-w-xs">
          <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => {
              setQuery(e.target.value)
              setLimit(PAGE)
            }}
            placeholder="Tìm kiếm"
            aria-label="Lọc bảng"
            className="h-8 w-full rounded-md border bg-background pl-7 pr-7 text-sm outline-none focus-visible:ring-1 focus-visible:ring-ring"
          />
          {query && (
            <button type="button" onClick={() => setQuery('')} aria-label="Xóa lọc" className="absolute right-1.5 top-1/2 -translate-y-1/2 rounded p-0.5 text-muted-foreground hover:text-foreground">
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <span className="ml-auto shrink-0 text-xs tabular-nums text-muted-foreground">
          {view.length === table.body.length ? `${table.body.length} hàng` : `${view.length} / ${table.body.length} hàng`}
        </span>
      </div>
      <div className="max-h-[420px] overflow-auto">
        <table className="w-full border-collapse text-sm">
          <thead className="sticky top-0 z-10 bg-muted">
            <tr>
              {table.header.map((h, c) => {
                const active = sort?.col === c
                const Icon = !active ? ArrowUpDown : sort.dir === 'asc' ? ArrowUp : ArrowDown
                return (
                  <th key={c} aria-sort={active ? (sort.dir === 'asc' ? 'ascending' : 'descending') : 'none'} className={cn('border-b px-3 py-2 font-semibold', table.numeric[c] ? 'text-right' : 'text-left')}>
                    <button type="button" onClick={() => cycle(c)} className={cn('inline-flex items-center gap-1 whitespace-nowrap hover:text-primary', table.numeric[c] && 'flex-row-reverse', active && 'text-primary')}>
                      {h}
                      <Icon className={cn('size-3', active ? 'opacity-100' : 'opacity-35')} />
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {view.slice(0, limit).map((r, i) => (
              <tr key={i} className="border-b last:border-0 odd:bg-transparent even:bg-muted/30 hover:bg-muted/60">
                {r.map((v, c) => (
                  <td key={c} className={cn('px-3 py-1.5', table.numeric[c] ? 'text-right tabular-nums' : 'text-left')}>
                    {v}
                  </td>
                ))}
              </tr>
            ))}
            {view.length === 0 && (
              <tr>
                <td colSpan={table.header.length} className="px-3 py-6 text-center text-muted-foreground">
                  Không có dòng khớp
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
      {view.length > limit && (
        <button type="button" onClick={() => setLimit((l) => l + PAGE)} className="w-full border-t py-2 text-xs text-primary hover:bg-muted/50">
          Hiện thêm {Math.min(PAGE, view.length - limit)} hàng ({view.length - limit} còn lại)
        </button>
      )}
    </div>
  )

  // Tải đúng dữ liệu đang xem (đã lọc + sắp xếp)
  const getDownload = table
    ? () => ({ text: [table.header, ...view].map((r) => r.map(csvCell).join(',')).join('\n'), name: 'bang.csv', mime: 'text/csv;charset=utf-8' })
    : undefined

  return <FigureFrame view={body} code={code ?? <code>{content}</code>} rawCode={content} getDownload={getDownload} />
}
