'use client'

import React from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { N7AiMark } from '@/components/brand/pu-logo'
import { useAiQuota } from '@/hooks/chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { AI_MODE_META, AI_MODE_ORDER } from './ai-modes'

// Thẻ giới thiệu N7AI học tập (cột phải trang /messages) ⇒ không gian /n7ai
export function AiStudyCard() {
  const { data: quota } = useAiQuota()
  return (
    <div className="rounded-2xl bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <N7AiMark className="h-9 w-9" />
        <div>
          <p className="text-sm font-semibold">Học cùng N7AI</p>
          {quota && (
            <p className="text-[11px] text-muted-foreground">
              Còn {Math.max(0, quota.limit - quota.used)}/{quota.limit} lượt hôm nay
            </p>
          )}
        </div>
      </div>
      <ul className="space-y-1.5">
        {AI_MODE_ORDER.filter((m) => m !== 'ask').map((m) => {
          const meta = AI_MODE_META[m]
          const Icon = meta.icon
          return (
            <li key={m} className="flex items-center gap-2 text-xs">
              <Icon className="h-3.5 w-3.5 text-primary shrink-0" />
              <span className="font-medium">{meta.label}</span>
              <span className="text-muted-foreground truncate">· {meta.hint}</span>
            </li>
          )
        })}
      </ul>
      <p className="text-[11px] text-muted-foreground">
        Trong nhóm chat, gõ <span className="font-semibold text-foreground">@n7ai</span> để cả nhóm cùng hỏi.
      </p>
      <Button asChild size="sm" className="w-full rounded-full">
        <Link href={N7AI_HOME}>Mở N7AI</Link>
      </Button>
    </div>
  )
}
