'use client'

import React, { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { N7AiMark } from '@/components/brand/pu-logo'
import { chatApi, refreshConversationLists } from '@/hooks/chat'

// Dòng PU AI ở đầu Tin nhắn khi chưa có thread nào ⇒ mở (tạo) thread chat nhanh
export function AiQuickRow() {
  const router = useRouter()
  const qc = useQueryClient()
  const [opening, setOpening] = useState(false)

  const open = async () => {
    setOpening(true)
    try {
      const conv = await chatApi.openAi()
      refreshConversationLists(qc)
      router.push(`/messages/${conv.id}`)
    } catch (err) {
      toast.error((err as Error)?.message || 'Không mở được PU AI')
      setOpening(false)
    }
  }

  return (
    <button onClick={open} disabled={opening} className="w-full flex items-center gap-3 px-4 py-3 text-left hover:bg-muted/40 transition-colors cursor-pointer">
      <div className="h-11 w-11 rounded-full bg-muted flex items-center justify-center shrink-0">
        {opening ? <Loader2 className="h-5 w-5 animate-spin text-primary" /> : <N7AiMark className="h-[68%] w-[68%]" />}
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-sm font-medium">PU AI</p>
        <p className="text-xs text-muted-foreground truncate">Giải thích, quiz, flashcard, lộ trình ôn…</p>
      </div>
    </button>
  )
}
