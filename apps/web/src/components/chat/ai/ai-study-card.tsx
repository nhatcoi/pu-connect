'use client'

import React from 'react'
import { Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { N7AiMark } from '@/components/brand/pu-logo'
import { useAiQuota } from '@/hooks/chat'
import { AI_MODE_META, AI_MODE_ORDER } from './ai-modes'

// Thẻ giới thiệu PU AI học tập (cột phải trang /messages)
export function AiStudyCard({ onOpen, opening }: { onOpen: () => void; opening: boolean }) {
  const { data: quota } = useAiQuota()
  return (
    <div className="rounded-2xl bg-card p-4 space-y-3">
      <div className="flex items-center gap-2.5">
        <N7AiMark className="h-9 w-9" />
        <div>
          <p className="text-sm font-semibold">Học cùng PU AI</p>
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
        Trong nhóm chat, gõ <span className="font-semibold text-foreground">@puai</span> để cả nhóm cùng hỏi.
      </p>
      <Button size="sm" className="w-full rounded-full" onClick={onOpen} disabled={opening}>
        {opening ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Mở PU AI'}
      </Button>
    </div>
  )
}
