'use client'

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Check, FileDown, FilePlus2, FileText, FolderInput, Loader2, MoreHorizontal, NotebookPen, PanelLeft, Pin, PinOff, Trash2 } from 'lucide-react'
import { toast } from 'sonner'
import type { AiNote, AiNoteSummary } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { downloadAiNote, useAiNote, useAiNoteMutations, useAiNotes } from '@/hooks/chat/use-ai-notes'
import { cn } from '@/lib/utils'
import { useN7AiLayout } from '../layout/n7ai-layout-store'
import { NoteEditor } from './note-editor'
import { NoteTree, noteTitle } from './note-tree'

const SAVE_DELAY = 700

// Tab Ghi chú: cây trang + trình soạn Markdown tự lưu; menu ⋯ ghim · chuyển tới · xuất Markdown / Word · xóa
export function PanelNotes({ threadId }: { threadId?: string }) {
  const { notes, isPending } = useAiNotes()
  const { create } = useAiNoteMutations()
  const stored = useN7AiLayout((s) => s.activeNoteId)
  const setActive = useN7AiLayout((s) => s.setActiveNoteId)
  const [showTree, setShowTree] = useState(false)
  const activeId = stored && notes.some((n) => n.id === stored) ? stored : (notes[0]?.id ?? null)

  const add = useCallback(
    (parentId: string | null) =>
      create.mutate(
        { parentId, conversationId: threadId ?? null },
        {
          onSuccess: (n) => {
            setActive(n.id)
            setShowTree(false)
          }
        }
      ),
    [create, setActive, threadId]
  )

  if (isPending) {
    return (
      <div className="space-y-3 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    )
  }
  if (!activeId) {
    return (
      <div className="flex flex-1 flex-col items-center justify-center gap-3 px-6 text-center text-muted-foreground">
        <NotebookPen className="h-9 w-9 text-primary opacity-40" />
        <p className="text-xs">Giữ ý tưởng bên cạnh cuộc trò chuyện.</p>
        <Button size="sm" disabled={create.isPending} onClick={() => add(null)} className="cursor-pointer">
          {create.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <FilePlus2 className="h-3.5 w-3.5" />} Tạo ghi chú
        </Button>
      </div>
    )
  }
  return (
    <div className="relative flex min-h-0 flex-1">
      <div className={cn('shrink-0 overflow-y-auto border-r border-border/60 bg-surface transition-[width] duration-200', showTree ? 'w-56' : 'w-0 border-r-0')} aria-hidden={!showTree}>
        <div className={cn('w-56 transition-opacity', showTree ? 'opacity-100' : 'pointer-events-none opacity-0')}>
          <div className="flex items-center justify-between px-3 pt-3 text-xs font-medium text-muted-foreground">
            Trang
            <button type="button" onClick={() => add(null)} title="Trang mới" aria-label="Trang mới" className="flex h-7 w-7 cursor-pointer items-center justify-center rounded-md hover:bg-muted hover:text-foreground">
              <FilePlus2 className="h-4 w-4" />
            </button>
          </div>
          <NoteTree notes={notes} activeId={activeId} onSelect={setActive} onAddChild={add} />
        </div>
      </div>
      <NoteView key={activeId} id={activeId} notes={notes} onToggleTree={() => setShowTree((v) => !v)} onGone={() => setActive(null)} />
    </div>
  )
}

// Một ghi chú đang mở: tiêu đề + nội dung giữ ở local, lưu sau SAVE_DELAY ms; rời ghi chú ⇒ lưu nốt
function NoteView({ id, notes, onToggleTree, onGone }: { id: string; notes: AiNoteSummary[]; onToggleTree: () => void; onGone: () => void }) {
  const { data: note, isPending } = useAiNote(id)
  const { update, remove } = useAiNoteMutations()
  const [title, setTitle] = useState<string | null>(null)
  const [saved, setSaved] = useState(true)
  const draft = useRef<{ title?: string; content?: string }>({})
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const appendRef = useRef<((markdown: string) => void) | null>(null)
  const setOpenNoteId = useN7AiLayout((s) => s.setOpenNoteId)
  const request = useN7AiLayout((s) => s.appendRequest)

  const flush = useCallback(() => {
    if (timer.current) clearTimeout(timer.current)
    timer.current = null
    const patch = draft.current
    draft.current = {}
    if (patch.title === undefined && patch.content === undefined) return
    update.mutate({ id, ...patch }, { onSuccess: () => setSaved(Object.keys(draft.current).length === 0) })
  }, [id, update])
  const schedule = useCallback(
    (patch: { title?: string; content?: string }) => {
      draft.current = { ...draft.current, ...patch }
      setSaved(false)
      if (timer.current) clearTimeout(timer.current)
      timer.current = setTimeout(flush, SAVE_DELAY)
    },
    [flush]
  )
  useEffect(() => flush, [flush]) // rời ghi chú / đóng panel ⇒ lưu phần chưa lưu
  useEffect(() => {
    setOpenNoteId(id)
    return () => setOpenNoteId(null)
  }, [id, setOpenNoteId])
  const ready = !!note
  useEffect(() => {
    if (!request || request.id !== id || !ready || !appendRef.current) return
    appendRef.current(request.markdown)
    useN7AiLayout.getState().clearAppend()
  }, [request, id, ready])

  const descendants = useMemo(() => {
    const out = new Set<string>([id])
    let grew = true
    while (grew) {
      grew = false
      for (const n of notes) {
        if (n.parentId && out.has(n.parentId) && !out.has(n.id)) {
          out.add(n.id)
          grew = true
        }
      }
    }
    return out
  }, [notes, id])

  if (isPending || !note) {
    return (
      <div className="flex-1 space-y-3 p-6">
        <Skeleton className="h-8 w-2/3" />
        <Skeleton className="h-4 w-full" />
      </div>
    )
  }
  const shownTitle = title ?? note.title
  const move = (parentId: string | null) => update.mutate({ id, parentId })
  const exportAs = (format: 'md' | 'docx') => {
    flush()
    downloadAiNote(id, format, shownTitle).catch((e: Error) => toast.error(e.message))
  }
  return (
    <div className="flex min-w-0 flex-1 flex-col">
      <div className="flex h-12 shrink-0 items-center gap-1 border-b border-border/60 px-2">
        <button type="button" onClick={onToggleTree} title="Danh sách trang" aria-label="Danh sách trang" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
          <PanelLeft className="h-4 w-4" />
        </button>
        <input
          value={shownTitle}
          onChange={(e) => {
            setTitle(e.target.value)
            schedule({ title: e.target.value })
          }}
          placeholder="Chưa đặt tên"
          aria-label="Tiêu đề ghi chú"
          maxLength={200}
          className="min-w-0 flex-1 bg-transparent px-1 text-sm font-medium text-foreground outline-none placeholder:text-muted-foreground"
        />
        <span className="flex shrink-0 items-center gap-1 text-xs text-muted-foreground" aria-live="polite">
          {saved && !update.isPending ? <Check className="h-3 w-3" /> : <Loader2 className="h-3 w-3 animate-spin" />}
          {saved && !update.isPending ? 'Đã lưu' : 'Đang lưu…'}
        </span>
        <DropdownMenu modal={false}>
          <DropdownMenuTrigger asChild>
            <button type="button" aria-label="Thêm tùy chọn" className="flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground">
              <MoreHorizontal className="h-4 w-4" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-52">
            <DropdownMenuItem onSelect={() => update.mutate({ id, pinned: !note.pinned })}>
              {note.pinned ? <PinOff className="mr-2 h-4 w-4" /> : <Pin className="mr-2 h-4 w-4" />} {note.pinned ? 'Bỏ ghim' : 'Ghim lên đầu'}
            </DropdownMenuItem>
            <DropdownMenuSub>
              <DropdownMenuSubTrigger>
                <FolderInput className="mr-2 h-4 w-4" /> Chuyển tới
              </DropdownMenuSubTrigger>
              <DropdownMenuSubContent className="max-h-72 w-52 overflow-y-auto">
                {note.parentId && <DropdownMenuItem onSelect={() => move(null)}>Gốc (không thuộc trang nào)</DropdownMenuItem>}
                {notes
                  .filter((n) => !descendants.has(n.id) && n.id !== note.parentId)
                  .map((n) => (
                    <DropdownMenuItem key={n.id} onSelect={() => move(n.id)}>
                      <FileText className="mr-2 h-4 w-4 shrink-0" />
                      <span className="truncate">{noteTitle(n)}</span>
                    </DropdownMenuItem>
                  ))}
                {!note.parentId && notes.every((n) => descendants.has(n.id)) && <div className="px-2 py-1.5 text-xs text-muted-foreground">Chưa có trang khác</div>}
              </DropdownMenuSubContent>
            </DropdownMenuSub>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => exportAs('md')}>
              <FileDown className="mr-2 h-4 w-4" /> Xuất Markdown
            </DropdownMenuItem>
            <DropdownMenuItem onSelect={() => exportAs('docx')}>
              <FileDown className="mr-2 h-4 w-4" /> Xuất Word
            </DropdownMenuItem>
            <p className="px-2 pb-1.5 pt-1 text-[11px] leading-snug text-muted-foreground">Word giữ chữ và liên kết; khối tương tác thành chữ tĩnh.</p>
            <DropdownMenuSeparator />
            <DropdownMenuItem onSelect={() => setConfirmDelete(true)} className="text-destructive focus:text-destructive">
              <Trash2 className="mr-2 h-4 w-4" /> Xóa ghi chú
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
      <NoteEditor key={note.id} initial={note.content} onChange={(content) => schedule({ content })} appendRef={appendRef} />
      <Dialog open={confirmDelete} onOpenChange={setConfirmDelete}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Xóa ghi chú này?</DialogTitle>
            <DialogDescription>“{noteTitle({ title: shownTitle })}” và các trang con sẽ bị xóa vĩnh viễn.</DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2 sm:space-x-0">
            <Button variant="ghost" onClick={() => setConfirmDelete(false)} className="cursor-pointer">
              Hủy
            </Button>
            <Button
              variant="destructive"
              disabled={remove.isPending}
              onClick={() => {
                draft.current = {}
                if (timer.current) clearTimeout(timer.current)
                remove.mutate(id, {
                  onSuccess: () => {
                    setConfirmDelete(false)
                    onGone()
                  }
                })
              }}
              className="cursor-pointer"
            >
              {remove.isPending && <Loader2 className="h-3.5 w-3.5 animate-spin" />} Xóa
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export type { AiNote }
