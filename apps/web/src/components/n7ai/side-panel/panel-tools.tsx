'use client'

import React, { useState } from 'react'
import { Loader2, MessagesSquare } from 'lucide-react'
import { LibraryStudy } from '@/components/n7ai/library/library-items'
import { useFilePreview } from '@/components/viewer/file-preview-panel'
import { useAiLibrary } from '@/hooks/chat'
import { cn } from '@/lib/utils'
import { useDocEntries } from './panel-docs'
import { STUDY_TOOLS, useStudyTool } from './study-tools'

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
  const { entries } = useDocEntries(threadId)
  const { busy, run } = useStudyTool(threadId)
  const previewing = useFilePreview((s) => s.file)
  // undefined = chưa chọn ⇒ theo tệp đang xem trong tab Tài liệu; null = cả cuộc trò chuyện
  const [chosen, setChosen] = useState<string | null | undefined>(undefined)
  const doc = (chosen === undefined ? entries.find((e) => previewing && e.attachment?.url === previewing.url) : entries.find((e) => e.id === chosen)) ?? null

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
        {STUDY_TOOLS.map((tool) => (
          <button
            key={tool.id}
            type="button"
            disabled={!!busy}
            onClick={() => void run(tool, doc)}
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
