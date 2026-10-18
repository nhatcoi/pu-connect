'use client'

import React from 'react'
import { Volume2 } from 'lucide-react'
import type { FlashcardContent } from '@pu/schemas'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { cn } from '@/lib/utils'

// Mặt thẻ dùng chung (màn ôn /tools và bộ thẻ trong chat)
// Shared flashcard faces: term side (front + phonetic + speak) and meaning side (back + example)

export function SpeakButton({ onSpeak, speaking, className }: { onSpeak: () => void; speaking?: boolean; className?: string }) {
  return (
    <span
      role="button"
      tabIndex={0}
      aria-label="Phát âm (P)"
      title="Phát âm (P)"
      onClick={(e) => {
        e.stopPropagation()
        onSpeak()
      }}
      onKeyDown={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return
        e.preventDefault()
        e.stopPropagation()
        onSpeak()
      }}
      className={cn(
        'inline-flex h-8 w-8 shrink-0 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors',
        speaking && 'text-primary',
        className
      )}
    >
      <Volume2 className={cn('h-4 w-4', speaking && 'animate-pulse')} />
    </span>
  )
}

// Mặt từ / thuật ngữ: front + phiên âm (+ nút đọc)
export function TermFace({
  card,
  size = 'lg',
  speech
}: {
  card: FlashcardContent
  size?: 'lg' | 'sm'
  speech?: { onSpeak: () => void; speaking: boolean } | null
}) {
  return (
    <div className="flex flex-col items-center gap-0.5">
      <div className="flex items-center justify-center gap-1">
        <MarkdownPreview
          content={card.front}
          className={cn('leading-snug [&>p]:m-0', size === 'lg' ? 'text-lg font-semibold' : 'text-sm text-muted-foreground')}
        />
        {speech && <SpeakButton onSpeak={speech.onSpeak} speaking={speech.speaking} className={size === 'sm' ? 'h-6 w-6' : undefined} />}
      </div>
      {card.phonetic && <span className={cn('font-mono text-muted-foreground', size === 'lg' ? 'text-sm' : 'text-xs')}>{card.phonetic}</span>}
    </div>
  )
}

// Mặt nghĩa: back + ví dụ
export function MeaningFace({ card, size = 'lg' }: { card: FlashcardContent; size?: 'lg' | 'sm' }) {
  return (
    <div className="flex flex-col items-center gap-1.5 w-full">
      <MarkdownPreview content={card.back} className={cn('leading-relaxed [&>p]:m-0', size === 'lg' ? 'text-[15px]' : 'text-sm text-muted-foreground')} />
      {card.example && size === 'lg' && (
        <MarkdownPreview content={`_${card.example}_`} className="text-[13px] text-muted-foreground leading-relaxed [&>p]:m-0 max-w-prose" />
      )}
    </div>
  )
}
