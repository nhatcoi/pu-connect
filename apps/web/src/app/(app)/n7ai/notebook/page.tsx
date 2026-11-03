'use client'

import React, { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { FilePlus2, FileText, Loader2, MoreHorizontal, NotebookPen, Pin, PinOff, Search, Trash2 } from 'lucide-react'
import type { AiNoteSummary } from '@pu/schemas'
import { noteTitle } from '@/components/n7ai/side-panel/note-tree'
import { N7AiPageHeader } from '@/components/n7ai/n7ai-page-header'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiNoteMutations, useAiNotes } from '@/hooks/chat/use-ai-notes'
import { cn, formatRelativeTime } from '@/lib/utils'

// Chữ mở đầu nội dung, bỏ cú pháp Markdown thô để làm đoạn xem trước trên thẻ
function snippet(content: string): string {
  const plain = content
    .replace(/```[\s\S]*?```/g, ' ')
    .replace(/[#>*_`~|-]/g, ' ')
    .replace(/!?\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
  return plain.length > 140 ? `${plain.slice(0, 140)}…` : plain
}

// /n7ai/notebook: xưởng viết rộng — lưới mọi trang ghi chú, mở trang nào dùng hết chiều rộng (khác panel Ghi chú ở cạnh chat, dành cho sửa nhanh)
export default function NotebookPage() {
  const router = useRouter()
  const { notes, isPending } = useAiNotes()
  const { create } = useAiNoteMutations()
  const [query, setQuery] = useState('')
  const [confirmDelete, setConfirmDelete] = useState<AiNoteSummary | null>(null)

  const q = query.trim().toLowerCase()
  const shown = useMemo(() => (q ? notes.filter((n) => noteTitle(n).toLowerCase().includes(q)) : notes), [notes, q])

  const addPage = () => create.mutate({}, { onSuccess: (n) => router.push(`/n7ai/notebook/${n.id}`) })

  return (
    <div className="flex min-h-0 flex-1 flex-col">
      <N7AiPageHeader
        title="Notebook"
        description="Mọi trang ghi chú của bạn, soạn rộng rãi ngoài khung chat"
        actions={
          <Button size="sm" disabled={create.isPending} onClick={addPage} className="h-8 cursor-pointer rounded-full px-3 text-xs">
            {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />} Trang mới
          </Button>
        }
      />

      <div className="px-3 pb-6 sm:px-1">
        <div className="relative mb-4 max-w-sm">
          <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-muted-foreground" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Tìm trang theo tiêu đề…"
            className="h-8 w-full rounded-full border border-border bg-background pl-8 pr-3 text-xs text-foreground outline-none focus:border-primary"
          />
        </div>

        {isPending ? (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {Array.from({ length: 6 }, (_, i) => (
              <Skeleton key={i} className="h-28 rounded-xl" />
            ))}
          </div>
        ) : !shown.length ? (
          <div className="space-y-3 py-16 text-center text-muted-foreground">
            <NotebookPen className="mx-auto h-9 w-9 text-primary opacity-40" />
            <p className="text-sm">{q ? 'Không có trang nào khớp.' : 'Chưa có trang ghi chú nào. Soạn thoải mái, rộng rãi ngoài khung chat.'}</p>
            {!q && (
              <Button size="sm" disabled={create.isPending} onClick={addPage} className="cursor-pointer">
                {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />} Tạo trang đầu tiên
              </Button>
            )}
          </div>
        ) : (
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {shown.map((n) => (
              <NoteCard key={n.id} note={n} onOpen={() => router.push(`/n7ai/notebook/${n.id}`)} onDelete={() => setConfirmDelete(n)} />
            ))}
          </div>
        )}
      </div>

      <Dialog open={!!confirmDelete} onOpenChange={(v) => !v && setConfirmDelete(null)}>
        <DeleteDialog note={confirmDelete} onClose={() => setConfirmDelete(null)} />
      </Dialog>
    </div>
  )
}

function NoteCard({ note, onOpen, onDelete }: { note: AiNoteSummary; onOpen: () => void; onDelete: () => void }) {
  const { update } = useAiNoteMutations()
  const preview = snippet(note.preview)
  return (
    <div
      role="button"
      tabIndex={0}
      onClick={onOpen}
      onKeyDown={(e) => e.key === 'Enter' && onOpen()}
      className="group relative flex h-28 cursor-pointer flex-col rounded-xl border border-border bg-card p-3 text-left transition-colors hover:border-primary/40 hover:bg-muted/40"
    >
      <div className="flex items-start justify-between gap-1">
        <div className="flex min-w-0 items-center gap-1.5">
          {note.pinned ? <Pin className="h-3.5 w-3.5 shrink-0 text-primary" /> : <FileText className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />}
          <span className="truncate text-sm font-medium text-foreground">{noteTitle(note)}</span>
        </div>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button
              type="button"
              onClick={(e) => e.stopPropagation()}
              aria-label="Thêm tùy chọn"
              className={cn('flex h-6 w-6 shrink-0 cursor-pointer items-center justify-center rounded text-muted-foreground opacity-0 hover:bg-muted hover:text-foreground group-hover:opacity-100 focus-visible:opacity-100')}
            >
              <MoreHorizontal className="h-3.5 w-3.5" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" onClick={(e) => e.stopPropagation()}>
            <DropdownMenuItem onSelect={() => update.mutate({ id: note.id, pinned: !note.pinned })}>
              {note.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />} {note.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={onDelete} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Xóa
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <p className="mt-1.5 line-clamp-2 flex-1 text-xs text-muted-foreground">{preview || 'Trang trống'}</p>
      <p className="text-[11px] text-muted-foreground/80">{formatRelativeTime(note.updatedAt)}</p>
    </div>
  )
}

function DeleteDialog({ note, onClose }: { note: AiNoteSummary | null; onClose: () => void }) {
  const { remove } = useAiNoteMutations()
  if (!note) return <DialogContent />
  return (
    <DialogContent>
      <DialogHeader>
        <DialogTitle>Xóa trang này?</DialogTitle>
        <DialogDescription>“{noteTitle(note)}” và các trang con sẽ bị xóa vĩnh viễn.</DialogDescription>
      </DialogHeader>
      <DialogFooter className="gap-2 sm:space-x-0">
        <Button variant="ghost" onClick={onClose} className="cursor-pointer">
          Hủy
        </Button>
        <Button variant="destructive" disabled={remove.isPending} onClick={() => remove.mutate(note.id, { onSuccess: onClose })} className="cursor-pointer">
          {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Xóa
        </Button>
      </DialogFooter>
    </DialogContent>
  )
}
