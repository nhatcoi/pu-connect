'use client'

import React, { useEffect, useMemo, useRef, useState } from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ExternalLink, Loader2, X } from 'lucide-react'
import type { AiSource } from '@pu/schemas'
import { useAiSourceContent } from '@/hooks/chat'
import { Stage, ViewerError, ViewerLoading } from '@/components/viewer/views/viewer-parts'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import { cn } from '@/lib/utils'
import { STUDY_TOOLS, useStudyTool } from '../side-panel/study-tools'
import { QuoteSelection } from '@/components/chat/quotes/quote-selection'
import { KIND_ICON, entryFromSource } from './doc-entries'
import { useSourceView } from './source-view-store'
import { activeLine, parseTranscript } from './transcript'
import { YoutubeFrame, useYoutubePlayer } from './youtube-player'

const iconBtn = 'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
// Nội dung chữ của tài liệu (văn bản dán, trang web)
function SourceText({ source }: { source: AiSource }) {
  const { data, isError } = useAiSourceContent(source.id)
  if (isError) return <ViewerError message="Không tải được nội dung tài liệu" />
  if (!data) return <ViewerLoading />
  return (
    <Stage>
      <article className="mx-auto my-4 max-w-3xl rounded-xl bg-card p-5 pb-8 shadow-sm ring-1 ring-border sm:p-7">
        <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{data.content}</p>
      </article>
    </Stage>
  )
}

const LANGUAGES: Record<string, string> = { vi: 'tiếng Việt', en: 'tiếng Anh' }
const VIDEO_TOOLS = STUDY_TOOLS.filter((t) => ['summary', 'quiz', 'flashcards'].includes(t.id))

// Tóm tắt / quiz / flashcard từ video (chỉ khi video thuộc 1 cuộc trò chuyện để gửi yêu cầu vào đó)
function VideoTools({ threadId, source }: { threadId: string; source: AiSource }) {
  const { busy, run } = useStudyTool(threadId)
  const entry = useMemo(() => entryFromSource(source), [source])
  return (
    <div className="flex flex-wrap items-center gap-1.5">
      <span className="mr-1 text-[11px] text-muted-foreground">Học từ video:</span>
      {VIDEO_TOOLS.map((tool) => (
        <button
          key={tool.id}
          type="button"
          disabled={!!busy}
          onClick={() => void run(tool, entry)}
          className="flex h-7 cursor-pointer items-center gap-1.5 rounded-full bg-card px-3 text-xs ring-1 ring-border transition-colors hover:bg-muted disabled:cursor-default disabled:opacity-60"
        >
          {busy === tool.id ? <Loader2 className="h-3 w-3 animate-spin text-primary" /> : <tool.icon className="h-3 w-3 text-primary" />} {tool.label}
        </button>
      ))}
    </div>
  )
}

