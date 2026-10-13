'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useQuery } from '@tanstack/react-query'
import type { ChatReaction } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { N7AiMark } from '@/components/brand/pu-logo'
import { Dialog, DialogContent, DialogTitle } from '@/components/ui/dialog'
import { chatApi } from '@/hooks/chat'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'

interface Props {
  messageId: string
  reactions: ChatReaction[]
  myId?: string
  open: boolean
  onOpenChange: (open: boolean) => void
  onToggle: (emoji: string) => void // gỡ cảm xúc của mình
}

// Hộp thoại "Cảm xúc về tin nhắn": tab Tất cả / từng emoji, danh sách người thả
export function ReactionsDialog({ messageId, reactions, myId, open, onOpenChange, onToggle }: Props) {
  const [tab, setTab] = useState<string>('all')
  // Chữ ký theo số lượng ⇒ tự tải lại khi có người thả/gỡ (socket cập nhật reactions)
  const sig = reactions.map((r) => `${r.emoji}${r.userIds.length}`).join('|')
  const { data = [], isPending } = useQuery({
    queryKey: queryKeys.chatReactions(messageId, sig),
    queryFn: () => chatApi.reactions(messageId),
    enabled: open
  })
  const total = reactions.reduce((n, r) => n + r.userIds.length, 0)
  // Emoji đang chọn bị gỡ hết ⇒ quay về "Tất cả"
  const active = tab === 'all' || reactions.some((r) => r.emoji === tab) ? tab : 'all'
  const rows = active === 'all' ? data : data.filter((d) => d.emoji === active)

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-sm p-0 gap-0">
        <DialogTitle className="px-4 pt-4 pb-2 text-sm font-semibold">Cảm xúc về tin nhắn</DialogTitle>
        <div className="flex gap-1 px-3 pb-2 overflow-x-auto">
          {[{ key: 'all', label: `Tất cả ${total}` }, ...reactions.map((r) => ({ key: r.emoji, label: `${r.emoji} ${r.userIds.length}` }))].map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={cn(
                'h-7 px-3 rounded-full text-xs font-medium shrink-0 cursor-pointer transition-colors',
                active === t.key ? 'bg-primary/10 text-primary' : 'text-muted-foreground hover:bg-muted'
              )}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="border-t border-border/60 max-h-[60vh] overflow-y-auto py-1">
          {isPending ? (
            <UserListSkeleton count={3} avatarClassName="h-9 w-9" className="px-2" label="Đang tải cảm xúc" />
          ) : (
            rows.map((d) => {
              const mine = d.user.id === myId
              return (
                <div key={`${d.user.id}-${d.emoji}`} className="flex items-center gap-3 px-4 py-2">
                  {d.user.isBot ? (
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
                      <N7AiMark className="h-[70%] w-[70%]" />
                    </span>
                  ) : (
                    <Avatar className="h-9 w-9">
                      <AvatarImage src={d.user.avatarUrl || ''} />
                      <AvatarFallback className="text-[10px] font-bold">{d.user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                    </Avatar>
                  )}
                  <div className="min-w-0 flex-1">
                    {d.user.isBot ? (
                      <p className="text-sm font-medium truncate">{d.user.displayName}</p>
                    ) : (
                      <Link href={`/${d.user.username}`} className="block text-sm font-medium truncate hover:underline">
                        {mine ? 'Bạn' : d.user.displayName}
                      </Link>
                    )}
                    {mine && (
                      <button onClick={() => onToggle(d.emoji)} className="text-[11px] text-muted-foreground hover:text-destructive cursor-pointer">
                        Bấm để gỡ
                      </button>
                    )}
                  </div>
                  <span className="text-xl leading-none">{d.emoji}</span>
                </div>
              )
            })
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}
