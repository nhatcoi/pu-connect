'use client'

import React, { useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { useConversation } from '@/hooks/chat'
import { puaiThreadHref } from '@/lib/puai-routes'

// /messages/[id]: DM & nhóm; thread PU AI (link / thông báo cũ) ⇒ chuyển sang không gian /puai
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const router = useRouter()
  const { data: conv } = useConversation(id)
  const isAi = conv?.type === 'ai'
  useEffect(() => {
    if (isAi) router.replace(puaiThreadHref(id))
  }, [isAi, id, router])

  if (isAi) return null
  return <ConversationView id={id} backHref="/messages" />
}
