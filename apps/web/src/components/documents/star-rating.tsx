'use client'

import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { cn } from '@/lib/utils'

// Số sao trung bình gọn (thẻ tài liệu): ★ 4.5 (12). Chưa có lượt nào ⇒ không hiện
export function RatingBadge({ avg, count, className }: { avg: number; count: number; className?: string }) {
  if (!count) return null
  return (
    <span className={cn('inline-flex items-center gap-0.5 font-medium text-foreground', className)} title={`${avg.toFixed(1)} sao từ ${count} lượt đánh giá`}>
      <Star className="h-3 w-3 fill-current text-amber-500" /> {avg.toFixed(1)}
      <span className="font-normal text-muted-foreground">({count})</span>
    </span>
  )
}

// 5 sao bấm được: bấm lại đúng số sao đang chọn ⇒ bỏ chấm. readOnly = chỉ xem
export function StarInput({ value, onChange, disabled }: { value: number | null; onChange: (next: number | null) => void; disabled?: boolean }) {
  const [hover, setHover] = useState<number | null>(null)
  const shown = hover ?? value ?? 0
  return (
    <div className="inline-flex items-center gap-0.5" onMouseLeave={() => setHover(null)}>
      {[1, 2, 3, 4, 5].map((n) => (
        <button
          key={n}
          type="button"
          disabled={disabled}
          aria-label={`${n} sao`}
          aria-pressed={value === n}
          onMouseEnter={() => setHover(n)}
          onClick={() => onChange(value === n ? null : n)}
          className="rounded p-0.5 transition-transform hover:scale-110 disabled:opacity-50 cursor-pointer"
        >
          <Star className={cn('h-5 w-5', n <= shown ? 'fill-amber-500 text-amber-500' : 'text-muted-foreground/50')} />
        </button>
      ))}
    </div>
  )
}
