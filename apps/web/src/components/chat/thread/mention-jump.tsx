'use client'

import React, { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { AtSign } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { chatApi } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'

// Nút nổi "@ N": mở hội thoại có tin nhắc mình chưa đọc ⇒ bấm lần lượt nhảy tới từng tin (cũ → mới)
// Chụp mốc đã đọc lúc mở (hội thoại tự đánh dấu đã đọc ngay sau đó); đặt key = id hội thoại ở nơi dùng
export function MentionJump({ conversation, onJump }: { conversation: ConversationSummary | undefined; onJump: (messageId: string) => void }) {
  const [snapshot, setSnapshot] = useState<{ after: string; count: number } | null>(null)
  if (conversation && !snapshot) setSnapshot({ after: conversation.lastReadMessageId, count: conversation.unreadMentions })

  const enabled = !!conversation && !!snapshot && snapshot.count > 0
  const { data: ids } = useQuery({
    queryKey: queryKeys.chatMentions(conversation?.id ?? '', snapshot?.after ?? ''),
    queryFn: () => chatApi.unreadMentions(conversation!.id, snapshot!.after),
    enabled,
    staleTime: Infinity
  })
  const [pos, setPos] = useState(0)

  const remaining = ids ? ids.length - pos : 0
  if (!enabled || remaining <= 0) return null
  return (
    <button
      type="button"
      onClick={() => {
        onJump(ids![pos])
        setPos((p) => p + 1)
      }}
      className="fixed right-4 bottom-36 md:bottom-24 z-30 flex items-center gap-1 h-9 pl-2.5 pr-3 rounded-full bg-amber-400 text-amber-950 text-xs font-semibold shadow-lg hover:bg-amber-300 cursor-pointer"
      aria-label={`${remaining} tin nhắc đến bạn`}
    >
      <AtSign className="h-4 w-4" /> {remaining}
    </button>
  )
}
