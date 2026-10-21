'use client'

import React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { ExternalLink, X } from 'lucide-react'
import type { AiSource } from '@pu/schemas'
import { useAiSourceContent } from '@/hooks/chat'
import { Stage, ViewerError, ViewerLoading } from '@/components/viewer/views/viewer-parts'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import { cn } from '@/lib/utils'
import { KIND_ICON, entryFromSource } from './doc-entries'
import { useSourceView } from './source-view-store'

const iconBtn = 'flex h-8 w-8 shrink-0 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground'
const TIMESTAMP = /^\[(\d{2}:\d{2})\]\s?/

// Nội dung chữ của tài liệu; YouTube: mỗi đoạn có mốc thời gian
function SourceText({ source }: { source: AiSource }) {
  const { data, isError } = useAiSourceContent(source.id)
  if (isError) return <ViewerError message="Không tải được nội dung tài liệu" />
  if (!data) return <ViewerLoading />
  const lines = (data.content ?? '').split('\n')
  return (
    <Stage>
      <article className="mx-auto my-4 max-w-3xl rounded-xl bg-card p-5 pb-8 shadow-sm ring-1 ring-border sm:p-7">
        {source.kind === 'youtube' ? (
          <div className="space-y-2.5 text-sm leading-relaxed">
            {lines.map((line, i) => {
              const time = TIMESTAMP.exec(line)?.[1]
              return (
                <p key={i} className="flex gap-3">
                  {time && <span className="mt-0.5 shrink-0 font-mono text-[11px] text-primary">{time}</span>}
                  <span>{line.replace(TIMESTAMP, '')}</span>
                </p>
              )
            })}
          </div>
        ) : (
          <p className="whitespace-pre-wrap break-words text-sm leading-relaxed">{data.content}</p>
        )}
      </article>
    </Stage>
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
        <SourceText key={source.id} source={source} />
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
