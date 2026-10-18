'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Check, Loader2, MoreHorizontal, Pencil, Search, Share2, Trash2, X } from 'lucide-react'
import type { AiThread } from '@pu/schemas'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { Skeleton } from '@/components/ui/skeleton'
import { chatApi, useAiThreadActions, useAiThreads, type UiPage } from '@/hooks/chat'
import { N7AI_HOME, n7aiThreadHref } from '@/lib/n7ai-routes'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { ShareThreadDialog } from './share-thread-dialog'

const SEARCH_DEBOUNCE_MS = 250
const UNTITLED = 'Cuộc trò chuyện mới'

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

// Lịch sử hội thoại N7AI (thanh bên /n7ai): tìm theo tiêu đề / nội dung, cuộn tải thêm, đổi tên / chia sẻ / xóa; rê chuột ⇒ tải trước tin
export function AiThreadList({ activeId, onNavigate }: { activeId?: string; onNavigate?: () => void }) {
  const qc = useQueryClient()
  const [search, setSearch] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    const t = setTimeout(() => setQ(search.trim()), SEARCH_DEBOUNCE_MS)
    return () => clearTimeout(t)
  }, [search])

  const { threads, isPending, hasNextPage, isFetchingNextPage, fetchNextPage } = useAiThreads(q)

  const groups = useMemo(() => {
    const now = new Date()
    const out: { label: string; items: AiThread[] }[] = []
    for (const t of threads) {
      const label = groupLabel(t.lastMessageAt ?? t.createdAt, now)
      const last = out[out.length - 1]
      if (last?.label === label) last.items.push(t)
      else out.push({ label, items: [t] })
    }
    return out
  }, [threads])

  // Cuộn gần cuối ⇒ tải trang tiếp
  const sentinel = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = sentinel.current
    if (!el || !hasNextPage) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && !isFetchingNextPage && void fetchNextPage(), { rootMargin: '200px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [hasNextPage, isFetchingNextPage, fetchNextPage])

  // Trang tin đầu tiên tải trước khi rê chuột (mở thread gần như tức thì)
  const prefetch = (id: string) =>
    void qc.prefetchInfiniteQuery({
      queryKey: queryKeys.messages(id),
      queryFn: () => chatApi.messages(id) as Promise<UiPage>,
      initialPageParam: null as string | null,
      staleTime: 60 * 1000
    })

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

      <div className="min-h-0 flex-1 overflow-y-auto no-scrollbar -mx-1 px-1 space-y-2">
        {isPending ? (
          Array.from({ length: 5 }, (_, i) => <Skeleton key={i} className="h-8 rounded-lg" />)
        ) : !threads.length ? (
          <p className="py-6 text-center text-xs text-muted-foreground">{q ? 'Không tìm thấy cuộc trò chuyện' : 'Chưa có cuộc trò chuyện nào'}</p>
        ) : (
          groups.map((g) => (
            <div key={g.label}>
              <p className="px-2 pb-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted-foreground">{g.label}</p>
              {g.items.map((t) => (
                <ThreadRow key={t.id} thread={t} active={t.id === activeId} onHover={() => prefetch(t.id)} onNavigate={onNavigate} />
              ))}
            </div>
          ))
        )}
        <div ref={sentinel} aria-hidden />
        {isFetchingNextPage && <Loader2 className="h-4 w-4 animate-spin mx-auto text-muted-foreground" aria-label="Đang tải thêm" />}
      </div>
    </div>
  )
}

function ThreadRow({ thread, active, onHover, onNavigate }: { thread: AiThread; active: boolean; onHover: () => void; onNavigate?: () => void }) {
  const router = useRouter()
  const { rename, remove } = useAiThreadActions()
  // Xóa thread đang mở ⇒ về trang chat mới
  const destroy = () => {
    if (!window.confirm('Xóa cuộc trò chuyện này? Không thể hoàn tác.')) return
    remove.mutate(thread.id, { onSuccess: () => active && router.replace(N7AI_HOME) })
  }
  const [editing, setEditing] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [title, setTitle] = useState(thread.title ?? '')

  const save = () => {
    const next = title.trim()
    setEditing(false)
    if (next && next !== thread.title) rename.mutate({ id: thread.id, title: next })
  }

  if (editing) {
    return (
      <form
        className="flex items-center gap-1 rounded-lg bg-muted px-2 h-8"
        onSubmit={(e) => {
          e.preventDefault()
          save()
        }}
      >
        <input
          autoFocus
          value={title}
          maxLength={150}
          onChange={(e) => setTitle(e.target.value)}
          onBlur={save}
          onKeyDown={(e) => e.key === 'Escape' && setEditing(false)}
          className="flex-1 bg-transparent text-xs outline-none"
        />
        <button type="submit" aria-label="Lưu tên" className="cursor-pointer text-primary">
          <Check className="h-3.5 w-3.5" />
        </button>
      </form>
    )
  }

  return (
    <div className={cn('group flex items-center rounded-lg h-8 pr-1', active ? 'bg-primary/10 text-primary' : 'hover:bg-muted')}>
      <Link href={n7aiThreadHref(thread.id)} onMouseEnter={onHover} onClick={onNavigate} className="flex-1 min-w-0 px-2 text-xs truncate">
        {thread.title || UNTITLED}
      </Link>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Tùy chọn cho ${thread.title || UNTITLED}`}
            className="p-1 rounded-full text-muted-foreground md:opacity-0 md:group-hover:opacity-100 focus:opacity-100 data-[state=open]:opacity-100 hover:text-foreground cursor-pointer"
          >
            <MoreHorizontal className="h-3.5 w-3.5" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-40">
          <DropdownMenuItem
            onSelect={() => {
              setTitle(thread.title ?? '')
              setEditing(true)
            }}
          >
            <Pencil /> Đổi tên
          </DropdownMenuItem>
          <DropdownMenuItem onSelect={() => setSharing(true)}>
            <Share2 /> Chia sẻ
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={destroy}>
            <Trash2 /> Xóa
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
      {sharing && <ShareThreadDialog threadId={thread.id} open onOpenChange={setSharing} />}
    </div>
  )
}
