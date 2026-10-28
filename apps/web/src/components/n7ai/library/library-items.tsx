'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { Layers, ListChecks } from 'lucide-react'
import type { AiLibraryItem } from '@pu/schemas'
import { AppCollapsible } from '@/components/ui/collapsible'
import { FlashcardDeck } from '@/components/chat/ai/flashcard-deck'
import { QuizCard } from '@/components/chat/ai/quiz-card'
import { splitStudyBlocks, type FlashcardData, type QuizData } from '@/components/chat/ai/study-blocks'
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
  const isQuiz = block.kind === 'quiz'
  const Icon = isQuiz ? ListChecks : Layers
  const count = isQuiz ? `${block.data.questions.length} câu hỏi` : `${block.data.cards.length} thẻ`

  return (
    <AppCollapsible
      variant="card"
      icon={<Icon className="h-4 w-4" />}
      title={block.data.title || item.threadTitle || (isQuiz ? 'Quiz' : 'Flashcard')}
      subtitle={`${isQuiz ? 'Bộ câu hỏi trắc nghiệm' : 'Bộ thẻ ghi nhớ'} · ${count}`}
      badge={
        <span className="rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
          {isQuiz ? 'Quiz' : 'Flashcard'}
        </span>
      }
    >
      <div className="space-y-2 pt-1">
        {isQuiz ? <QuizCard data={block.data} /> : <FlashcardDeck data={block.data} />}
        <SourceLink item={item} />
      </div>
    </AppCollapsible>
  )
}
