'use client'

import React from 'react'
import { N7AiMark } from '@/components/brand/pu-logo'
import type { AiMode, AiSuggestion } from '@pu/schemas'
import { Skeleton } from '@/components/ui/skeleton'
import { useAiSuggestions } from '@/hooks/chat'
import { AI_MODE_META } from './ai-modes'
import { OpenInN7AiCard } from './open-in-n7ai'

// Màn hình trống của N7AI: giới thiệu + gợi ý mở đầu theo chế độ đang chọn (cá nhân hóa từ server)
export function AiWelcome({ mode, onPick }: { mode: AiMode; onPick: (s: AiSuggestion) => void }) {
  const { data, isPending } = useAiSuggestions(mode)

  return (
    <div className="py-10 px-2 text-center space-y-5">
      <div className="space-y-2">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 flex items-center justify-center">
          <N7AiMark className="h-7 w-7" />
        </div>
        <p className="text-[15px] font-semibold">N7AI — trợ lý học tập</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Giải thích bài, tạo quiz & flashcard, tóm tắt tài liệu, lập lộ trình ôn thi. Gửi kèm ảnh chụp đề bài, tệp PDF, Word hoặc .txt để N7AI đọc — hỏi tiếp
          không cần gửi lại.
        </p>
      </div>
      <div className="max-w-lg mx-auto text-left space-y-2">
        <p className="text-[11px] font-semibold text-muted-foreground px-1">{data?.personalized ? 'Gợi ý cho bạn' : 'Thử hỏi'}</p>
        <div className="grid sm:grid-cols-2 gap-2">
          {isPending
            ? Array.from({ length: 4 }, (_, i) => <Skeleton key={i} className="h-[68px] rounded-xl" />)
            : data?.items.map((s) => <StarterCard key={s.text} suggestion={s} onPick={onPick} />)}
        </div>
      </div>
      <OpenInN7AiCard />
    </div>
  )
}

function StarterCard({ suggestion, onPick }: { suggestion: AiSuggestion; onPick: (s: AiSuggestion) => void }) {
  const meta = AI_MODE_META[suggestion.mode]
  const Icon = meta.icon
  return (
    <button
      onClick={() => onPick(suggestion)}
      className="min-h-[68px] rounded-xl bg-card hover:bg-primary/5 border border-transparent hover:border-primary/20 p-3 text-left transition-colors cursor-pointer"
    >
      <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
        <Icon className="h-3.5 w-3.5" /> {meta.label}
      </span>
      <span className="block mt-1 text-[13px] leading-snug line-clamp-2">{suggestion.text}</span>
    </button>
  )
}
