'use client'

import { Sparkles, Users } from 'lucide-react'
import type { ConversationSummary } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { cn } from '@/lib/utils'

// Avatar hội thoại: PU AI ✨, nhóm 👥, DM = avatar người kia
export function ConversationAvatar({ conversation, className }: { conversation: ConversationSummary; className?: string }) {
  if (conversation.type === 'ai') {
    return (
      <div className={cn('h-10 w-10 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0', className)}>
        <Sparkles className="h-5 w-5" />
      </div>
    )
  }
  if (conversation.type === 'group') {
    return (
      <div className={cn('h-10 w-10 rounded-full bg-muted text-muted-foreground flex items-center justify-center shrink-0', className)}>
        <Users className="h-5 w-5" />
      </div>
    )
  }
  const other = conversation.members[0]
  return (
    <Avatar className={cn('h-10 w-10 shrink-0', className)}>
      <AvatarImage src={other?.avatarUrl || ''} />
      <AvatarFallback className="text-xs font-bold">{(other?.displayName || '?').slice(0, 2).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}
