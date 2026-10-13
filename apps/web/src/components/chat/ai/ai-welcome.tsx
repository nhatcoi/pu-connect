'use client'

import React from 'react'
import { Sparkles } from 'lucide-react'
import type { AiMode } from '@pu/schemas'
import { AI_MODE_META, AI_STARTERS } from './ai-modes'

// Màn hình trống của PU AI: giới thiệu + gợi ý mở đầu theo chế độ học
export function AiWelcome({ onPick }: { onPick: (mode: AiMode, text: string) => void }) {
  return (
    <div className="py-10 px-2 text-center space-y-5">
      <div className="space-y-2">
        <div className="h-12 w-12 mx-auto rounded-2xl bg-primary/10 text-primary flex items-center justify-center">
          <Sparkles className="h-6 w-6" />
        </div>
        <p className="text-[15px] font-semibold">PU AI — trợ lý học tập</p>
        <p className="text-xs text-muted-foreground max-w-sm mx-auto">
          Giải thích bài, tạo quiz & flashcard, tóm tắt tài liệu, lập lộ trình ôn thi. Gửi kèm ảnh chụp đề bài hoặc tệp .txt để PU AI đọc.
        </p>
      </div>
      <div className="grid sm:grid-cols-2 gap-2 text-left max-w-lg mx-auto">
        {AI_STARTERS.map((s) => {
          const meta = AI_MODE_META[s.mode]
          const Icon = meta.icon
          return (
            <button
              key={s.text}
              onClick={() => onPick(s.mode, s.text)}
              className="rounded-xl bg-card hover:bg-primary/5 border border-transparent hover:border-primary/20 p-3 transition-colors cursor-pointer"
            >
              <span className="flex items-center gap-1.5 text-[11px] font-semibold text-primary">
                <Icon className="h-3.5 w-3.5" /> {meta.label}
              </span>
              <span className="block mt-1 text-[13px] leading-snug">{s.text}</span>
            </button>
          )
        })}
      </div>
    </div>
  )
}
