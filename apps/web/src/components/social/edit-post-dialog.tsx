'use client'

import React, { useMemo, useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { apiClient, errorMessage } from '@/lib/api-client'
import { cn } from '@/lib/utils'
import type { PostItem, PostType, PostVisibility, UpdatePostInput } from '@pu/schemas'
import { toast } from 'sonner'
import { Loader2, Tag, X } from 'lucide-react'
import { ComposerIntentSelector } from './composer/composer-intent-selector'
import { ComposerCoursePicker } from './composer/composer-course-picker'
import { POST_VISIBILITY, POST_VISIBILITY_ORDER } from './post-visibility'

const MAX_TITLE = 200
const MAX_TAGS = 10

interface EditPostDialogProps {
  post: PostItem
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: (updatedPost: PostItem) => void
}

const sameList = (a: string[], b: string[]) => a.length === b.length && a.every((x, i) => x === b[i])
const normalizeTag = (raw: string) => raw.trim().replace(/^#/, '').replace(/\s+/g, '')

export function EditPostDialog({ post, open, onOpenChange, onSuccess }: EditPostDialogProps) {
  const [title, setTitle] = useState(post.title || '')
  const [content, setContent] = useState(post.content || '')
  const [postType, setPostType] = useState<PostType>(post.postType)
  const [courseId, setCourseId] = useState<string | undefined>(post.courseId || undefined)
  const [visibility, setVisibility] = useState<PostVisibility>(post.visibility ?? 'public')
  const [tags, setTags] = useState<string[]>(post.tags ?? [])
  const [tagInput, setTagInput] = useState('')
  const [mediaUrls, setMediaUrls] = useState<string[]>(post.mediaUrls ?? [])
  const [isSubmitting, setIsSubmitting] = useState(false)

  // Bài ẩn danh luôn là hỏi đáp công khai ⇒ không cho đổi loại / quyền xem
  const locked = post.isAnonymous

  // Chỉ gửi phần thay đổi: không đổi gì ⇒ không kiểm duyệt lại, không báo @mention lại
  const changes = useMemo(() => {
    const patch: UpdatePostInput = {}
    if (title.trim() !== (post.title || '')) patch.title = title.trim()
    if (content.trim() !== post.content.trim()) patch.content = content.trim()
    if (postType !== post.postType) patch.postType = postType
    if ((courseId ?? null) !== (post.courseId ?? null)) patch.courseId = courseId ?? null
    if (visibility !== (post.visibility ?? 'public')) patch.visibility = visibility
    if (!sameList(tags, post.tags ?? [])) patch.tags = tags
    if (!sameList(mediaUrls, post.mediaUrls ?? [])) patch.mediaUrls = mediaUrls
    return patch
  }, [title, content, postType, courseId, visibility, tags, mediaUrls, post])
  const hasChanges = Object.keys(changes).length > 0

  const addTags = (raw: string) => {
    const next = raw.split(/[,\n]/).map(normalizeTag).filter(Boolean)
    if (!next.length) return
    setTags((prev) => [...new Set([...prev, ...next])].slice(0, MAX_TAGS))
    setTagInput('')
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!content.trim()) {
      toast.error('Nội dung không được để trống')
      return
    }
    if (!hasChanges) {
      onOpenChange(false)
      return
    }

    setIsSubmitting(true)
    try {
      const res = await apiClient<{ success: boolean; data: PostItem }>(`/posts/${post.id}`, { method: 'PATCH', body: JSON.stringify(changes) })
      if (res?.data) {
        toast.success('Đã lưu chỉnh sửa')
        onSuccess?.(res.data)
        onOpenChange(false)
      }
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể cập nhật bài viết'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-2xl p-6 gap-4 max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Chỉnh sửa bài viết</DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-1">
          {!locked && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Loại bài</label>
              <ComposerIntentSelector value={postType} onChange={setPostType} />
            </div>
          )}

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Tiêu đề (tùy chọn)</label>
            <Input value={title} maxLength={MAX_TITLE} onChange={(e) => setTitle(e.target.value)} placeholder="Tiêu đề tóm tắt..." />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Nội dung bài viết *</label>
            <Tabs defaultValue="write">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="write">Soạn thảo</TabsTrigger>
                <TabsTrigger value="preview">Xem trước</TabsTrigger>
              </TabsList>
              <TabsContent value="write" className="mt-2">
                <Textarea
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  rows={9}
                  placeholder="Chia sẻ kiến thức, bài tập hoặc câu hỏi... (hỗ trợ Markdown, code, công thức LaTeX)"
                  required
                />
              </TabsContent>
              <TabsContent value="preview" className="mt-2 min-h-[160px] rounded-lg border border-border bg-card p-4">
                {content.trim() ? <MarkdownPreview content={content} /> : <p className="text-xs text-muted-foreground italic">Chưa có nội dung để xem trước...</p>}
              </TabsContent>
            </Tabs>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Môn học</label>
            <ComposerCoursePicker selectedCourseId={courseId} onChange={setCourseId} />
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Thẻ (Enter hoặc dấu phẩy để thêm, tối đa {MAX_TAGS})</label>
            <div className="flex flex-wrap items-center gap-1.5 rounded-md border border-input bg-background px-2 py-1.5">
              {tags.map((t) => (
                <span key={t} className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2 py-0.5 text-xs font-medium text-primary">
                  <Tag className="h-3 w-3" />
                  {t}
                  <button type="button" onClick={() => setTags((prev) => prev.filter((x) => x !== t))} className="cursor-pointer hover:text-foreground" aria-label={`Bỏ thẻ ${t}`}>
                    <X className="h-3 w-3" />
                  </button>
                </span>
              ))}
              <input
                value={tagInput}
                onChange={(e) => (e.target.value.includes(',') ? addTags(e.target.value) : setTagInput(e.target.value))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addTags(tagInput)
                  } else if (e.key === 'Backspace' && !tagInput && tags.length) setTags((prev) => prev.slice(0, -1))
                }}
                onBlur={() => addTags(tagInput)}
                disabled={tags.length >= MAX_TAGS}
                placeholder={tags.length ? '' : 'IT101, PostgreSQL, OOP'}
                className="min-w-[8rem] flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground outline-none"
              />
            </div>
          </div>

          {mediaUrls.length > 0 && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ảnh đính kèm</label>
              <div className="flex flex-wrap gap-2">
                {mediaUrls.map((url) => (
                  <div key={url} className="relative h-20 w-20 overflow-hidden rounded-lg border border-border bg-muted">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={url} alt="" className="h-full w-full object-cover" />
                    <button
                      type="button"
                      onClick={() => setMediaUrls((prev) => prev.filter((u) => u !== url))}
                      className="absolute right-1 top-1 cursor-pointer rounded-full bg-background/90 p-0.5 text-foreground shadow hover:bg-background"
                      aria-label="Gỡ ảnh"
                    >
                      <X className="h-3.5 w-3.5" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {!locked && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-muted-foreground">Ai xem được bài này</label>
              <div className="grid gap-2 sm:grid-cols-3">
                {POST_VISIBILITY_ORDER.map((key) => {
                  const { label, description, icon: Icon } = POST_VISIBILITY[key]
                  const selected = visibility === key
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setVisibility(key)}
                      aria-pressed={selected}
                      className={cn(
                        'flex flex-col items-start gap-1 rounded-xl border p-2.5 text-left transition-colors cursor-pointer',
                        selected ? 'border-primary bg-primary/10' : 'border-border hover:bg-muted'
                      )}
                    >
                      <span className={cn('inline-flex items-center gap-1.5 text-xs font-semibold', selected ? 'text-primary' : 'text-foreground')}>
                        <Icon className="h-3.5 w-3.5" />
                        {label}
                      </span>
                      <span className="text-[11px] leading-tight text-muted-foreground">{description}</span>
                    </button>
                  )
                })}
              </div>
            </div>
          )}

          <DialogFooter className="pt-2">
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
              Hủy
            </Button>
            <Button type="submit" disabled={isSubmitting || !hasChanges} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Lưu thay đổi
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
