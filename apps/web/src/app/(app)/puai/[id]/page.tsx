'use client'

import React from 'react'
import { useParams, useSearchParams } from 'next/navigation'
import { ConversationView } from '@/components/chat/conversation-view'
import { usePuaiNav } from '@/components/puai/puai-nav'
import { PUAI_HOME } from '@/lib/puai-routes'

// /puai/[id]: 1 thread PU AI; ?m=<id tin> ⇒ cuộn tới tin (mở từ Thư viện)
export default function PuaiThreadPage() {
  const { id } = useParams<{ id: string }>()
  const jump = useSearchParams().get('m')
  const { openNav } = usePuaiNav()
  return <ConversationView key={id} id={id} backHref={PUAI_HOME} initialJump={jump} onOpenNav={openNav} />
}
