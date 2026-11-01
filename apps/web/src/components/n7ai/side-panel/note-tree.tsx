'use client'

import React, { useMemo, useState } from 'react'
import { ChevronRight, FilePlus2, FileText, Pin } from 'lucide-react'
import type { AiNoteSummary } from '@pu/schemas'
import { cn } from '@/lib/utils'

export const noteTitle = (n: { title: string }) => n.title.trim() || 'Chưa đặt tên'

// Cây trang: trang gốc (ghim lên đầu) + trang con thụt lề, mở / thu từng nhánh
export function NoteTree({ notes, activeId, onSelect, onAddChild }: { notes: AiNoteSummary[]; activeId: string | null; onSelect: (id: string) => void; onAddChild: (parentId: string) => void }) {
  const children = useMemo(() => {
    const map = new Map<string | null, AiNoteSummary[]>()
    const ids = new Set(notes.map((n) => n.id))
    for (const n of notes) {
      const key = n.parentId && ids.has(n.parentId) ? n.parentId : null
      map.set(key, [...(map.get(key) ?? []), n])
    }
    return map
  }, [notes])
  return (
    <nav aria-label="Các trang ghi chú" className="flex flex-col gap-0.5 p-2">
      {(children.get(null) ?? []).map((n) => (
        <Branch key={n.id} note={n} depth={0} tree={children} activeId={activeId} onSelect={onSelect} onAddChild={onAddChild} />
      ))}
    </nav>
  )
}

function Branch({ note, depth, tree, activeId, onSelect, onAddChild }: { note: AiNoteSummary; depth: number; tree: Map<string | null, AiNoteSummary[]> } & Pick<React.ComponentProps<typeof NoteTree>, 'activeId' | 'onSelect' | 'onAddChild'>) {
  const kids = tree.get(note.id) ?? []
  const [open, setOpen] = useState(true)
  return (
    <div>
      <div
        style={{ paddingLeft: 4 + depth * 14 }}
        className={cn('group flex h-8 items-center gap-1 rounded-md pr-1 text-xs transition-colors hover:bg-muted', activeId === note.id && 'bg-muted font-medium text-foreground')}
      >
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-label={open ? 'Thu gọn' : 'Mở rộng'}
          className={cn('flex h-6 w-5 shrink-0 cursor-pointer items-center justify-center text-muted-foreground', !kids.length && 'invisible')}
        >
          <ChevronRight className={cn('h-3.5 w-3.5 transition-transform', open && 'rotate-90')} />
        </button>
        <button type="button" onClick={() => onSelect(note.id)} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 text-left">
          {note.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate">{noteTitle(note)}</span>
        </button>
        <button
          type="button"
          onClick={() => onAddChild(note.id)}
          title="Thêm trang con"
          aria-label="Thêm trang con"
          className="flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 transition-opacity hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100"
        >
          <FilePlus2 className="h-3.5 w-3.5" />
        </button>
      </div>
      {open && kids.map((k) => <Branch key={k.id} note={k} depth={depth + 1} tree={tree} activeId={activeId} onSelect={onSelect} onAddChild={onAddChild} />)}
    </div>
  )
}
