'use client'

import React, { useCallback } from 'react'
import { useRouter } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { usePuaiNav } from '@/components/puai/puai-nav'
import { MessageThreadSkeleton } from '@/components/skeletons/chat-skeleton'
import { useAiDraftThread } from '@/hooks/chat'
import { puaiThreadHref } from '@/lib/puai-routes'

// /puai: chat mới — thread rỗng, gửi tin đầu ⇒ đổi URL sang /puai/[id]
export default function PuaiHomePage() {
  const router = useRouter()
  const { openNav } = usePuaiNav()
  const { data: draft, isError, refetch } = useAiDraftThread()
  const draftId = draft?.id
  const onStarted = useCallback(() => {
    if (draftId) router.replace(puaiThreadHref(draftId))
  }, [draftId, router])

  if (isError) {
    return (
      <div className="py-24 text-center space-y-3 text-sm text-muted-foreground">
        <p>Không mở được PU AI.</p>
        <button onClick={() => void refetch()} className="font-medium text-primary hover:underline cursor-pointer">
          Thử lại
        </button>
      </div>
    )
  }
  if (!draftId) return <MessageThreadSkeleton />
  return <ConversationView id={draftId} backHref="/" onOpenNav={openNav} onStarted={onStarted} />
}
