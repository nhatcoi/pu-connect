'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { Crown, Loader2, UserPlus } from 'lucide-react'
import type { ConversationSummary, UserSummary } from '@pu/schemas'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { PresenceDot } from '../presence-dot'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { useConversationActions, useMembers } from '@/hooks/chat'
import { useAppStore } from '@/store'
import { UserPicker } from '../user-picker'
import { MemberActions } from './member-actions'
import { UserListSkeleton } from '@/components/skeletons/user-row-skeleton'

// Thành viên nhóm: thêm người (mọi thành viên); chuyển quyền, xóa người (trưởng nhóm)
export function MemberList({ conversation }: { conversation: ConversationSummary }) {
  const myId = useAppStore((s) => s.user?.id)
  const { data: members = [], isPending } = useMembers(conversation.id)
  const { addMembers } = useConversationActions(conversation.id)
  const [adding, setAdding] = useState(false)
  const [picked, setPicked] = useState<UserSummary[]>([])
  const isOwner = conversation.myRole === 'owner'

  const submitAdd = () =>
    addMembers.mutate(
      picked.map((u) => u.id),
      {
        onSuccess: () => {
          setAdding(false)
          setPicked([])
        }
      }
    )

  return (
    <div className="space-y-1">
      <button
        onClick={() => setAdding(true)}
        className="w-full flex items-center gap-2.5 px-2 py-2 rounded-lg text-sm font-medium text-primary hover:bg-primary/5 cursor-pointer"
      >
        <span className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center">
          <UserPlus className="h-4 w-4" />
        </span>
        Thêm thành viên
      </button>
      {isPending ? (
        <UserListSkeleton count={4} label="Đang tải thành viên" />
      ) : (
        members.map((m) => (
          <div key={m.id} className="group flex items-center gap-2.5 px-2 py-1.5 rounded-lg hover:bg-muted/50">
            <Link href={`/${m.username}`} className="flex items-center gap-2.5 min-w-0 flex-1">
              <span className="relative shrink-0">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={m.avatarUrl || ''} />
                  <AvatarFallback className="text-[10px] font-bold">{m.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
                </Avatar>
                {m.id !== myId && <PresenceDot userId={m.id} className="h-2.5 w-2.5" />}
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1 text-[13px] font-medium truncate">
                  {m.displayName}
                  {m.id === myId && <span className="text-muted-foreground font-normal">(bạn)</span>}
                  {m.role === 'owner' && <Crown className="h-3 w-3 text-amber-500 shrink-0" />}
                </span>
                <span className="block text-[11px] text-muted-foreground truncate">@{m.username}</span>
              </span>
            </Link>
            {isOwner && m.id !== myId && !m.isBot && <MemberActions conversationId={conversation.id} member={m} />}
          </div>
        ))
      )}

      <Dialog open={adding} onOpenChange={setAdding}>
        <DialogContent className="max-w-md p-5 gap-4">
          <DialogHeader>
            <DialogTitle className="text-base">Thêm vào nhóm</DialogTitle>
          </DialogHeader>
          <UserPicker selected={picked} onChange={setPicked} excludeIds={members.map((m) => m.id)} />
          <Button className="w-full rounded-full" disabled={!picked.length || addMembers.isPending} onClick={submitAdd}>
            {addMembers.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : `Thêm ${picked.length || ''} người`}
          </Button>
        </DialogContent>
      </Dialog>
    </div>
  )
}
