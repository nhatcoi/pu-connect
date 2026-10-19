'use client'

import React, { useState } from 'react'
import { ChevronLeft, ChevronRight, Shuffle } from 'lucide-react'
import { useSpeech } from '@/components/tools/card-speech'
import { clozePlain, isClozeCard } from '@/components/tools/card-cloze'
import { CardImage, MeaningFace, TermFace } from '@/components/tools/flashcard-face'
import { hasSpeech } from '@/components/tools/tool-catalog'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'
import type { FlashcardData } from './study-blocks'

// Bộ thẻ ghi nhớ trong chat: chạm để lật, trước/sau, xáo trộn, phát âm (bộ từ vựng); đánh dấu thẻ đã thuộc
export function FlashcardDeck({ data }: { data: FlashcardData }) {
  const [order, setOrder] = useState(() => data.cards.map((_, i) => i))
  const [pos, setPos] = useState(0)
  const [flipped, setFlipped] = useState(false)
  const [known, setKnown] = useState<Set<number>>(new Set())
  const card = data.cards[order[pos]]
  const { supported, speaking, speak } = useSpeech()
  const cloze = isClozeCard(card)
  const speech = supported && hasSpeech(data) ? { onSpeak: () => speak(cloze ? clozePlain(card.front) : card.front, data.lang), speaking } : null

  const go = (next: number) => {
    setFlipped(false)
    setPos((next + order.length) % order.length)
  }
  const shuffle = () => {
    setOrder((o) => [...o].sort(() => Math.random() - 0.5))
    setPos(0)
    setFlipped(false)
  }
  const toggleKnown = () =>
    setKnown((s) => {
      const n = new Set(s)
      if (n.has(order[pos])) n.delete(order[pos])
      else n.add(order[pos])
      return n
    })

  return (
    <div className="not-prose my-2 rounded-xl border bg-background/60 overflow-hidden">
      <div className="flex items-center justify-between gap-2 px-3.5 py-2.5 border-b bg-primary/5">
        <p className="text-xs font-semibold text-primary truncate">🗂️ {data.title || 'Flashcard'}</p>
        <span className="text-[11px] text-muted-foreground shrink-0">
          Đã thuộc {known.size}/{data.cards.length}
        </span>
      </div>
      <div className="p-3.5">
        <button
          onClick={() => setFlipped((f) => !f)}
          className={cn(
            'w-full min-h-32 rounded-xl border-2 border-dashed px-4 py-5 flex flex-col items-center justify-center text-center gap-1.5 transition-colors cursor-pointer',
            flipped ? 'border-primary/40 bg-primary/5' : 'hover:border-primary/30'
          )}
        >
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{flipped ? 'Mặt sau' : 'Mặt trước'} · chạm để lật</span>
          {card.image && <CardImage src={card.image} size="sm" />}
          {cloze ? (
            // Điền chỗ trống: lật ⇒ hiện đáp án + ghi chú
            <>
              <TermFace card={card} reveal={flipped} speech={speech} />
              {flipped && (card.back || card.example) && <MeaningFace card={card} />}
            </>
          ) : flipped ? (
            <MeaningFace card={card} />
          ) : (
            <TermFace card={card} speech={speech} />
          )}
        </button>
        <div className="mt-2.5 flex items-center justify-between gap-2">
          <div className="flex items-center gap-1">
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => go(pos - 1)} aria-label="Thẻ trước">
              <ChevronLeft className="h-4 w-4" />
            </Button>
            <span className="text-xs text-muted-foreground tabular-nums w-12 text-center">
              {pos + 1}/{order.length}
            </span>
            <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => go(pos + 1)} aria-label="Thẻ sau">
              <ChevronRight className="h-4 w-4" />
            </Button>
          </div>
          <div className="flex items-center gap-1">
            <Button size="sm" variant="ghost" className="h-7 text-xs gap-1" onClick={shuffle}>
              <Shuffle className="h-3 w-3" /> Xáo
            </Button>
            <Button size="sm" variant={known.has(order[pos]) ? 'default' : 'outline'} className="h-7 text-xs" onClick={toggleKnown}>
              {known.has(order[pos]) ? 'Đã thuộc ✓' : 'Đánh dấu thuộc'}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
