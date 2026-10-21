'use client'

import { Users } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'
import { N7AiMark } from '@/components/brand/pu-logo'
import { PresenceDot } from './presence-dot'

const initials = (name?: string) => (name || '?').slice(0, 2).toUpperCase()

// Avatar hội thoại: N7AI = logo N7AI, nhóm = ảnh nhóm hoặc 2 avatar chồng nhau, DM = avatar người kia (+ chấm hoạt động)
export function ConversationAvatar({ conversation, className }: { conversation: ConversationSummary; className?: string }) {
  if (conversation.type === 'ai') {
    return (
      <div className={cn('h-10 w-10 rounded-full bg-muted flex items-center justify-center shrink-0', className)}>
        <N7AiMark className="h-[68%] w-[68%]" />
      </div>
    )
  }
  if (conversation.type === 'group') {
    const [a, b] = conversation.members
    if (conversation.avatarUrl || !a || !b) {
      return (
        <Avatar className={cn('h-10 w-10 shrink-0', className)}>
          <AvatarImage src={conversation.avatarUrl || ''} />
          <AvatarFallback className="bg-muted text-muted-foreground">
            <Users className="h-1/2 w-1/2" />
          </AvatarFallback>
        </Avatar>
      )
    }
    return (
      <div className={cn('relative h-10 w-10 shrink-0', className)}>
        <Avatar className="absolute top-0 right-0 h-[68%] w-[68%] ring-2 ring-card">
          <AvatarImage src={b.avatarUrl || ''} />
          <AvatarFallback className="text-[9px] font-bold">{initials(b.displayName)}</AvatarFallback>
        </Avatar>
        <Avatar className="absolute bottom-0 left-0 h-[68%] w-[68%] ring-2 ring-card">
          <AvatarImage src={a.avatarUrl || ''} />
          <AvatarFallback className="text-[9px] font-bold">{initials(a.displayName)}</AvatarFallback>
        </Avatar>
      </div>
    )
  }
  const other = conversation.members[0]
  return (
    <div className={cn('relative h-10 w-10 shrink-0', className)}>
      <Avatar className="h-full w-full">
        <AvatarImage src={other?.avatarUrl || ''} />
        <AvatarFallback className="bg-primary/10 text-primary text-xs font-bold">{initials(other?.displayName)}</AvatarFallback>
      </Avatar>
      {conversation.blockState === 'none' && <PresenceDot userId={other?.id} />}
    </div>
  )
}
