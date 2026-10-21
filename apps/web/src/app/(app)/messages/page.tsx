'use client'

import React, { useContext } from 'react'
import { MessagesEmptyState } from '@/components/chat/messages-empty-state'
import { MessagesContext } from './layout'

// Trang Tin nhắn chính (/messages): hiển thị Empty State chuẩn X ở cột phải trên desktop
export default function MessagesPage() {
  const { openNewChat } = useContext(MessagesContext)
  return <MessagesEmptyState onNewChat={openNewChat} />
}
