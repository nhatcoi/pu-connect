'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, ChevronRight, Folder, FolderInput, FolderMinus, FolderPlus, Loader2, MoreHorizontal, Pencil, Search, Share2, Trash2, X } from 'lucide-react'
import type { AiFolder, AiThread } from '@pu/schemas'
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
import { chatApi, useAiFolders, useAiThreadActions, useAiThreads, type UiPage } from '@/hooks/chat'
import { N7AI_HOME, n7aiThreadHref } from '@/lib/n7ai-routes'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { ShareThreadDialog } from './share-thread-dialog'

const SEARCH_DEBOUNCE_MS = 250
const UNTITLED = 'Cuộc trò chuyện mới'
const DRAG_TYPE = 'application/x-n7ai-thread'
const sectionLabel = 'px-2 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground'

// Nhóm theo ngày hoạt động (tính tại client từ các trang đã tải)
function groupLabel(iso: string | null, now: Date): string {
  if (!iso) return 'Hôm nay'
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
  const t = new Date(iso).getTime()
  if (t >= startOfToday) return 'Hôm nay'
  if (t >= startOfToday - 86_400_000) return 'Hôm qua'
  if (t >= startOfToday - 7 * 86_400_000) return '7 ngày qua'
  if (t >= startOfToday - 30 * 86_400_000) return '30 ngày qua'
  return 'Cũ hơn'
}

function groupByDay(threads: AiThread[]) {
  const now = new Date()
  const out: { label: string; items: AiThread[] }[] = []
  for (const t of threads) {
    const label = groupLabel(t.lastMessageAt ?? t.createdAt, now)
    const last = out[out.length - 1]
    if (last?.label === label) last.items.push(t)
    else out.push({ label, items: [t] })
  }
  return out
}

// Thả thread (kéo từ ThreadRow) vào thư mục / Lịch sử
function useThreadDrop(onDropThread: (threadId: string) => void) {
  const [over, setOver] = useState(false)
  const accepts = (e: React.DragEvent) => e.dataTransfer.types.includes(DRAG_TYPE)
  return {
    over,
    props: {
      onDragOver: (e: React.DragEvent) => {
        if (!accepts(e)) return
        e.preventDefault()
        e.dataTransfer.dropEffect = 'move'
        setOver(true)
      },
      onDragLeave: (e: React.DragEvent) => {
        if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver(false)
      },
      onDrop: (e: React.DragEvent) => {
        setOver(false)
        const id = e.dataTransfer.getData(DRAG_TYPE)
        if (id) onDropThread(id)
      }
    }
  }
}

// Ô nhập tên tại chỗ (đổi tên thread / thư mục, tạo thư mục): Enter hoặc rời ô ⇒ lưu, Esc ⇒ hủy
function NameInput({ initial = '', maxLength, placeholder, onSave, onCancel }: { initial?: string; maxLength: number; placeholder?: string; onSave: (name: string) => void; onCancel: () => void }) {
  const [value, setValue] = useState(initial)
  const done = useRef(false)
  const save = () => {
    if (done.current) return
    done.current = true
    const next = value.trim()
    if (next && next !== initial) onSave(next)
    else onCancel()
  }
  return (
    <form
      className="flex h-8 items-center gap-1 rounded-lg bg-muted px-2"
      onSubmit={(e) => {
        e.preventDefault()
        save()
      }}
    >
      <input
        autoFocus
        value={value}
        maxLength={maxLength}
        placeholder={placeholder}
        onChange={(e) => setValue(e.target.value)}
        onBlur={save}
        onKeyDown={(e) => {
          if (e.key !== 'Escape') return
          done.current = true
          onCancel()
        }}
        className="flex-1 bg-transparent text-xs outline-none"
      />
      <button type="submit" aria-label="Lưu" className="cursor-pointer text-primary">
        <Check className="h-3.5 w-3.5" />
      </button>
    </form>
  )
}

