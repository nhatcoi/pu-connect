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
import { toast } from 'sonner'
import { FileUp, Sparkles } from 'lucide-react'

export function CreatePostDialog() {
  const isOpen = useAppStore((state) => state.isCreatePostOpen)
  const setOpen = useAppStore((state) => state.setCreatePostOpen)
  const addPost = useAppStore((state) => state.addPost)

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [tagInput, setTagInput] = useState('')

  const handlePost = () => {
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết')
      return
    }

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().replace(/^#/, ''))
      .filter(Boolean)

    addPost({
      id: `post_${Date.now()}`,
      authorId: 'user_me',
      author: {
        id: 'user_me',
        username: 'vietnhat',
        displayName: 'Việt Nhật',
        avatarUrl: null
      },
      title: title.trim() || undefined,
      content,
      tags,
      mediaUrls: [],
      attachedDocumentIds: [],
      likesCount: 0,
      commentsCount: 0,
      sharesCount: 0,
      isLikedByMe: false,
      createdAt: 'Vừa xong',
      updatedAt: 'Vừa xong'
    })

    toast.success('Đã đăng bài viết thành công!')
    setTitle('')
    setContent('')
    setTagInput('')
    setOpen(false)
  }

  return (
    <Dialog open={isOpen} onOpenChange={setOpen}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Sparkles className="h-5 w-5 text-primary" />
            Tạo bài viết / Chia sẻ kiến thức mới
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 py-2">
          <Input
            placeholder="Tiêu đề bài viết (tùy chọn)..."
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="font-medium text-base"
          />

          <Tabs defaultValue="write" className="w-full">
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="write">Soạn thảo WYSIWYG / Markdown</TabsTrigger>
              <TabsTrigger value="preview">Xem trước (LaTeX, Mermaid)</TabsTrigger>
            </TabsList>
            <TabsContent value="write" className="mt-3">
              <TiptapEditor
                content={content}
                onChange={setContent}
                placeholder="Nhập nội dung bài viết (Hỗ trợ code block, bảng, công thức toán)..."
              />
            </TabsContent>
            <TabsContent value="preview" className="mt-3 min-h-[160px] rounded-md border p-4">
              {content ? (
                <MarkdownPreview content={content} />
              ) : (
                <p className="text-xs text-muted-foreground italic">Chưa có nội dung để xem trước...</p>
              )}
            </TabsContent>
          </Tabs>

          <div className="flex items-center gap-3">
            <Input
              placeholder="Thẻ gắn tags (phân cách bằng dấu phẩy, VD: nextjs, ai, react)..."
              value={tagInput}
              onChange={(e) => setTagInput(e.target.value)}
              className="text-xs"
            />
            <Button variant="outline" size="sm" className="shrink-0 gap-1.5 text-xs">
              <FileUp className="h-4 w-4" /> Đính kèm tệp
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => setOpen(false)}>
            Hủy
          </Button>
          <Button onClick={handlePost}>Đăng ngay</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
