'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { FileText, Globe, Loader2, MessageSquare, Sparkles } from 'lucide-react'
import type { ChatCitation } from '@pu/schemas'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import type { UiMessage } from '@/hooks/chat'
import { AI_MODE_META } from './ai-modes'
import { FlashcardDeck } from './flashcard-deck'
import { QuizCard } from './quiz-card'
import { splitStudyBlocks } from './study-blocks'

// Nội dung tin N7AI: Markdown + quiz/flashcard tương tác + nguồn tham khảo
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
            <CitationLink key={`${b.ref.type}:${b.ref.id}`} citation={b} />
          ))}
        </div>
      )}
    </div>
  )
}

// Liên kết nguồn: bài / tài liệu PU (trong app), Drive / Calendar / web (tab mới)
function citationHref({ ref, title }: ChatCitation): string {
  switch (ref.type) {
    case 'post':
      return `/post/${ref.id}`
    case 'document':
      return `/search?q=${encodeURIComponent(title)}&type=documents`
    case 'drive':
      return `https://drive.google.com/file/d/${encodeURIComponent(ref.id)}/view`
    case 'calendar':
      return 'https://calendar.google.com/calendar/r/week'
    case 'web':
      return /^https?:\/\//.test(ref.id) ? ref.id : '#'
  }
}

function CitationLink({ citation: b }: { citation: ChatCitation }) {
  const icon =
    b.ref.type === 'post' ? (
      <MessageSquare className="h-3 w-3 shrink-0" />
    ) : b.ref.type === 'document' ? (
      <FileText className="h-3 w-3 shrink-0" />
    ) : b.ref.type === 'web' ? (
      <Globe className="h-3 w-3 shrink-0" />
    ) : (
      <ConnectorIcon id={b.ref.type} className="h-3.5 w-3.5" />
    )
  const className = 'flex items-center gap-1.5 text-xs text-primary hover:underline'
  const label = <span className="truncate">{b.title}</span>
  if (b.ref.type === 'post' || b.ref.type === 'document') {
    return (
      <Link href={citationHref(b)} className={className}>
        {icon}
        {label}
      </Link>
    )
  }
  return (
    <a href={citationHref(b)} target="_blank" rel="noopener noreferrer" className={className}>
      {icon}
      {label}
    </a>
  )
}
