'use client'

import React, { useState } from 'react'
import { Crown, Loader2, MoreHorizontal, UserMinus } from 'lucide-react'
import type { ChatMember } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useConversationActions } from '@/hooks/chat'

type Action = 'owner' | 'remove'

const COPY: Record<Action, { title: string; body: (name: string) => string; confirm: string }> = {
  owner: {
    title: 'Chuyển quyền trưởng nhóm?',
    body: (name) => `${name} sẽ thành trưởng nhóm. Bạn trở thành thành viên và không còn quyền xóa người khỏi nhóm.`,
    confirm: 'Chuyển quyền'
  },
  remove: {
    title: 'Xóa khỏi nhóm?',
    body: (name) => `${name} sẽ không xem được tin nhắn mới của nhóm nữa.`,
    confirm: 'Xóa'
  }
}

// Thao tác của trưởng nhóm trên 1 thành viên: chuyển quyền, xóa khỏi nhóm (luôn xác nhận)
export function MemberActions({ conversationId, member }: { conversationId: string; member: ChatMember }) {
  const { removeMember, transferOwner } = useConversationActions(conversationId)
  const [action, setAction] = useState<Action | null>(null)
  const mutation = action === 'owner' ? transferOwner : removeMember
  const copy = action ? COPY[action] : null

  const confirm = () => mutation.mutate(member.id, { onSuccess: () => setAction(null) })

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <button
            aria-label={`Tùy chọn cho ${member.displayName}`}
            className="p-1.5 rounded-full text-muted-foreground hover:text-foreground hover:bg-muted cursor-pointer"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-52">
          <DropdownMenuItem onSelect={() => setAction('owner')}>
            <Crown /> Chuyển trưởng nhóm
          </DropdownMenuItem>
          <DropdownMenuItem variant="destructive" onSelect={() => setAction('remove')}>
            <UserMinus /> Xóa khỏi nhóm
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={!!action} onOpenChange={(open) => !open && !mutation.isPending && setAction(null)}>
        {copy && (
          <DialogContent className="max-w-sm p-5 gap-4">
            <DialogHeader>
              <DialogTitle className="text-base">{copy.title}</DialogTitle>
              <DialogDescription>{copy.body(member.displayName)}</DialogDescription>
            </DialogHeader>
            <DialogFooter className="gap-2">
              <Button variant="outline" className="rounded-full" disabled={mutation.isPending} onClick={() => setAction(null)}>
                Hủy
              </Button>
              <Button
                variant={action === 'remove' ? 'destructive' : 'default'}
                className="rounded-full"
                disabled={mutation.isPending}
                onClick={confirm}
              >
                {mutation.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : copy.confirm}
              </Button>
            </DialogFooter>
          </DialogContent>
        )}
      </Dialog>
    </>
  )
}
