'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { useConversation } from '@/hooks/chat'
import { n7aiThreadHref } from '@/lib/n7ai-routes'

// /messages/[id]: DM, nhóm & N7AI chat nhanh (thread AI có nút mở ở không gian /n7ai)
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const { data: conv } = useConversation(id)
  return <ConversationView id={id} backHref="/messages" spaceHref={conv?.type === 'ai' ? n7aiThreadHref(id) : undefined} />
}
