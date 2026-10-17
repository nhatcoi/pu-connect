'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { useConversation } from '@/hooks/chat'
import { puaiThreadHref } from '@/lib/puai-routes'

// /messages/[id]: DM, nhóm & PU AI chat nhanh (thread AI có nút mở ở không gian /puai)
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const { data: conv } = useConversation(id)
  return <ConversationView id={id} backHref="/messages" spaceHref={conv?.type === 'ai' ? puaiThreadHref(id) : undefined} />
}
