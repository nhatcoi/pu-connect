'use client'

import React from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { BookmarkPlus, ExternalLink, Layers, LayoutGrid, List, ListChecks, MessageSquare, MoreHorizontal, Search, Trash2 } from 'lucide-react'
import { fileExt } from '@/components/chat/utils'
import { FlashcardDeck } from '@/components/chat/ai/flashcard-deck'
import { QuizCard } from '@/components/chat/ai/quiz-card'
import { DocumentThumbnail } from '@/components/documents/document-thumbnail'
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { n7aiThreadHref } from '@/lib/n7ai-routes'
import { cn, formatRelativeTime } from '@/lib/utils'
import { FILTERS, KIND_META, STUDY_ICON, type LibEntry, type LibFilter } from './library-model'

export type LibView = 'list' | 'grid'

export interface EntryActions {
  onOpen: (e: LibEntry) => void
  onRemove: (e: LibEntry) => void
  onSaveToKho: (e: LibEntry) => void
}

// Thanh lọc loại (kèm số lượng) + tìm kiếm + đổi kiểu xem danh sách / thẻ
export function LibraryToolbar({
  filter,
  onFilter,
  counts,
  query,
  onQuery,
  view,
  onView
}: {
  filter: LibFilter
  onFilter: (f: LibFilter) => void
  counts: Record<LibFilter, number>
  query: string
  onQuery: (q: string) => void
  view: LibView
  onView: (v: LibView) => void
}) {
  return (
    <div className="space-y-2.5 px-3 pb-3 sm:px-1">
      <div className="flex items-center gap-2">
        <label className="flex h-9 min-w-0 flex-1 items-center gap-2 rounded-full bg-card px-3 text-sm focus-within:ring-2 focus-within:ring-primary/30">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden />
          <input value={query} onChange={(e) => onQuery(e.target.value)} placeholder="Tìm kiếm" aria-label="Tìm kiếm" className="min-w-0 flex-1 bg-transparent outline-none placeholder:text-muted-foreground" />
        </label>
        <div className="flex shrink-0 rounded-full bg-card p-0.5" role="group" aria-label="Kiểu xem">
          {(['grid', 'list'] as const).map((v) => {
            const Icon = v === 'grid' ? LayoutGrid : List
            return (
              <button
                key={v}
                type="button"
                onClick={() => onView(v)}
                aria-pressed={view === v}
                aria-label={v === 'grid' ? 'Xem dạng thẻ (Lưới)' : 'Xem dạng danh sách'}
                className={cn('flex h-8 w-8 cursor-pointer items-center justify-center rounded-full transition-colors', view === v ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:text-foreground')}
              >
                <Icon className="h-4 w-4" />
              </button>
            )
          })}
        </div>
      </div>
      <div className="flex gap-1.5 overflow-x-auto no-scrollbar" role="tablist" aria-label="Phân loại">
        {FILTERS.map((f) => {
          const n = counts[f] ?? 0
          return (
            <button
              key={f}
              role="tab"
              aria-selected={filter === f}
              onClick={() => onFilter(f)}
              className={cn('h-8 shrink-0 cursor-pointer rounded-full px-3 text-xs font-medium transition-colors', filter === f ? 'bg-foreground text-background' : 'bg-card text-muted-foreground hover:text-foreground')}
            >
              {f === 'all' ? 'Tất cả' : KIND_META[f].plural}
              {n > 0 && <span className={cn('ml-1.5 tabular-nums', filter === f ? 'opacity-70' : 'opacity-60')}>{n}</span>}
            </button>
          )
        })}
      </div>
    </div>
  )
}

function StudyThumbnail({ study, title, className }: { study: NonNullable<LibEntry['study']>; title: string; className?: string }) {
  if (study.kind === 'quiz') {
    return (
      <div className={cn('flex h-full w-full select-none flex-col justify-between bg-gradient-to-br from-indigo-500/10 via-background to-purple-500/10 p-3', className)}>
        <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
          <span className="flex items-center gap-1 text-[10px] font-bold text-indigo-500">
            <ListChecks className="h-3.5 w-3.5" /> QUIZ
          </span>
          <span className="rounded-full bg-indigo-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-indigo-600 dark:text-indigo-400">
            {study.data.questions.length} câu
          </span>
        </div>
        <p className="line-clamp-2 text-[11px] font-semibold leading-tight text-foreground">{title}</p>
        <div className="space-y-1">
          <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/70 px-2 py-1 text-[9px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-indigo-500" />
            <span className="h-1.5 flex-1 rounded bg-muted/80" />
          </div>
          <div className="flex items-center gap-1.5 rounded-md border border-border/50 bg-background/70 px-2 py-1 text-[9px] text-muted-foreground">
            <span className="h-1.5 w-1.5 rounded-full bg-border" />
            <span className="h-1.5 w-3/4 rounded bg-muted/60" />
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('flex h-full w-full select-none flex-col justify-between bg-gradient-to-br from-amber-500/10 via-background to-orange-500/10 p-3', className)}>
      <div className="flex items-center justify-between border-b border-border/40 pb-1.5">
        <span className="flex items-center gap-1 text-[10px] font-bold text-amber-600 dark:text-amber-400">
          <Layers className="h-3.5 w-3.5" /> FLASHCARDS
        </span>
        <span className="rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[9px] font-semibold text-amber-700 dark:text-amber-300">
          {study.data.cards.length} thẻ
        </span>
      </div>
      <div className="relative my-auto flex items-center justify-center py-2">
        <div className="absolute h-12 w-24 -rotate-6 rounded-lg border border-border/60 bg-card/60 shadow-xs" />
        <div className="absolute h-12 w-24 rotate-3 rounded-lg border border-border/70 bg-card/80 shadow-xs" />
        <div className="relative flex h-12 w-24 items-center justify-center rounded-lg border border-border bg-card p-1 shadow-sm">
          <p className="line-clamp-2 text-center text-[10px] font-semibold text-foreground">{title}</p>
        </div>
      </div>
      <div className="text-center text-[9px] text-muted-foreground">Chạm để ôn tập</div>
    </div>
  )
}

// Ô xem trước: ảnh thật, hoặc bìa tài liệu render trang đầu như /documents, hoặc học liệu
function Thumb({ entry, className }: { entry: LibEntry; className?: string }) {
  const meta = KIND_META[entry.kind]
  const Icon = entry.study ? STUDY_ICON[entry.study.kind] : meta.icon

  if (entry.thumb) {
    // eslint-disable-next-line @next/next/no-img-element
    return <img src={entry.thumb} alt="" loading="lazy" className={cn('h-full w-full object-cover', className)} />
  }

  if (entry.study) {
    return <StudyThumbnail study={entry.study} title={entry.title} className={className} />
  }

  const att = entry.doc?.attachment ?? entry.source?.attachment
  if (att) {
    return (
      <DocumentThumbnail
        document={{
          fileUrl: att.url,
          title: entry.title,
          mimeType: att.mime
        }}
        className={cn('h-full w-full', className)}
      />
    )
  }

  const ext = entry.doc?.attachment ? fileExt(entry.doc.attachment.name) : null
  return (
    <span className={cn('flex flex-col items-center justify-center gap-0.5 bg-primary/10 text-primary', className)}>
      <Icon className="h-4 w-4" />
      {ext && <span className="text-[9px] font-bold leading-none">{ext}</span>}
    </span>
  )
}

function EntryMenu({ entry, actions, className }: { entry: LibEntry; actions: EntryActions; className?: string }) {
  const router = useRouter()
  const canSave = entry.source?.kind === 'file'
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button type="button" aria-label={`Tùy chọn cho ${entry.title}`} className={cn('flex h-7 w-7 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground', className)} onClick={(e) => e.stopPropagation()}>
          <MoreHorizontal className="h-4 w-4" />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuItem onSelect={() => actions.onOpen(entry)}>
          <ExternalLink className="h-4 w-4" /> Mở
        </DropdownMenuItem>
        {entry.thread && (
          <DropdownMenuItem onSelect={() => router.push(n7aiThreadHref(entry.thread!.id, entry.thread!.messageId))}>
            <MessageSquare className="h-4 w-4" /> Mở cuộc trò chuyện
          </DropdownMenuItem>
        )}
        {canSave && (
          <DropdownMenuItem onSelect={() => actions.onSaveToKho(entry)}>
            <BookmarkPlus className="h-4 w-4" /> Lưu vào Kho của tôi
          </DropdownMenuItem>
        )}
        {entry.source && (
          <>
            <DropdownMenuSeparator />
            <DropdownMenuItem variant="destructive" onSelect={() => actions.onRemove(entry)}>
              <Trash2 className="h-4 w-4" /> Gỡ khỏi thư viện
            </DropdownMenuItem>
          </>
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

const where = (e: LibEntry) => (e.thread ? e.thread.title || 'Cuộc trò chuyện' : 'Thêm trực tiếp')

// Dạng danh sách: tên · loại · hoạt động
function LibraryList({ entries, actions }: { entries: LibEntry[]; actions: EntryActions }) {
  return (
    <div className="overflow-hidden rounded-xl bg-card">
      <div className="hidden grid-cols-[1fr_7rem_8rem_2rem] gap-3 border-b px-3 py-2 text-[11px] font-medium text-muted-foreground sm:grid">
        <span>Tên</span>
        <span>Loại</span>
        <span>Hoạt động</span>
        <span />
      </div>
      <ul>
        {entries.map((e) => (
          <li key={e.id} className="group grid grid-cols-[1fr_2rem] items-center gap-3 border-b px-3 py-2 last:border-b-0 hover:bg-muted/50 sm:grid-cols-[1fr_7rem_8rem_2rem]">
            <button type="button" onClick={() => actions.onOpen(e)} className="flex min-w-0 cursor-pointer items-center gap-3 text-left">
              <Thumb entry={e} className="h-10 w-10 shrink-0 rounded-lg" />
              <span className="min-w-0">
                <span className="block truncate text-[13px] font-medium">{e.title}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {e.subtitle} · {where(e)}
                </span>
              </span>
            </button>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">{KIND_META[e.kind].label}</span>
            <span className="hidden truncate text-xs text-muted-foreground sm:block">{formatRelativeTime(e.at)}</span>
            <EntryMenu entry={e} actions={actions} />
          </li>
        ))}
      </ul>
    </div>
  )
}

// Dạng thẻ: ô xem trước lớn + tên (chuẩn phong cách giá sách /documents)
function LibraryGrid({ entries, actions }: { entries: LibEntry[]; actions: EntryActions }) {
  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {entries.map((e) => {
        const ext = e.doc?.attachment ? fileExt(e.doc.attachment.name) : null
        const badgeLabel = e.study
          ? e.study.kind === 'quiz'
            ? 'Quiz'
            : 'Flashcard'
          : ext
            ? ext.toUpperCase()
            : KIND_META[e.kind].label

        return (
          <div key={e.id} className="group relative flex flex-col overflow-hidden rounded-xl border border-border bg-card transition-shadow hover:shadow-md">
            <button type="button" onClick={() => actions.onOpen(e)} className="flex min-h-0 flex-1 flex-col w-full cursor-pointer text-left">
              <div className="relative aspect-[4/3] w-full overflow-hidden border-b border-border/60 bg-muted/30">
                <Thumb entry={e} className="h-full w-full" />
                <span className="absolute left-2 top-2 rounded-md bg-background/85 px-1.5 py-0.5 text-[10px] font-semibold text-foreground shadow-sm backdrop-blur">
                  {badgeLabel}
                </span>
              </div>
              <span className="flex flex-1 flex-col justify-between p-3">
                <span className="block line-clamp-2 text-[13px] font-semibold leading-snug text-foreground group-hover:text-primary transition-colors">
                  {e.title}
                </span>
                <span className="mt-2 block truncate text-[11px] text-muted-foreground">
                  {KIND_META[e.kind].label} · {formatRelativeTime(e.at)}
                </span>
              </span>
            </button>
            <EntryMenu entry={e} actions={actions} className="absolute right-1.5 top-1.5 bg-background/85 opacity-0 backdrop-blur focus-visible:opacity-100 group-hover:opacity-100 max-sm:opacity-100 shadow-sm" />
          </div>
        )
      })}
    </div>
  )
}

export function LibraryEntries({ entries, view, actions }: { entries: LibEntry[]; view: LibView; actions: EntryActions }) {
  return view === 'list' ? <LibraryList entries={entries} actions={actions} /> : <LibraryGrid entries={entries} actions={actions} />
}

// Học liệu mở trong hộp thoại: ôn ngay tại chỗ
export function StudyDialog({ entry, onClose }: { entry: LibEntry | null; onClose: () => void }) {
  return (
    <Dialog open={!!entry} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-base">{entry?.title}</DialogTitle>
          <DialogDescription className="text-xs">{entry?.subtitle}</DialogDescription>
        </DialogHeader>
        {entry?.study && (entry.study.kind === 'quiz' ? <QuizCard data={entry.study.data} /> : <FlashcardDeck data={entry.study.data} />)}
        {entry?.thread && (
          <Link href={n7aiThreadHref(entry.thread.id, entry.thread.messageId)} className="text-xs text-muted-foreground hover:text-foreground hover:underline">
            Mở cuộc trò chuyện · {entry.thread.title || 'Cuộc trò chuyện mới'}
          </Link>
        )}
      </DialogContent>
    </Dialog>
  )
}
