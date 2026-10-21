'use client'

import React from 'react'
import { MessageSquarePlus, PenSquare } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface MessagesEmptyStateProps {
  onNewChat?: () => void
}

// Khung trống khi chưa chọn cuộc trò chuyện nào trên màn hình máy tính (chuẩn phong cách X/Twitter)
export function MessagesEmptyState({ onNewChat }: MessagesEmptyStateProps) {
  return (
    <div className="flex-1 h-full min-h-[calc(100vh-8rem)] flex flex-col items-center justify-center p-6 text-center select-none animate-in fade-in-50 duration-300">
      <div className="space-y-4 max-w-sm flex flex-col items-center">
        <div className="h-16 w-16 rounded-full bg-muted/60 flex items-center justify-center text-primary shadow-xs">
          <MessageSquarePlus className="h-8 w-8 stroke-[1.75]" />
        </div>
        <div className="space-y-1.5">
          <h2 className="text-xl font-bold tracking-tight text-foreground">Bắt đầu cuộc trò chuyện</h2>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Chọn từ các cuộc trò chuyện hiện có của bạn hoặc bắt đầu một cuộc trò chuyện mới để kết nối và trao đổi học tập.
          </p>
        </div>
        {onNewChat && (
          <Button
            onClick={onNewChat}
            className="rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-semibold px-6 shadow-sm gap-2 text-xs h-9 cursor-pointer transition-transform hover:scale-105 active:scale-95"
          >
            <PenSquare className="h-3.5 w-3.5" />
            <span>Tin nhắn mới</span>
          </Button>
        )}
      </div>
    </div>
  )
}
