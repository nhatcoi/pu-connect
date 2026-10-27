'use client'

import React from 'react'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Loader2 } from 'lucide-react'

interface DeletePostDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onConfirm: () => void
  isDeleting: boolean
}

// Xác nhận xóa bài; gợi ý Lưu trữ nếu chỉ muốn gỡ khỏi bảng tin
export function DeletePostDialog({ open, onOpenChange, onConfirm, isDeleting }: DeletePostDialogProps) {
  return (
    <Dialog open={open} onOpenChange={(next) => !isDeleting && onOpenChange(next)}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle>Xóa bài viết?</DialogTitle>
          <DialogDescription>Bài viết cùng bình luận và lượt thích sẽ bị gỡ. Nếu chỉ muốn ẩn khỏi bảng tin, hãy chọn Lưu trữ để giữ lại và khôi phục sau.</DialogDescription>
        </DialogHeader>
        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isDeleting}>
            Hủy
          </Button>
          <Button type="button" variant="destructive" onClick={onConfirm} disabled={isDeleting} className="gap-2">
            {isDeleting && <Loader2 className="h-4 w-4 animate-spin" />}
            Xóa bài viết
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
