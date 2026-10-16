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
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { TiptapEditor } from '@/components/editor/tiptap-editor'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useAppStore } from '@/store'
import { useQueryClient } from '@tanstack/react-query'
import { onPostCreated as notifyPostCreated } from '@/lib/post-cache'
import { toast } from 'sonner'
import { FileUp, Sparkles, Loader2 } from 'lucide-react'
import { apiClient, errorMessage } from '@/lib/api-client'
import type { PostItem } from '@pu/schemas'

export function CreatePostDialog() {
  const isOpen = useAppStore((state) => state.isCreatePostOpen)
  const setOpen = useAppStore((state) => state.setCreatePostOpen)
  const queryClient = useQueryClient()

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handlePost = async () => {
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết')
      return
    }

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)

    setIsSubmitting(true)
    try {
      const response = await apiClient<{ success: boolean; data: PostItem }>('/posts', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim() || undefined,
          content,
          tags,
          mediaUrls: [],
          attachedDocumentIds: []
        })
      })

      if (response && response.data) {
        // Chèn vào mọi danh sách liên quan trong cache (feed, cộng đồng, hồ sơ)
        notifyPostCreated(queryClient, response.data, useAppStore.getState().user?.username)
        toast.success('Đã đăng bài viết')
      }

      setTitle('')
      setContent('')
      setTagInput('')
      setOpen(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể tạo bài viết'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Sparkles className="h-4 w-4 text-primary" />
            Tạo bài viết và thảo luận học thuật
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Input
            placeholder="Tiêu đề bài viết hoặc câu hỏi học thuật..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-semibold text-sm bg-background text-foreground"
          />

          <Tabs defaultValue="write" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="write">Soạn thảo văn bản</TabsTrigger>
              <TabsTrigger value="preview">Xem trước định dạng</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-3">
              <TiptapEditor
                content={content}
                onChange={setContent}
                placeholder="Nhập nội dung bài viết (Hỗ trợ code block, bảng, công thức toán LaTeX, sơ đồ Mermaid)..."
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-3 min-h-[160px] rounded-lg border border-border bg-card p-4">
              {content ? (
                <MarkdownPreview content={content} />
              ) : (
                <p className="text-xs text-muted-foreground italic">Chưa có nội dung để xem trước...</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <Input
              placeholder="Thẻ gắn tags (phân cách bằng dấu phẩy, VD: it101, math201, pbl3)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="text-xs bg-background text-foreground"
            />
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
              <FileUp className="h-4 w-4 text-muted-foreground" />
              <span>Đính kèm tệp</span>
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handlePost} disabled={isSubmitting} className="gap-1.5 bg-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Đăng bài viết</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
