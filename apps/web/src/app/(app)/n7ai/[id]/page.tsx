'use client'

import React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { useN7AiNav } from '@/components/n7ai/n7ai-nav'
import { N7AI_HOME } from '@/lib/n7ai-routes'

// /n7ai/[id]: 1 thread N7AI; ?m=<id tin> ⇒ cuộn tới tin (mở từ Thư viện)
export default function N7AiThreadPage() {
  const { id } = useParams<{ id: string }>()
  const jump = useSearchParams().get('m')
  const { openNav } = useN7AiNav()
  return <ConversationView key={id} id={id} backHref={N7AI_HOME} initialJump={jump} onOpenNav={openNav} />
}
