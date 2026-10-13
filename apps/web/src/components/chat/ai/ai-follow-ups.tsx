'use client'

import React from 'react'
import { CornerDownRight } from 'lucide-react'

// Câu hỏi gợi ý tiếp theo dưới câu trả lời mới nhất của PU AI (bấm ⇒ gửi ngay)
export function AiFollowUps({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <div className="mt-2 ml-10 flex flex-col items-start gap-1.5" aria-label="Hỏi tiếp">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="flex items-center gap-1.5 max-w-full rounded-full border border-border bg-card px-3 py-1.5 text-left text-xs hover:bg-muted hover:border-primary/30 transition-colors cursor-pointer"
        >
          <CornerDownRight className="h-3.5 w-3.5 shrink-0 text-primary" />
          <span className="truncate">{text}</span>
        </button>
      ))}
    </div>
  )
}
