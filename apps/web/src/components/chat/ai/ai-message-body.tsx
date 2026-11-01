'use client'

import React, { useMemo } from 'react'
import Link from 'next/link'
import { FileText, Globe, Loader2, MessageSquare } from 'lucide-react'
import type { ChatCitation } from '@pu/schemas'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { ConnectorIcon } from '@/components/n7ai/connector-icon'
import type { UiMessage } from '@/hooks/chat'
import { SavedToTools } from '@/components/tools/saved-to-tools'
import { ActivityStatus } from './activity-status'
import { AiActions } from './ai-actions'
import { AiSteps } from './ai-steps'
import { FlashcardDeck } from './flashcard-deck'
import { QuizCard } from './quiz-card'
import { splitStudyBlocks } from './study-blocks'
import { ThinkingAccordion } from './thinking-accordion'
import { AskUserCard } from './ask-user-card'

// Phần tin cần để hiển thị (dùng lại cho trang chia sẻ công khai)
export type AiBodyMessage = Pick<UiMessage, 'content' | 'status' | 'blocks' | 'meta'> & { createdAt?: string }

// Nội dung tin N7AI: tiến trình (tìm nguồn, tool) + Markdown + quiz/flashcard tương tác + nguồn tham khảo
export function AiMessageBody({ message: m, onAskUserSelect }: { message: AiBodyMessage; onAskUserSelect?: (answer: string) => void }) {
  const segments = useMemo(() => splitStudyBlocks(m.content), [m.content])
  const reasoning = m.meta?.reasoning || ''
  const askUser = m.meta?.askUser
  const steps = m.meta?.steps ?? []
  const live = m.status === 'streaming'

  const hasProcess = Boolean(reasoning || steps.length > 0)

  return (
    <div className="space-y-2">
      <ActivityStatus
        live={live}
        steps={steps}
        durationMs={m.meta?.durationMs}
        startedAt={m.createdAt}
        writing={!!m.content}
      >
        {hasProcess && (
          <div className="space-y-1.5 pt-1">
            {reasoning && <ThinkingAccordion thinking={reasoning} live={live} durationMs={m.meta?.durationMs} defaultOpen={live} />}
            {steps.length > 0 && <AiSteps steps={steps} live={live} startedAt={m.createdAt} durationMs={m.meta?.durationMs} writing={!!m.content} />}
          </div>
        )}
      </ActivityStatus>

      {segments.map((s, i) =>
        s.type === 'markdown' ? (
          <MarkdownPreview
            key={i}
            content={s.text}
            className="prose prose-neutral dark:prose-invert max-w-none text-foreground font-normal leading-relaxed text-[14.5px] [&_p]:my-2.5 [&_ul]:my-2 [&_li]:my-1"
          />
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
      {askUser?.questions && (
        <AskUserCard questions={askUser.questions} onSelectOption={(ans) => onAskUserSelect?.(ans)} disabled={m.status === 'streaming'} />
      )}
      {m.meta?.studySet && m.status === 'done' && <SavedToTools set={m.meta.studySet} />}
      {m.meta?.actions && m.meta.actions.length > 0 && m.status === 'done' && <AiActions actions={m.meta.actions} />}
      {m.blocks && m.blocks.length > 0 && m.status === 'done' && (
        <div className="mt-2.5 pt-2.5 border-t border-border/40 space-y-1">
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
    case 'paper':
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
