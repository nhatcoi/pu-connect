'use client'

import React, { useState } from 'react'
import { Ban, Loader2, MoreHorizontal } from 'lucide-react'
import type { BlockState } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useBlockActions } from '@/hooks/use-blocks'

interface BlockUserControlProps {
  userId: string
  username: string
  blockState: BlockState
}

// Hồ sơ người khác: đã chặn ⇒ nút "Bỏ chặn"; chưa ⇒ menu ⋯ có "Chặn" (luôn xác nhận)
export function BlockUserControl({ userId, username, blockState }: BlockUserControlProps) {
  const { block, unblock } = useBlockActions()
  const [confirmOpen, setConfirmOpen] = useState(false)

  if (blockState === 'blocking') {
    return (
      <Button
        variant="outline"
        size="sm"
        className="h-8 rounded-full px-4 text-xs font-semibold text-destructive border-destructive/40 hover:bg-destructive/10 hover:text-destructive"
        disabled={unblock.isPending}
        onClick={() => unblock.mutate(userId)}
      >
        {unblock.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Bỏ chặn'}
      </Button>
    )
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" size="icon" className="rounded-full h-8 w-8 border-border" aria-label={`Tùy chọn cho @${username}`}>
            <MoreHorizontal className="h-4 w-4 text-muted-foreground" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-48">
          <DropdownMenuItem variant="destructive" onSelect={() => setConfirmOpen(true)}>
            <Ban /> Chặn @{username}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Dialog open={confirmOpen} onOpenChange={(open) => !block.isPending && setConfirmOpen(open)}>
        <DialogContent className="max-w-sm p-5 gap-4">
          <DialogHeader>
            <DialogTitle className="text-base">Chặn @{username}?</DialogTitle>
            <DialogDescription>
              Hai bạn sẽ không nhắn tin, theo dõi hay thấy bài viết và bình luận của nhau. @{username} không được thông báo.
            </DialogDescription>
          </DialogHeader>
          <DialogFooter className="gap-2">
            <Button variant="outline" className="rounded-full" disabled={block.isPending} onClick={() => setConfirmOpen(false)}>
              Hủy
            </Button>
            <Button
              variant="destructive"
              className="rounded-full"
              disabled={block.isPending}
              onClick={() => block.mutate(userId, { onSuccess: () => setConfirmOpen(false) })}
            >
              {block.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Chặn'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
