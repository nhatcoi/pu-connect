'use client'

import React, { useMemo, useState } from 'react'
import Link from 'next/link'
import { ChevronDown, Layers, ListChecks } from 'lucide-react'
import type { AiLibraryItem, ChatAttachment } from '@pu/schemas'
import { FlashcardDeck } from '@/components/chat/ai/flashcard-deck'
import { QuizCard } from '@/components/chat/ai/quiz-card'
import { splitStudyBlocks, type FlashcardData, type QuizData } from '@/components/chat/ai/study-blocks'
import { FileCard, ImageLightbox } from '@/components/chat/thread/attachment-view'
import { n7aiThreadHref } from '@/lib/n7ai-routes'
import { formatRelativeTime } from '@/lib/utils'

const UNTITLED = 'Cuộc trò chuyện mới'

// Nguồn của mục: thread + thời điểm, bấm ⇒ mở thread tại đúng tin
function SourceLink({ item }: { item: AiLibraryItem }) {
  return (
    <Link
      href={n7aiThreadHref(item.threadId, item.messageId)}
      className="block truncate text-[11px] text-muted-foreground hover:text-foreground hover:underline"
    >
      {item.threadTitle || UNTITLED} · {formatRelativeTime(item.createdAt)}
    </Link>
  )
}

// Ảnh: lưới, bấm ⇒ xem lớn (lướt qua mọi ảnh đã tải)
export function LibraryImages({ items }: { items: AiLibraryItem[] }) {
  const [open, setOpen] = useState<number | null>(null)
  const images: ChatAttachment[] = useMemo(() => items.flatMap((i) => i.attachments), [items])
  return (
    <>
      <div className="grid grid-cols-3 gap-1 overflow-hidden rounded-xl sm:grid-cols-4">
        {images.map((img, i) => (
          <button key={img.key} onClick={() => setOpen(i)} className="aspect-square bg-muted cursor-zoom-in">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={img.url} alt={img.name} loading="lazy" className="h-full w-full object-cover" />
          </button>
        ))}
      </div>
      {open !== null && <ImageLightbox images={images} index={open} onIndex={setOpen} />}
    </>
  )
}

// Tệp: thẻ tệp + nguồn
export function LibraryFiles({ items }: { items: AiLibraryItem[] }) {
  return (
    <div className="space-y-2">
      {items.flatMap((item) =>
        item.attachments.map((f) => (
          <div key={f.key} className="space-y-1 rounded-xl bg-card p-2">
            <FileCard file={f} className="w-full" />
            <div className="px-1">
              <SourceLink item={item} />
            </div>
          </div>
        ))
      )}
    </div>
  )
}

type StudyBlock = { kind: 'quiz'; data: QuizData } | { kind: 'flashcards'; data: FlashcardData }

// Học liệu: mỗi khối quiz / flashcard 1 thẻ, mở ra ôn ngay tại chỗ
export function LibraryStudy({ items }: { items: AiLibraryItem[] }) {
  const blocks = useMemo(
    () =>
      items.flatMap((item) =>
        splitStudyBlocks(item.content ?? '').flatMap((s, i): { key: string; item: AiLibraryItem; block: StudyBlock }[] =>
          s.type === 'quiz' || s.type === 'flashcards' ? [{ key: `${item.messageId}-${i}`, item, block: { kind: s.type, data: s.data } as StudyBlock }] : []
        )
      ),
    [items]
  )
  return (
    <div className="space-y-2">
      {blocks.map((b) => (
        <StudyCard key={b.key} item={b.item} block={b.block} />
      ))}
    </div>
  )
}

function StudyCard({ item, block }: { item: AiLibraryItem; block: StudyBlock }) {
  const [open, setOpen] = useState(false)
  const isQuiz = block.kind === 'quiz'
  const Icon = isQuiz ? ListChecks : Layers
  const count = isQuiz ? `${block.data.questions.length} câu hỏi` : `${block.data.cards.length} thẻ`
  return (
    <div className="rounded-xl bg-card">
      <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className="flex w-full items-center gap-3 p-3 text-left cursor-pointer">
        <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="h-4 w-4" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block truncate text-[13px] font-semibold">{block.data.title || item.threadTitle || (isQuiz ? 'Quiz' : 'Flashcard')}</span>
          <span className="block text-[11px] text-muted-foreground">
            {isQuiz ? 'Quiz' : 'Flashcard'} · {count}
          </span>
        </span>
        <ChevronDown className={`h-4 w-4 shrink-0 text-muted-foreground transition-transform ${open ? 'rotate-180' : ''}`} />
      </button>
      {open && (
        <div className="space-y-2 px-3 pb-3">
          {isQuiz ? <QuizCard data={block.data} /> : <FlashcardDeck data={block.data} />}
          <SourceLink item={item} />
        </div>
      )}
    </div>
  )
}
