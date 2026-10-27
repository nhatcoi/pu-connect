'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import type { MentionCandidate } from '@pu/schemas'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { N7AiMark } from '@/components/brand/pu-logo'
import { MentionPopover, mentionOptionId } from '@/components/mentions/mention-popover'
import { useAppStore } from '@/store'
import { useMentionPicker } from '@/hooks/use-mention-picker'
import { useDraft } from '@/hooks/use-draft'
import { errorMessage, uploadFileToR2 } from '@/lib/api-client'
import { discardDocumentDraft, uploadDocumentDraft } from '@/lib/document-api'
import { N7AI_MENTION } from '@/lib/mention'
import { Image as ImageIcon, Binary, Code2, FileText, Loader2, Paperclip, X } from 'lucide-react'
import { AnonymousToggle } from '../anonymous-toggle'
import { toast } from 'sonner'

const MAX_COMMENT_DOCS = 3

interface CommentComposerProps {
  onSubmit: (content: string, mediaUrls?: string[], anonymous?: boolean, documentIds?: string[]) => Promise<unknown>
  parentId?: string
  placeholder?: string
  autoFocus?: boolean
  initialContent?: string
  onCancel?: () => void
  // Gợi ý @mention theo bài viết (người trong bài hiện ngay)
  postId?: string
  mentionContext?: MentionCandidate[]
  // Khoá nháp trên trình duyệt (bỏ trống = không lưu nháp)
  draftKey?: string
  // Sửa bình luận: nút "Lưu", không đính kèm ảnh, không gọi N7AI
  mode?: 'create' | 'edit'
}

