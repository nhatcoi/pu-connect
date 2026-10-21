'use client'

import React, { createContext, useState } from 'react'
import { useParams, usePathname } from 'next/navigation'
import { ConversationListPane } from '@/components/chat/conversation-list-pane'
import { NewChatPanel } from '@/components/chat/new-chat-panel'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { cn } from '@/lib/utils'

export const MessagesContext = createContext<{
  openNewChat: () => void
}>({
  openNewChat: () => {}
})

// Layout 2 cột chuẩn phong cách X (Twitter) cho toàn bộ không gian Tin nhắn (/messages)
export default function MessagesLayout({ children }: { children: React.ReactNode }) {
  const pathname = usePathname()
  const params = useParams<{ id?: string }>()
  const [newChatOpen, setNewChatOpen] = useState(false)

  // Kiểm tra đang mở 1 hội thoại cụ thể (/messages/[id]) hay đang ở trang chính (/messages)
  const isConversationOpen = !!params?.id && pathname.startsWith('/messages/')

  return (
    <MessagesContext.Provider value={{ openNewChat: () => setNewChatOpen(true) }}>
      <div className="w-full flex min-h-[calc(100vh-4rem)] md:min-h-[calc(100vh-4.5rem)] rounded-2xl bg-card/40 border border-border/60 overflow-hidden shadow-xs">
        {/* 1. Cột trái: Danh sách hội thoại (full màn hình trên mobile khi chưa chọn chat, cố định 360px-390px trên desktop) */}
        <div
          className={cn(
            'w-full md:w-[360px] lg:w-[390px] shrink-0 border-r border-border/50 flex flex-col md:sticky md:top-14 md:h-[calc(100vh-3.5rem)] bg-surface/50 transition-all',
            isConversationOpen && 'hidden md:flex'
          )}
        >
          <ConversationListPane
            activeId={params?.id}
            onCompose={() => setNewChatOpen(true)}
          />
        </div>

        {/* 2. Cột phải: Chi tiết hội thoại hoặc Empty State chuẩn X */}
        <div
          className={cn(
            'flex-1 min-w-0 flex flex-col min-h-[calc(100vh-3.5rem)] bg-surface/20 transition-all',
            !isConversationOpen && 'hidden md:flex'
          )}
        >
          {children}
        </div>
      </div>

      {/* Modal soạn tin nhắn mới: gọi được từ cả danh sách và Empty State */}
      <Dialog open={newChatOpen} onOpenChange={setNewChatOpen}>
        <DialogContent className="max-w-md p-0 overflow-hidden rounded-2xl border border-border bg-card shadow-2xl">
          <DialogTitle className="sr-only">Tạo cuộc trò chuyện mới</DialogTitle>
          <NewChatPanel onClose={() => setNewChatOpen(false)} />
        </DialogContent>
      </Dialog>
    </MessagesContext.Provider>
  )
}
