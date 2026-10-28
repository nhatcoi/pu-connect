'use client'

import React, { useRef } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DocumentCard } from './document-card'
import type { ComponentProps } from 'react'

type Doc = ComponentProps<typeof DocumentCard>['document']

// Một kệ cuộn ngang: tiêu đề + mô tả ngắn, nút "Xem tất cả" và mũi tên cuộn (ẩn trên mobile, vuốt tay)
export function DocumentShelf({ title, hint, items, onSeeAll }: { title: string; hint?: string; items: Doc[]; onSeeAll?: () => void }) {
  const scroller = useRef<HTMLDivElement>(null)
  const scroll = (dir: 1 | -1) => scroller.current?.scrollBy({ left: dir * (scroller.current.clientWidth - 80), behavior: 'smooth' })
  if (items.length === 0) return null

  return (
    <section className="space-y-2">
      <div className="flex items-end justify-between gap-3 px-2 sm:px-0">
        <div className="min-w-0">
          <h2 className="text-[15px] font-bold tracking-tight">{title}</h2>
          {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {onSeeAll && (
            <button type="button" onClick={onSeeAll} className="mr-1 text-xs font-semibold text-primary hover:underline cursor-pointer">
              Xem tất cả
            </button>
          )}
          <button type="button" aria-label="Cuộn trái" onClick={() => scroll(-1)} className="hidden h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground sm:flex cursor-pointer">
            <ChevronLeft className="h-4 w-4" />
          </button>
          <button type="button" aria-label="Cuộn phải" onClick={() => scroll(1)} className="hidden h-7 w-7 items-center justify-center rounded-full border border-border text-muted-foreground hover:text-foreground sm:flex cursor-pointer">
            <ChevronRight className="h-4 w-4" />
          </button>
        </div>
      </div>
      <div ref={scroller} className="flex snap-x gap-3 overflow-x-auto px-2 pb-2 sm:px-0 [scrollbar-width:none]">
        {items.map((doc) => (
          <DocumentCard key={doc.id} document={doc} className="w-[220px] shrink-0 snap-start" />
        ))}
      </div>
    </section>
  )
}
