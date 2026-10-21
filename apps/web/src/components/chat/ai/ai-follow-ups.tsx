'use client'

import React from 'react'
import { CornerDownRight } from 'lucide-react'

// Câu hỏi gợi ý tiếp theo dưới câu trả lời mới nhất của N7AI (dạng pills nằm ngang giống index.html, bấm ⇒ gửi ngay)
export function AiFollowUps({ items, onPick }: { items: string[]; onPick: (text: string) => void }) {
  return (
    <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Gợi ý câu hỏi tiếp theo">
      {items.map((text) => (
        <button
          key={text}
          type="button"
          onClick={() => onPick(text)}
          className="flex items-center gap-1.5 max-w-full rounded-full border border-border/80 bg-card px-3 py-1.5 text-left text-xs text-muted-foreground hover:text-foreground hover:border-primary/40 hover:bg-muted/70 transition-colors cursor-pointer"
        >
          <CornerDownRight className="h-3 w-3 shrink-0 text-primary" />
          <span className="truncate">{text}</span>
        </button>
      ))}
    </div>
  )
}
