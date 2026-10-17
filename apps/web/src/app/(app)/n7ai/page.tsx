'use client'

import React, { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { useN7AiNav } from '@/components/n7ai/n7ai-nav'
import { MessageThreadSkeleton } from '@/components/skeletons/chat-skeleton'
import { useAiDraftThread } from '@/hooks/chat'
import { n7aiThreadHref } from '@/lib/n7ai-routes'

// /n7ai: chat mới — thread rỗng, gửi tin đầu ⇒ đổi URL sang /n7ai/[id]
export default function N7AiHomePage() {
  const router = useRouter()
  const { openNav } = useN7AiNav()
  const { data: draft, isError, refetch } = useAiDraftThread()
  const draftId = draft?.id
  const onStarted = useCallback(() => {
    if (draftId) router.replace(n7aiThreadHref(draftId))
  }, [draftId, router])

  if (isError) {
    return (
      <div className="py-24 text-center space-y-3 text-sm text-muted-foreground">
        <p>Không mở được N7AI.</p>
        <button onClick={() => void refetch()} className="font-medium text-primary hover:underline cursor-pointer">
          Thử lại
        </button>
      </div>
    )
  }
  if (!draftId) return <MessageThreadSkeleton />
  return <ConversationView id={draftId} backHref="/" onOpenNav={openNav} onStarted={onStarted} />
}
