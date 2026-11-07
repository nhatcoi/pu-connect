'use client'

import React from 'react'
import { useParams } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { useConversation } from '@/hooks/chat'

// /messages/[id]: DM, nhóm & N7AI chat nhanh (N7AI = chat nhanh: thread riêng, giao diện gọn, không hiện trong lịch sử /n7ai)
export default function ConversationPage() {
  const { id } = useParams<{ id: string }>()
  const { data: conv } = useConversation(id)
  return <ConversationView id={id} backHref="/messages" quick={conv?.type === 'ai'} />
}
