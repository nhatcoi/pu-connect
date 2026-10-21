'use client'

import React from 'react'
import { cn } from '@/lib/utils'

export type GridCell = string | number | boolean | Date | null | undefined
export type GridRows = GridCell[][]

const MAX_ROWS = 500
const MAX_COLS = 40

// Cột A, B, … Z, AA, AB …
export function columnLabel(index: number): string {
  let n = index
  let label = ''
  do {
    label = String.fromCharCode(65 + (n % 26)) + label
    n = Math.floor(n / 26) - 1
  } while (n >= 0)
  return label
}

const formatCell = (cell: GridCell): string => {
  if (cell == null) return ''
  if (cell instanceof Date) return cell.toLocaleDateString('vi-VN')
  return String(cell)
}

// Bảng chỉ đọc kiểu bảng tính: số dòng, tên cột, tiêu đề dính; cắt bớt khi quá lớn để không treo trình duyệt
export function DataGrid({ rows }: { rows: GridRows }) {
  const shown = rows.slice(0, MAX_ROWS)
  const cols = Math.min(
    MAX_COLS,
    shown.reduce((max, row) => Math.max(max, row.length), 0)
  )
  const clipped = rows.length > MAX_ROWS
  if (cols === 0) return <p className="p-6 text-center text-sm text-muted-foreground">Bảng trống</p>
  return (
    <div className="p-3 pb-20">
      <table className="w-max min-w-full border-separate border-spacing-0 rounded-lg bg-card text-xs shadow-sm ring-1 ring-border">
        <thead>
          <tr>
            <th className="sticky left-0 top-0 z-20 w-10 border-b border-r bg-muted" />
            {Array.from({ length: cols }, (_, c) => (
              <th key={c} className="sticky top-0 z-10 border-b border-r bg-muted px-3 py-1.5 text-center font-medium text-muted-foreground">
                {columnLabel(c)}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {shown.map((row, r) => (
            <tr key={r} className="group">
              <th className="sticky left-0 z-10 border-b border-r bg-muted px-2 py-1 text-center font-normal text-muted-foreground">{r + 1}</th>
              {Array.from({ length: cols }, (_, c) => {
                const cell = row[c]
                return (
                  <td
                    key={c}
                    className={cn(
                      'max-w-72 truncate border-b border-r px-3 py-1 group-hover:bg-primary/5',
                      typeof cell === 'number' && 'text-right tabular-nums'
                    )}
                    title={formatCell(cell)}
                  >
                    {formatCell(cell)}
                  </td>
                )
              })}
            </tr>
          ))}
        </tbody>
      </table>
      {clipped && (
        <p className="mt-3 text-center text-xs text-muted-foreground">
          Hiển thị {MAX_ROWS} / {rows.length} dòng đầu. Tải về để xem đầy đủ.
        </p>
      )}
    </div>
  )
}
