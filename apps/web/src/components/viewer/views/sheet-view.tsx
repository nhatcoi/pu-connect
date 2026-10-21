'use client'

import React, { useEffect, useState } from 'react'
import { cn } from '@/lib/utils'
import { useFileBytes } from '../use-file-bytes'
import { DataGrid, type GridRows } from './data-grid'
import { Stage, ViewerError, ViewerLoading } from './viewer-parts'

type SheetTab = { sheet: string; data: GridRows }

// Excel (.xlsx): đọc ngay trong trình duyệt, mỗi sheet một tab
export default function SheetView({ url }: { url: string }) {
  const { data, isError } = useFileBytes(url)
  const [sheets, setSheets] = useState<SheetTab[] | null>(null)
  const [failed, setFailed] = useState(false)
  const [active, setActive] = useState(0)

  useEffect(() => {
    if (!data) return
    let stale = false
    import('read-excel-file/browser')
      .then(({ default: readXlsxFile }) => readXlsxFile(data.slice(0)))
      .then((result) => !stale && setSheets(result as SheetTab[]))
      .catch(() => !stale && setFailed(true))
    return () => {
      stale = true
    }
  }, [data])

  if (isError || failed) return <ViewerError />
  if (!sheets) return <ViewerLoading />
  return (
    <div className="flex h-full flex-col">
      <div className="min-h-0 flex-1">
        <Stage>
          <DataGrid rows={sheets[active]?.data ?? []} />
        </Stage>
      </div>
      {sheets.length > 1 && (
        <div className="flex shrink-0 gap-1 overflow-x-auto border-t bg-card p-1.5" role="tablist">
          {sheets.map((s, i) => (
            <button
              key={s.sheet}
              type="button"
              role="tab"
              aria-selected={i === active}
              onClick={() => setActive(i)}
              className={cn(
                'shrink-0 cursor-pointer rounded-full px-3 py-1 text-xs font-medium transition-colors',
                i === active ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {s.sheet}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