// Lịch sử N7AI (thanh bên /n7ai): thư mục (kéo thả thread vào / ra) + lịch sử theo ngày; tìm kiếm ⇒ kết quả phẳng mọi thư mục
export function AiThreadList({ activeId, onNavigate }: { activeId?: string; onNavigate?: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  // Trang tin đầu tiên tải trước khi rê chuột (mở thread gần như tức thì)
  const prefetch = (id: string) =>
    void qc.prefetchInfiniteQuery({
      queryKey: queryKeys.messages(id),
      queryFn: () => chatApi.messages(id) as Promise<UiPage>,
      initialPageParam: null as string | null,
      staleTime: 60 * 1000
    })
  const rowProps = { activeId, onHover: prefetch, onNavigate }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <label className="flex items-center gap-2 rounded-full bg-muted px-3 h-8 shrink-0">
        <Search className="h-3.5 w-3.5 text-muted-foreground" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Tìm cuộc trò chuyện…"
          className="flex-1 bg-transparent text-xs outline-none"
        />
        {search && (
          <button type="button" onClick={() => setSearch('')} aria-label="Xóa tìm kiếm" className="cursor-pointer text-muted-foreground">
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </label>

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-3">
        {q ? (
          <ThreadFeed folder="all" q={q} empty="Không tìm thấy cuộc trò chuyện" {...rowProps} />
        ) : (
          <>
            <FolderSection {...rowProps} />
            <HistorySection {...rowProps} />
          </>
        )}
      </div>
    </div>
  )
}

type RowProps = { activeId?: string; onHover: (id: string) => void; onNavigate?: () => void }

// Danh sách thread theo ngày, cuộn gần cuối ⇒ tải trang tiếp
function ThreadFeed({ folder, q = '', empty, activeId, onHover, onNavigate }: RowProps & { folder: 'all' | 'root'; q?: string; empty: string }) {
  const { threads, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useAiThreads(q, folder)
  const groups = useMemo(() => groupByDay(threads), [threads])

  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && !isFetchingNextPage && void fetchNextPage(), { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  if (isPending) return <>{Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)}</>
  if (!threads.length) return <p className="py-4 text-center text-xs text-muted-foreground">{empty}</p>
  return (
    <div className="space-y-2">
      {groups.map((g) => (
        <div key={g.label}>
          <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
          {g.items.map((t) => (
            <ThreadRow key={t.id} thread={t} active={t.id === activeId} onHover={() => onHover(t.id)} onNavigate={onNavigate} />
          ))}
        </div>
      ))}
      <div ref={sentinel} aria-hidden />
      {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" aria-label="Đang tải thêm" />}
    </div>
  )
}

// "Lịch sử": thread chưa vào thư mục; thả thread vào đây ⇒ bỏ khỏi thư mục
function HistorySection(props: RowProps) {
  const { move } = useAiThreadActions()
  const drop = useThreadDrop((id) => move.mutate({ id, folderId: null }))
  return (
    <section {...drop.props} className={cn('rounded-lg transition-colors', drop.over && 'bg-primary/5 ring-1 ring-primary/40')}>
      <p className={cn(sectionLabel, 'pb-1')}>Lịch sử</p>
      <ThreadFeed folder="root" empty="Chưa có cuộc trò chuyện nào" {...props} />
    </section>
  )
}

function FolderSection(props: RowProps) {
  const { folders, create } = useAiFolders()
  const [creating, setCreating] = useState(false)
  return (
    <section className="space-y-0.5">
      <div className="flex items-center justify-between pr-1">
        <p className={sectionLabel}>Thư mục</p>
        <button
          type="button"
          onClick={() => setCreating(true)}
          aria-label="Tạo thư mục"
          className="cursor-pointer rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground"
        >
          <FolderPlus className="h-3.5 w-3.5" />
        </button>
      </div>
      {creating && (
        <NameInput
          maxLength={60}
          placeholder="Tên thư mục"
          onSave={(name) => {
            setCreating(false)
            create.mutate(name)
          }}
          onCancel={() => setCreating(false)}
        />
      )}
      {!folders.length && !creating && <p className="px-2 py-1 text-[11px] text-muted-foreground">Tạo thư mục rồi kéo cuộc trò chuyện vào để gom theo môn, dự án.</p>}
      {folders.map((f) => (
        <FolderRow key={f.id} folder={f} {...props} />
      ))}
    </section>
  )
}

function FolderRow({ folder, activeId, onHover, onNavigate }: RowProps & { folder: AiFolder }) {
  const { rename, remove } = useAiFolders()
  const { move } = useAiThreadActions()
  const [open, setOpen] = useState(false)
  const [editing, setEditing] = useState(false)
  const drop = useThreadDrop((id) => {
    setOpen(true)
    move.mutate({ id, folderId: folder.id })
  })
  const destroy = () => {
    if (window.confirm(`Xóa thư mục "${folder.name}"? Các cuộc trò chuyện bên trong chuyển về Lịch sử.`)) remove.mutate(folder.id)
  }

  if (editing) {
    return (
      <NameInput
        initial={folder.name}
        maxLength={60}
        onSave={(name) => {
          setEditing(false)
          rename.mutate({ id: folder.id, name })
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div {...drop.props} className={cn('rounded-lg transition-colors', drop.over && 'bg-primary/10 ring-1 ring-primary/40')}>
      <div className="group flex h-8 items-center rounded-lg pr-1 hover:bg-muted">
        <button type="button" onClick={() => setOpen((o) => !o)} aria-expanded={open} className="flex min-w-0 flex-1 cursor-pointer items-center gap-1.5 px-2 text-xs">
          <ChevronRight className={cn('h-3 w-3 shrink-0 text-muted-foreground transition-transform', open && 'rotate-90')} />
          <Folder className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{folder.name}</span>
          <span className="ml-auto pl-1 text-[10px] tabular-nums text-muted-foreground">{folder.threadCount || ''}</span>
        </button>
        <RowMenu label={folder.name}>
          <DropdownMenuItem onSelect={() => setEditing(true)}>
            <Pencil /> Đổi tên
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={destroy}>
            <Trash2 /> Xóa thư mục
          </DropdownMenuItem>
        </RowMenu>
      </div>
      {open && <FolderThreads folderId={folder.id} activeId={activeId} onHover={onHover} onNavigate={onNavigate} />}
    </div>
  )
}

// Thread trong thư mục (chỉ tải khi mở)
function FolderThreads({ folderId, activeId, onHover, onNavigate }: RowProps & { folderId: string }) {
  const { threads, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useAiThreads('', folderId)
  return (
    <div className="ml-3 border-l border-border/60 pl-1.5">
      {isPending ? (
        <Skeleton className="my-1 h-7 rounded-lg" />
      ) : !threads.length ? (
        <p className="px-2 py-1.5 text-[11px] text-muted-foreground">Kéo cuộc trò chuyện vào đây</p>
      ) : (
        threads.map((t) => <ThreadRow key={t.id} thread={t} active={t.id === activeId} onHover={() => onHover(t.id)} onNavigate={onNavigate} />)
      )}
      {hasNextPage && (
        <button
          type="button"
          onClick={() => void fetchNextPage()}
          disabled={isFetchingNextPage}
          className="cursor-pointer px-2 py-1 text-[11px] text-muted-foreground hover:text-foreground"
        >
          {isFetchingNextPage ? 'Đang tải…' : 'Xem thêm'}
        </button>
      )}
    </div>
  )
}

function RowMenu({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          aria-label={`Tùy chọn cho ${label}`}
          className="p-1 rounded-full text-muted-foreground md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:text-foreground cursor-pointer"
        >
          <MoreHorizontal className="h-3.5 w-3.5" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        {children}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

function ThreadRow({ thread, active, onHover, onNavigate }: { thread: AiThread; active: boolean; onHover: () => void; onNavigate?: () => void }) {
  const router = useRouter()
  const { rename, move, remove } = useAiThreadActions()
  const { folders } = useAiFolders()
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const title = thread.title || UNTITLED
  // Xóa thread đang mở ⇒ về trang chat mới
  const destroy = () => {
    if (!window.confirm('Xóa cuộc trò chuyện này? Không thể hoàn tác.')) return
    remove.mutate(thread.id, { onSuccess: () => active && router.replace(N7AI_HOME) })
  }

  if (editing) {
    return (
      <NameInput
        initial={thread.title ?? ''}
        maxLength={150}
        onSave={(next) => {
          setEditing(false)
          rename.mutate({ id: thread.id, title: next })
        }}
        onCancel={() => setEditing(false)}
      />
    )
  }

  return (
    <div
      draggable
      onDragStart={(e) => {
        e.dataTransfer.setData(DRAG_TYPE, thread.id)
        e.dataTransfer.effectAllowed = 'move'
      }}
      className={cn('group flex items-center rounded-lg h-8 pr-1', active ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}
    >
      <Link href={n7aiThreadHref(thread.id)} onMouseEnter={onHover} onClick={onNavigate} draggable={false} className="flex-1 min-w-0 px-2 text-xs truncate">
        {title}
      </Link>
      <RowMenu label={title}>
        <DropdownMenuItem onSelect={() => setEditing(true)}>
          <Pencil /> Đổi tên
        </DropdownMenuItem>
        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            <FolderInput /> Chuyển vào thư mục
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent className="w-48">
            {folders.length ? (
              folders.map((f) => (
                <DropdownMenuItem key={f.id} disabled={f.id === thread.folderId} onSelect={() => move.mutate({ id: thread.id, folderId: f.id })}>
                  <Folder /> <span className="truncate">{f.name}</span>
                </DropdownMenuItem>
              ))
            ) : (
              <p className="px-2 py-1.5 text-xs text-muted-foreground">Chưa có thư mục</p>
            )}
            {thread.folderId && (
              <>
                <DropdownMenuSeparator />
                <DropdownMenuItem onSelect={() => move.mutate({ id: thread.id, folderId: null })}>
                  <FolderMinus /> Bỏ khỏi thư mục
                </DropdownMenuItem>
              </>
            )}
          </DropdownMenuSubContent>
        </DropdownMenuSub>
        <DropdownMenuItem onSelect={() => setSharing(true)}>
          <Share2 /> Chia sẻ
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onSelect={destroy}>
          <Trash2 /> Xóa
        </DropdownMenuItem>
      </RowMenu>
      {sharing && <ShareThreadDialog threadId={thread.id} open onOpenChange={setSharing} />}
    </div>
  )
}
