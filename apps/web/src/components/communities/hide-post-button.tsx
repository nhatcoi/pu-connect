'use client'

import React, { useState } from 'react'
import { EyeOff, Loader2 } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { useHidePostActions } from '@/hooks/use-community-manage'

// Nút của chủ / điều hành viên trên bài trong cộng đồng: ẩn bài vi phạm (khôi phục được ở hộp Quản lý)
export function HidePostButton({ slug, postId }: { slug: string; postId: string }) {
  const [open, setOpen] = useState(false)
  const [reason, setReason] = useState('')
  const { hide } = useHidePostActions(slug)

  const submit = () =>
    hide.mutate(
      { postId, reason: reason.trim() || undefined },
      {
        onSuccess: () => {
          setOpen(false)
          setReason('')
        }
      }
    )

  return (
    <>
      <Button
        variant="ghost"
        size="icon"
        className="absolute right-11 top-2.5 z-10 h-7 w-7 rounded-full text-muted-foreground hover:text-destructive"
        title="Ẩn bài vi phạm"
        aria-label="Ẩn bài vi phạm"
        onClick={() => setOpen(true)}
      >
        <EyeOff className="h-3.5 w-3.5" />
      </Button>
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-sm gap-3 p-5">
          <DialogHeader>
            <DialogTitle className="text-base font-bold">Ẩn bài viết này?</DialogTitle>
            <DialogDescription className="text-xs">
              Bài sẽ biến khỏi cộng đồng và tác giả được thông báo. Bạn khôi phục lại được trong mục Quản lý.
            </DialogDescription>
          </DialogHeader>
          <Input value={reason} maxLength={300} placeholder="Lý do (không bắt buộc)" className="text-xs" onChange={(e) => setReason(e.target.value)} />
          <DialogFooter>
            <Button variant="outline" size="sm" onClick={() => setOpen(false)}>
              Hủy
            </Button>
            <Button variant="destructive" size="sm" disabled={hide.isPending} onClick={submit}>
              {hide.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Ẩn bài'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  )
}
