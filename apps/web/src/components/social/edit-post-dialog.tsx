'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import type { PostItem } from '@pu/schemas'
import { toast } from 'sonner'
import { Loader2 } from 'lucide-react'

interface EditPostDialogProps {
  post: PostItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (updatedPost: PostItem) => void
}

export function EditPostDialog({ post, open, onOpenChange, onSuccess }: EditPostDialogProps) {
  const [title, setTitle] = useState(post.title || '')
  const [content, setContent] = useState(post.content || '')
  const [tagsInput, setTagsInput] = useState(post.tags?.join(', ') || '')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Nội dung không được để trống')
      return
    }

    setIsSubmitting(true)
    try {
      const tags = tagsInput
        .split(',')
        .map((t) => t.trim().replace(/^#/, ''))
        .filter(Boolean)

      const res = await apiClient<{ success: boolean; data: PostItem }>(`/posts/${post.id}`, {
        method: 'PATCH',
        body: JSON.stringify({
          title: title.trim() || undefined,
          content: content.trim(),
          tags
        })
      })

      if (res && res.data) {
        toast.success('Đã lưu chỉnh sửa')
        onSuccess?.(res.data)
        onOpenChange(false)
      }
    } catch (err: any) {
      toast.error('Không thể cập nhật bài viết')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-xl p-6 gap-4">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Tiêu đề (Tùy chọn)</label>
            <Input
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="Tiêu đề tóm tắt..."
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Nội dung bài viết *</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              rows={6}
              placeholder="Chia sẻ kiến thức, bài tập hoặc câu hỏi..."
              required
            />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Tags (Cách nhau bằng dấu phẩy)</label>
            <Input
              value={tagsInput}
              onChange={(e) => setTagsInput(e.target.value)}
              placeholder="IT101, PostgreSQL, OOP"
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
