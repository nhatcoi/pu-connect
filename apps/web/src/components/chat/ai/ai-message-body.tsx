'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { FileText, Loader2, MessageSquare, Sparkles } from 'lucide-react'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import type { UiMessage } from '@/hooks/chat'
import { AI_MODE_META } from './ai-modes'
import { FlashcardDeck } from './flashcard-deck'
import { QuizCard } from './quiz-card'
import { splitStudyBlocks } from './study-blocks'

// Nội dung tin PU AI: Markdown + quiz/flashcard tương tác + nguồn tham khảo
export function AiMessageBody({ message: m }: { message: UiMessage }) {
  const segments = useMemo(() => splitStudyBlocks(m.content), [m.content])
  const mode = m.meta?.aiMode

  if (m.status === 'streaming' && !m.content) {
    return (
      <span className="flex items-center gap-1.5 text-muted-foreground">
        <Sparkles className="h-3.5 w-3.5 animate-pulse text-primary" />
        {mode ? `Đang soạn ${AI_MODE_META[mode].label.toLowerCase()}…` : 'Đang suy nghĩ…'}
      </span>
    )
  }

  return (
    <div className="space-y-1">
      {segments.map((s, i) =>
        s.type === 'markdown' ? (
          <MarkdownPreview key={i} content={s.text} className="prose-sm max-w-none" />
        ) : s.type === 'quiz' ? (
          <QuizCard key={i} data={s.data} />
        ) : s.type === 'flashcards' ? (
          <FlashcardDeck key={i} data={s.data} />
        ) : (
          <p key={i} className="flex items-center gap-1.5 text-xs text-muted-foreground py-2">
            <Loader2 className="h-3.5 w-3.5 animate-spin" /> Đang tạo {s.kind === 'quiz' ? 'quiz' : 'bộ thẻ'}…
          </p>
        )
      )}
      {m.blocks && m.blocks.length > 0 && m.status === 'done' && (
        <div className="mt-2 pt-2 border-t border-border/60 space-y-1">
          <p className="text-[11px] font-semibold text-muted-foreground">Nguồn tham khảo</p>
          {m.blocks.map((b) => (
            <Link
              key={`${b.ref.type}:${b.ref.id}`}
              href={b.ref.type === 'post' ? `/post/${b.ref.id}` : `/search?q=${encodeURIComponent(b.title)}&type=documents`}
              className="flex items-center gap-1.5 text-xs text-primary hover:underline"
            >
              {b.ref.type === 'post' ? <MessageSquare className="h-3 w-3 shrink-0" /> : <FileText className="h-3 w-3 shrink-0" />}
              <span className="truncate">{b.title}</span>
            </Link>
          ))}
        </div>
      )}
    </div>
  )
}