export function CommentComposer({
  onSubmit,
  parentId,
  placeholder = 'Viết câu trả lời hoặc thảo luận của bạn...',
  autoFocus = false,
  initialContent = '',
  onCancel,
  postId,
  mentionContext,
  draftKey,
  mode = 'create'
}: CommentComposerProps) {
  const isEdit = mode === 'edit'
  const user = useAppStore((state) => state.user)
  const [content, setContent] = useState(initialContent)
  const [attachedImages, setAttachedImages] = useState<{ id: string; url: string; file?: File }[]>([])
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [anonymous, setAnonymous] = useState(false)
  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const docInputRef = useRef<HTMLInputElement>(null)
  // Tài liệu đính kèm: tải lên ngay thành bản nháp (đăng cùng bình luận), tối đa MAX_COMMENT_DOCS
  const [attachedDocs, setAttachedDocs] = useState<{ key: string; name: string; id?: string; uploading: boolean }[]>([])
  const docsUploading = attachedDocs.some((d) => d.uploading)

  const listId = useId()
  const mention = useMentionPicker({
    textareaRef,
    value: content,
    setValue: setContent,
    postId,
    context: mentionContext
  })

  // Nháp: chỉ lưu phần người dùng tự gõ (bỏ qua "@user " điền sẵn khi trả lời)
  const clearDraft = useDraft(draftKey, content === initialContent ? '' : content, setContent)
  const asksN7Ai = !isEdit && N7AI_MENTION.test(content)

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(40, textareaRef.current.scrollHeight)}px`
    }
  }, [content])

  useEffect(() => {
    if (autoFocus && textareaRef.current) {
      textareaRef.current.focus()
      const len = textareaRef.current.value.length
      textareaRef.current.setSelectionRange(len, len)
    }
  }, [autoFocus])

  const userInitials = (user?.displayName || user?.username || 'PU').slice(0, 2).toUpperCase()

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

  const handleDocChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []).filter((f) => !f.type.startsWith('image/'))
    e.target.value = ''
    const room = MAX_COMMENT_DOCS - attachedDocs.length
    if (files.length > room) toast.info(`Bình luận đính kèm tối đa ${MAX_COMMENT_DOCS} tài liệu`)
    for (const file of files.slice(0, Math.max(0, room))) {
      const key = `doc_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`
      setAttachedDocs((prev) => [...prev, { key, name: file.name, uploading: true }])
      uploadDocumentDraft(file)
        .then((res) => setAttachedDocs((prev) => prev.map((d) => (d.key === key ? { ...d, id: res.document.id, uploading: false } : d))))
        .catch((err) => {
          toast.error(errorMessage(err, 'Tải tài liệu thất bại'))
          setAttachedDocs((prev) => prev.filter((d) => d.key !== key))
        })
    }
  }

  const handleRemoveDoc = (key: string) => {
    const doc = attachedDocs.find((d) => d.key === key)
    if (doc?.id) void discardDocumentDraft(doc.id).catch(() => undefined)
    setAttachedDocs((prev) => prev.filter((d) => d.key !== key))
  }

  const handleRemoveImage = (id: string) => {
    setAttachedImages((prev) => prev.filter((img) => img.id !== id))
  }

  const handleSubmit = async () => {
    if ((!content.trim() && attachedImages.length === 0) || docsUploading) return

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

      const documentIds = attachedDocs.map((d) => d.id).filter((id): id is string => !!id)
      const ok = await onSubmit(content.trim(), uploadedUrls.length > 0 ? uploadedUrls : undefined, !isEdit && anonymous, documentIds.length ? documentIds : undefined)
      // onSubmit trả null/false = lỗi ⇒ giữ nguyên nội dung để gửi lại
      if (ok === null || ok === false) return
      clearDraft()
      setContent('')
      setAnonymous(false)
      setAttachedImages([])
      setAttachedDocs([])
    } catch {
      toast.error('Không thể gửi bình luận')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleCancel = () => {
    clearDraft()
    onCancel?.()
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (mention.onKeyDown(e)) return
    if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) {
      e.preventDefault()
      handleSubmit()
    } else if (e.key === 'Escape' && onCancel) {
      e.preventDefault()
      handleCancel()
    }
  }

  return (
    <div className="flex gap-3 items-start">
      <Avatar className="h-8 w-8 shrink-0 rounded-full border border-border select-none shadow-xs mt-0.5">
        <AvatarImage src={user?.avatarUrl || ''} alt={user?.displayName || 'User'} />
        <AvatarFallback className="bg-primary text-primary-foreground font-bold text-[10px]">{userInitials}</AvatarFallback>
      </Avatar>

      <div className="relative flex-1 min-w-0 rounded-2xl border border-border/80 bg-card p-2.5 space-y-2 shadow-2xs focus-within:border-primary/60 focus-within:ring-1 focus-within:ring-primary/20 transition-all">
        <textarea
          ref={textareaRef}
          value={content}
          onChange={(e) => setContent(e.target.value)}
          onKeyDown={handleKeyDown}
          onSelect={mention.sync}
          onBlur={mention.close}
          placeholder={placeholder}
          rows={1}
          role="combobox"
          aria-autocomplete="list"
          aria-expanded={mention.open}
          aria-controls={mention.open ? listId : undefined}
          aria-activedescendant={mention.open && mention.items.length ? mentionOptionId(listId, mention.index) : undefined}
          className="w-full resize-none bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed"
        />

        {mention.open && (
          <MentionPopover
            id={listId}
            items={mention.items}
            index={mention.index}
            isLoading={mention.isLoading}
            onHover={mention.setIndex}
            onSelect={mention.select}
            className="absolute left-2 top-full mt-1"
          />
        )}

        {/* Đã gọi @n7ai ⇒ báo trước N7AI sẽ trả lời */}
        {asksN7Ai && (
          <p className="flex items-center gap-1.5 text-[11px] text-primary">
            <N7AiMark className="h-3.5 w-3.5" />
            N7AI sẽ trả lời bình luận này
          </p>
        )}

        {/* Attached Images Preview */}
        {attachedImages.length > 0 && (
          <div className="flex flex-wrap gap-2 pt-1">
            {attachedImages.map((img) => (
              <div key={img.id} className="relative group rounded-lg overflow-hidden border border-border h-16 w-16">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={img.url} alt="Attached" className="h-full w-full object-cover" />
                <button
                  type="button"
                  onClick={() => handleRemoveImage(img.id)}
                  className="absolute top-1 right-1 bg-black/60 hover:bg-black text-white p-0.5 rounded-full cursor-pointer transition-colors"
                >
                  <X className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        )}

        {attachedDocs.length > 0 && (
          <div className="flex flex-wrap gap-1.5">
            {attachedDocs.map((d) => (
              <span key={d.key} className="inline-flex max-w-[220px] items-center gap-1.5 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px]">
                {d.uploading ? <Loader2 className="h-3 w-3 shrink-0 animate-spin" /> : <FileText className="h-3 w-3 shrink-0 text-primary" />}
                <span className="truncate">{d.name}</span>
                <button type="button" onClick={() => handleRemoveDoc(d.key)} className="shrink-0 cursor-pointer text-muted-foreground hover:text-foreground" title="Gỡ tài liệu">
                  <X className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        )}

        {/* Bottom Toolbar & Submit Button */}
        <div className="flex items-center justify-between pt-1 border-t border-border/40">
          <div className="flex items-center gap-1">
            {!isEdit && (
              <>
                <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleFileChange} />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
                  title="Đính kèm ảnh"
                >
                  <ImageIcon className="h-3.5 w-3.5" />
                </button>
                <input ref={docInputRef} type="file" multiple className="hidden" onChange={handleDocChange} />
                <button
                  type="button"
                  onClick={() => docInputRef.current?.click()}
                  disabled={attachedDocs.length >= MAX_COMMENT_DOCS}
                  className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer disabled:opacity-40"
                  title="Đính kèm tài liệu (PDF, Word, slide…)"
                >
                  <Paperclip className="h-3.5 w-3.5" />
                </button>
              </>
            )}

            <button
              type="button"
              onClick={() => handleInsertText(' $f(x) = x^2$ ')}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              title="Chèn công thức toán LaTeX"
            >
              <Binary className="h-3.5 w-3.5" />
            </button>

            <button
              type="button"
              onClick={() => handleInsertText('\n```cpp\n// Code snippet\n```\n')}
              className="flex h-7 w-7 items-center justify-center rounded-full text-muted-foreground hover:bg-primary/10 hover:text-primary transition-colors cursor-pointer"
              title="Chèn khối mã nguồn"
            >
              <Code2 className="h-3.5 w-3.5" />
            </button>
          </div>

          <div className="flex items-center gap-2">
            {!isEdit && <AnonymousToggle variant="comment" checked={anonymous} onChange={setAnonymous} />}
            {onCancel && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleCancel}
                disabled={isSubmitting}
                className="h-7 px-2.5 text-xs text-muted-foreground hover:text-foreground"
              >
                Hủy
              </Button>
            )}

            <Button
              type="button"
              size="sm"
              onClick={handleSubmit}
              disabled={(!content.trim() && attachedImages.length === 0) || isSubmitting || docsUploading}
              className="h-7 px-3 text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-2xs rounded-full gap-1"
            >
              {isSubmitting ? <Loader2 className="h-3 w-3 animate-spin" /> : <span>{isEdit ? 'Lưu' : parentId ? 'Trả lời' : 'Bình luận'}</span>}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
