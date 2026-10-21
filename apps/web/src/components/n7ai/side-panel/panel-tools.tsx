'use client'

import React, { useState } from 'react'
import { CalendarCheck, FileText, GraduationCap, Layers, ListChecks, Loader2, MessagesSquare, Network, type LucideIcon } from 'lucide-react'
import type { AiMode } from '@pu/schemas'
import { LibraryStudy } from '@/components/n7ai/library/library-items'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import { useAiLibrary, useMessages } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import type { DocEntry } from '../sources/doc-entries'
import { useDocEntries } from './panel-docs'

type Tool = { id: string; mode: AiMode; icon: LucideIcon; label: string; hint: string; ask: string }

// Mỗi công cụ = 1 yêu cầu gửi vào cuộc trò chuyện theo chế độ học tương ứng (server: n7ai.prompts.ts)
const TOOLS: Tool[] = [
  { id: 'summary', mode: 'summarize', icon: FileText, label: 'Tóm tắt', hint: 'Ý chính, thuật ngữ, câu ôn', ask: 'Tóm tắt' },
  { id: 'quiz', mode: 'quiz', icon: ListChecks, label: 'Quiz', hint: '5 câu trắc nghiệm có chấm điểm', ask: 'Tạo quiz' },
  { id: 'flashcards', mode: 'flashcards', icon: Layers, label: 'Flashcard', hint: 'Thẻ lật để học thuộc', ask: 'Tạo flashcard' },
  {
    id: 'exam',
    mode: 'quiz',
    icon: GraduationCap,
    label: 'Đề thi thử',
    hint: '10 trắc nghiệm + 2 tự luận ngắn',
    ask: 'Tạo đề thi thử gồm 10 câu trắc nghiệm và 2 câu tự luận ngắn có đáp án gợi ý'
  },
  { id: 'mindmap', mode: 'ask', icon: Network, label: 'Sơ đồ tư duy', hint: 'Các ý chính dạng sơ đồ', ask: 'Vẽ sơ đồ tư duy (khối ```mermaid mindmap) các ý chính' },
  {
    id: 'plan',
    mode: 'plan',
    icon: CalendarCheck,
    label: 'Lộ trình ôn',
    hint: 'Theo ngày, thêm vào Google Lịch nếu đã kết nối',
    ask: 'Lập lộ trình ôn theo ngày'
  }
]

const requestText = (tool: Tool, doc: DocEntry | null) => `${tool.ask} ${doc ? `từ tài liệu "${doc.title}"` : 'từ nội dung cuộc trò chuyện này'}.`

// Tab Công cụ: tạo học liệu từ cả cuộc trò chuyện hoặc 1 tài liệu; học liệu đã tạo ôn ngay tại chỗ
export function PanelTools({ threadId }: { threadId?: string }) {
  if (!threadId) {
    return (
      <div className="space-y-2 px-6 py-12 text-center text-muted-foreground">
        <MessagesSquare className="mx-auto h-9 w-9 text-primary opacity-30" />
        <p className="text-xs">Mở một cuộc trò chuyện để tạo tóm tắt, quiz, flashcard… từ nội dung hoặc tài liệu trong đó.</p>
      </div>
    )
  }
  return <ThreadTools key={threadId} threadId={threadId} />
}

function ThreadTools({ threadId }: { threadId: string }) {
  const { send } = useMessages(threadId)
  const { entries } = useDocEntries(threadId)
  const previewing = useFilePreview((s) => s.file)
  // undefined = chưa chọn ⇒ theo tệp đang xem trong tab Tài liệu; null = cả cuộc trò chuyện
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  const [busy, setBusy] = useState<string | null>(null)
  const doc = (chosen === undefined ? entries.find((e) => previewing && e.attachment?.url === previewing.url) : entries.find((e) => e.id === chosen)) ?? null

  const run = async (tool: Tool) => {
    setBusy(tool.id)
    try {
      // Tài liệu đã thêm vào cuộc trò chuyện thì N7AI tự đọc ở mọi lượt; tệp chỉ có trong tin nhắn cũ thì gửi kèm lại
      const attachments = doc?.attachment && !doc.source ? [doc.attachment] : undefined
      await send({ content: requestText(tool, doc), aiMode: tool.mode, attachments })
    } finally {
      setBusy(null)
    }
  }

  return (
    <div className="min-h-0 flex-1 space-y-4 overflow-y-auto p-3">
      <section className="space-y-1.5">
        <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Nguồn</p>
        <div className="flex flex-wrap gap-1.5">
          <SourceChip active={!doc} onClick={() => setChosen(null)} label="Cả cuộc trò chuyện" />
          {entries.map((e) => (
            <SourceChip key={e.id} active={e.id === doc?.id} onClick={() => setChosen(e.id)} label={e.title} />
          ))}
        </div>
      </section>

      <section className="grid grid-cols-2 gap-2">
        {TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            disabled={!!busy}
            onClick={() => void run(tool)}
            className="flex cursor-pointer flex-col items-start gap-1 rounded-xl border bg-card p-3 text-left transition-colors hover:bg-muted/60 disabled:cursor-default disabled:opacity-60"
          >
            {busy === tool.id ? <Loader2 className="h-4 w-4 animate-spin text-primary" /> : <tool.icon className="h-4 w-4 text-primary" />}
            <span className="text-[13px] font-medium">{tool.label}</span>
            <span className="text-[11px] leading-snug text-muted-foreground">{tool.hint}</span>
          </button>
        ))}
      </section>

      <CreatedStudy threadId={threadId} />
    </div>
  )
}

function SourceChip({ active, onClick, label }: { active: boolean; onClick: () => void; label: string }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        'h-7 max-w-full cursor-pointer truncate rounded-full px-3 text-xs transition-colors',
        active ? 'bg-primary text-primary-foreground' : 'bg-card text-muted-foreground ring-1 ring-border hover:text-foreground'
      )}
    >
      {label}
    </button>
  )
}

// Quiz / flashcard đã tạo trong cuộc trò chuyện này
function CreatedStudy({ threadId }: { threadId: string }) {
  const { items, isPending } = useAiLibrary('study', threadId)
  if (isPending || !items.length) return null
  return (
    <section className="space-y-1.5">
      <p className="px-1 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">Đã tạo</p>
      <LibraryStudy items={items} />
    </section>
  )
}
