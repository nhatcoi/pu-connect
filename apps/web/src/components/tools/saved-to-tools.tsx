import React from 'react'
import Link from 'next/link'
import { ArrowRight, CheckCircle2 } from 'lucide-react'
import type { ChatStudySetRef } from '@pu/schemas'
import { TOOL_META, toolHref } from './tool-catalog'

// Dưới câu trả lời N7AI: bộ flashcard / quiz đã tự lưu vào Công cụ
export function SavedToTools({ set }: { set: ChatStudySetRef }) {
  const meta = TOOL_META[set.kind]
  return (
    <Link
      href={toolHref(set.kind, set.id)}
      className="not-prose mt-1.5 flex items-center gap-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 px-2.5 py-1.5 text-xs hover:bg-emerald-500/10 transition-colors"
    >
      <CheckCircle2 className="h-3.5 w-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" />
      <span className="min-w-0 flex-1 truncate">
        Đã lưu vào <span className="font-medium">Công cụ › {meta.label}</span>
      </span>
      <span className="flex shrink-0 items-center gap-0.5 font-medium text-primary">
        {set.kind === 'flashcards' ? 'Ôn ngay' : 'Làm bài'} <ArrowRight className="h-3 w-3" />
      </span>
    </Link>
  )
}
