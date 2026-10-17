'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Brain, ThumbsDown, ThumbsUp } from 'lucide-react'
import { toast } from 'sonner'
import { AI_FEEDBACK_REASONS, type AiFeedbackInput, type ChatMessageMeta } from '@pu/schemas'
import { chatApi } from '@/hooks/chat'
import { errorMessage } from '@/lib/api-client'
import { n7aiSettingsHref } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'

const REASON_LABEL: Record<(typeof AI_FEEDBACK_REASONS)[number], string> = {
  wrong: 'Sai kiến thức',
  unhelpful: 'Không hữu ích',
  unsafe: 'Không phù hợp',
  too_long: 'Quá dài',
  other: 'Khác'
}

// Dưới câu trả lời N7AI: 👍/👎 (👎 ⇒ chọn lý do) + nhãn "Đã cập nhật bộ nhớ"
export function AiMessageFooter({ messageId, meta }: { messageId: string; meta: ChatMessageMeta | null }) {
  const [rating, setRating] = useState<1 | -1 | null>(meta?.feedback ?? null)
  const [askReason, setAskReason] = useState(false)

  const send = async (body: AiFeedbackInput) => {
    const prev = rating
    setRating(body.rating)
    try {
      await chatApi.rateMessage(messageId, body)
    } catch (err) {
      setRating(prev)
      toast.error(errorMessage(err, 'Không gửi được đánh giá'))
    }
  }

  const btn = 'rounded-full p-1 text-muted-foreground hover:bg-muted hover:text-foreground cursor-pointer'
  return (
    <div className="mt-0.5 flex flex-wrap items-center gap-1 px-1">
      <button
        type="button"
        className={cn(btn, rating === 1 && 'text-primary')}
        aria-label="Câu trả lời hữu ích"
        aria-pressed={rating === 1}
        onClick={() => send({ rating: 1 })}
      >
        <ThumbsUp className="h-3.5 w-3.5" />
      </button>
      <button
        type="button"
        className={cn(btn, rating === -1 && 'text-destructive')}
        aria-label="Câu trả lời chưa tốt"
        aria-pressed={rating === -1}
        onClick={() => setAskReason((v) => !v)}
      >
        <ThumbsDown className="h-3.5 w-3.5" />
      </button>
      {askReason &&
        AI_FEEDBACK_REASONS.map((r) => (
          <button
            key={r}
            type="button"
            onClick={() => {
              setAskReason(false)
              void send({ rating: -1, reason: r })
            }}
            className="h-6 rounded-full bg-muted px-2 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
          >
            {REASON_LABEL[r]}
          </button>
        ))}
      {meta?.memoryUpdated?.length ? (
        <Link
          href={n7aiSettingsHref('memory')}
          title={meta.memoryUpdated.join(' · ')}
          className="ml-1 inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 h-6 text-[11px] font-medium text-primary"
        >
          <Brain className="h-3 w-3" /> Đã cập nhật bộ nhớ
        </Link>
      ) : null}
    </div>
  )
}