// Video YouTube + phụ đề: bấm mốc thời gian để tua, dòng đang phát được đánh dấu; học tiếp bằng công cụ hoặc chat bên trái
function VideoLesson({ source, videoId }: { source: AiSource; videoId: string }) {
  const { data, isError } = useAiSourceContent(source.id)
  const { frame, currentTime, listen, seekTo } = useYoutubePlayer()
  const [follow, setFollow] = useState(true)
  const lines = useMemo(() => parseTranscript(data?.content ?? ''), [data])
  const active = activeLine(lines, currentTime)
  const list = useRef<HTMLDivElement>(null)

  // Tự cuộn tới dòng đang phát (trong khung phụ đề, không kéo cả trang)
  useEffect(() => {
    if (!follow || active < 0) return
    list.current?.querySelector<HTMLElement>(`[data-line="${active}"]`)?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [active, follow])

  const captions = source.meta?.lang ? `Phụ đề ${source.meta.auto ? 'tự động ' : ''}${LANGUAGES[source.meta.lang.slice(0, 2)] ?? source.meta.lang}` : 'Phụ đề'
  return (
    <div className="flex h-full flex-col">
      <div className="shrink-0 space-y-2.5 p-3">
        <YoutubeFrame videoId={videoId} title={source.title} frame={frame} onLoad={listen} />
        {source.threadId && <VideoTools threadId={source.threadId} source={source} />}
      </div>
      <div className="flex shrink-0 items-center justify-between border-y px-3 py-1.5">
        <p className="text-[11px] font-medium text-muted-foreground">{captions}</p>
        <button
          type="button"
          aria-pressed={follow}
          onClick={() => setFollow((v) => !v)}
          className={cn('h-6 cursor-pointer rounded-full px-2.5 text-[11px] transition-colors', follow ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted')}
        >
          Cuộn theo video
        </button>
      </div>
      <div ref={list} className="min-h-0 flex-1 overflow-y-auto p-2">
        {isError ? (
          <ViewerError message="Không tải được phụ đề" />
        ) : !data ? (
          <ViewerLoading label="Đang tải phụ đề…" />
        ) : (
          lines.map((line, i) => (
            // Bấm dòng ⇒ tua; đang bôi đen chữ (để hỏi N7AI) thì không tua. Mốc giờ là nút thật (bàn phím) và không bị chọn lẫn vào đoạn trích
            <div
              key={i}
              data-line={i}
              data-quote-at={line.time}
              onClick={() => window.getSelection()?.isCollapsed !== false && seekTo(line.seconds)}
              className={cn('flex w-full cursor-pointer gap-3 rounded-lg px-2 py-1.5 text-left text-sm leading-relaxed transition-colors hover:bg-muted/60', i === active && 'bg-primary/10')}
            >
              <button type="button" onClick={() => seekTo(line.seconds)} className="mt-0.5 shrink-0 cursor-pointer select-none self-start font-mono text-[11px] text-primary">
                {line.time}
              </button>
              <span>{line.text}</span>
            </div>
          ))
        )}
      </div>
    </div>
  )
}

// Thanh tiêu đề + nội dung của 1 tài liệu dạng chữ (dùng cho panel N7AI và panel nổi trên màn nhỏ)
export function SourceView({ source, onClose, title }: { source: AiSource; onClose: () => void; title?: React.ReactNode }) {
  const entry = entryFromSource(source)
  const Icon = KIND_ICON[source.kind]
  return (
    <>
      <div className="flex items-center gap-2.5 border-b px-3 py-2.5">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <div className="min-w-0 flex-1">
          {title ?? <p className="truncate text-sm font-medium">{source.title}</p>}
          <p className="truncate text-[11px] text-muted-foreground">{entry.subtitle}</p>
        </div>
        {source.url && (
          <a href={source.url} target="_blank" rel="noopener noreferrer" className={iconBtn} aria-label="Mở trang gốc">
            <ExternalLink className="h-4 w-4" />
          </a>
        )}
        <button type="button" onClick={onClose} className={iconBtn} aria-label="Đóng">
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="min-h-0 flex-1">
        <QuoteSelection title={source.title} sourceId={source.id}>
          {source.kind === 'youtube' && source.meta?.videoId ? <VideoLesson key={source.id} source={source} videoId={source.meta.videoId} /> : <SourceText key={source.id} source={source} />}
        </QuoteSelection>
      </div>
    </>
  )
}

const slideIn = 'duration-300 data-[state=open]:animate-in data-[state=open]:slide-in-from-right data-[state=closed]:animate-out data-[state=closed]:slide-out-to-right'

// Panel nổi trượt từ cạnh phải cho tài liệu chữ; bố cục có panel riêng (N7AI desktop) ⇒ chỉ hiện ở màn nhỏ
export function SourceViewPanel() {
  const { source, close } = useSourceView()
  const hosted = useFilePreview((s) => s.hosted)
  return (
    <DialogPrimitive.Root open={!!source} onOpenChange={(o) => !o && close()} modal={false}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Content
          aria-describedby={undefined}
          onInteractOutside={(e) => e.preventDefault()}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className={cn('fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l bg-surface shadow-2xl outline-none md:w-[min(760px,52vw)]', slideIn, hosted > 0 && 'lg:hidden')}
        >
          {source && <SourceView source={source} onClose={close} title={<DialogPrimitive.Title className="truncate text-sm font-medium">{source.title}</DialogPrimitive.Title>} />}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
