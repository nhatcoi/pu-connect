'use client'

import React, { useState, useRef, useEffect } from 'react'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { uploadFileToR2 } from '@/lib/api-client'
import { Image as ImageIcon, Binary, Code2, Loader2, X } from 'lucide-react'
import { toast } from 'sonner'

interface CommentComposerProps {
  onSubmit: (content: string, mediaUrls?: string[]) => Promise<any>
  parentId?: string
  placeholder?: string
  autoFocus?: boolean
  onCancel?: () => void
}

export function CommentComposer({
  onSubmit,
  parentId,
  placeholder = 'Viết câu trả lời hoặc thảo luận của bạn...',
  autoFocus = false,
  onCancel
}: CommentComposerProps) {
  const user = useAppStore((state) => state.user)
  const [content, setContent] = useState('')
  const [attachedImages, setAttachedImages] = useState<{ id: string; url: string; file?: File }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`
    }
  }, [content])

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
    }
  }, [autoFocus])

  const userInitials = (
    user?.displayName ||
    (user as any)?.display_name ||
    user?.username ||
    'PU'
  )
    .slice(0, 2)
    .toUpperCase()

  const handleInsertText = (snippet: string) => {
    if (!textareaRef.current) {
      setContent((prev) => prev + snippet)
      return
    }
    const textarea = textareaRef.current
    const start = textarea.selectionStart
    const end = textarea.selectionEnd
    const newContent = content.substring(0, start) + snippet + content.substring(end)
    setContent(newContent)

    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + snippet.length, start + snippet.length)
    }, 0)
  }

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      const newFiles = Array.from(e.target.files).map((file) => ({
        id: `img_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        url: URL.createObjectURL(file),
        file
      }))
      setAttachedImages((prev) => [...prev, ...newFiles])
      e.target.value = ''
    }
  }

  const handleRemoveImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleSubmit = async () => {
    if (!content.trim() && attachedImages.length === 0) return

    setIsSubmitting(true)
    try {
      // 1. Upload images to R2 if any
      const uploadedUrls: string[] = []
      for (const img of attachedImages) {
        if (img.file) {
          const res = await uploadFileToR2(img.file, 'posts/images')
          uploadedUrls.push(res.url)
        } else if (img.url && !img.url.startsWith('blob:')) {
          uploadedUrls.push(img.url)
        }
      }

      await onSubmit(content, uploadedUrls)
      setContent('')
      setAttachedImages([])
    } catch (err: any) {
      toast.error(err.message || 'Không thể gửi phản hồi')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="flex gap-2.5 items-start pt-2">
      <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border select-none shadow-xs">
        <AvatarImage src={user?.avatarUrl || (user as any)?.avatar || ''} alt={user?.displayName || ''} />
        <AvatarFallback className="bg-foreground text-background font-bold text-[11px]">
          {userInitials}
        </AvatarFallback>
      </Avatar>

      <div className="flex-1 min-w-0 rounded-xl border border-border bg-card p-2.5 space-y-2 shadow-xs focus-within:border-foreground/30 transition-colors">
        {/* Hidden File input */}
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={handleFileChange}
        />

        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder={placeholderText(placeholder, !!parentId)}
          rows={1}
          className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
        />

        {/* Attached image preview thumbnails */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachedImages.map((img) => (
              <div
                key={img.id}
                className="group relative h-16 w-16 overflow-hidden rounded-lg border border-border bg-black/5"
              >
                <img src={img.url} alt="Attached" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute top-1 right-1 flex h-4 w-4 items-center justify-center rounded-full bg-black/75 text-white hover:bg-black transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {/* Bottom Toolbar & Action buttons */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div className="flex items-center gap-0.5 text-muted-foreground">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Đính kèm ảnh minh họa"
            >
              <ImageIcon className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleInsertText(' $f(x) = x^2$ ')}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Chèn công thức toán ($KaTeX$)"
            >
              <Binary className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleInsertText('\n```python\n# code\n```\n')}
              className="flex h-7 w-7 items-center justify-center rounded-full hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
              title="Chèn khối mã nguồn (Code Block)"
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-1.5">
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-7 px-2.5 text-[11px] text-muted-foreground hover:text-foreground cursor-pointer"
              >
                Hủy
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={isSubmitting || (!content.trim() && attachedImages.length === 0)}
              className="h-7 rounded-full px-3.5 text-[11px] font-bold bg-foreground text-background hover:bg-foreground/90 transition-all cursor-pointer disabled:opacity-40"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="h-3 w-3 animate-spin mr-1" />
                  <span>Đang gửi...</span>
                </>
              ) : (
                <span>{parentId ? 'Trả lời' : 'Bình luận'}</span>
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

function placeholderText(defaultPlaceholder: string, isReply: boolean) {
  if (isReply) return 'Viết câu trả lời trực tiếp...'
  return defaultPlaceholder
}
