'use client'

import React, { useState, useRef, useEffect, useId } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { Loader2, Sparkles, X, Users, Tag } from 'lucide-react'
import { apiClient, uploadFileToR2 } from '@/lib/api-client'
import type { PostItem, PostType, TargetAudience } from '@pu/schemas'

import { ComposerProgressRing } from './composer-progress-ring'
import { ComposerAudienceMenu } from './composer-audience-menu'
import { ComposerIntentSelector } from './composer-intent-selector'
import { ComposerCoursePicker } from './composer-course-picker'
import { ComposerAttachmentPreview, type AttachedFile } from './composer-attachment-preview'
import { ComposerToolbar } from './composer-toolbar'

const MAX_CHAR_LIMIT = 1000

export function AcademicPostComposer() {
  const user = useAppStore((state) => state.user)
  const addPost = useAppStore((state) => state.addPost)

  // Expanded state
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)

  // Form states
  const [postType, setPostType] = useState<PostType>('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>()
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('everyone')
  const [tags, setTags] = useState<string[]>([])
  const [tagInputValue, setTagInputValue] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [slotsTotal, setSlotsTotal] = useState<number>(4)
  const [slotsFilled, setSlotsFilled] = useState<number>(1)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [uploadStatus, setUploadStatus] = useState<string>('')

  const textareaRef = useRef<HTMLTextAreaElement>(null)
  const composerRef = useRef<HTMLDivElement>(null)

  // Auto-resize textarea
  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto'
      textareaRef.current.style.height = `${Math.max(64, textareaRef.current.scrollHeight)}px`
    }
  }, [content, isExpanded])

  // Handle outside click to collapse if empty
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (composerRef.current && !composerRef.current.contains(e.target as Node)) {
        if (!content.trim() && !title.trim() && attachedFiles.length === 0 && tags.length === 0) {
          setIsExpanded(false)
          setIsPreviewMode(false)
          setShowTagInput(false)
        }
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [content, title, attachedFiles.length, tags.length])

  // Handle focus
  const handleFocus = () => {
    if (!isExpanded) {
      setIsExpanded(true)
    }
  }

  // Insert snippet text into textarea at current cursor
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

    // Reposition cursor
    setTimeout(() => {
      textarea.focus()
      textarea.setSelectionRange(start + snippet.length, start + snippet.length)
    }, 0)
  }

  // Handle adding local files
  const handleAddFiles = (fileList: FileList) => {
    const newFiles: AttachedFile[] = Array.from(fileList).map((file) => {
      const isImg = file.type.startsWith('image/')
      return {
        id: `file_${Date.now()}_${Math.random().toString(36).substr(2, 6)}`,
        name: file.name,
        size: file.size,
        type: isImg ? 'image' : 'document',
        url: URL.createObjectURL(file),
        file
      }
    })
    setAttachedFiles((prev) => [...prev, ...newFiles])
    setIsExpanded(true)
  }

  const handleRemoveFile = (id: string) => {
    setAttachedFiles((prev) => prev.filter((f) => f.id !== id))
  }

  // Handle tag additions
  const handleAddTag = (rawTag: string) => {
    const cleanTag = rawTag.trim().replace(/^[#,]/, '')
    if (cleanTag && !tags.includes(cleanTag)) {
      setTags((prev) => [...prev, cleanTag])
    }
  }

  const handleRemoveTag = (tagToRemove: string) => {
    setTags((prev) => prev.filter((t) => t !== tagToRemove))
  }

  const handleTagInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' || e.key === ',') {
      e.preventDefault()
      if (tagInputValue.trim()) {
        handleAddTag(tagInputValue)
        setTagInputValue('')
      }
    } else if (e.key === 'Backspace' && !tagInputValue && tags.length > 0) {
      setTags((prev) => prev.slice(0, -1))
    }
  }

  // Submit Post with Cloudflare R2 Uploads
  const handleSubmit = async () => {
    if (!content.trim()) {
      toast.error('Vui lòng nhập nội dung bài viết')
      return
    }

    if (content.length > MAX_CHAR_LIMIT) {
      toast.error(`Bài viết vượt quá giới hạn ${MAX_CHAR_LIMIT} ký tự`)
      return
    }

    setIsSubmitting(true)
    try {
      // 1. Upload files to Cloudflare R2
      const uploadedMediaUrls: string[] = []
      const uploadedDocUrls: string[] = []

      for (const item of attachedFiles) {
        if (item.file) {
          setUploadStatus(`Đang tải ${item.name} lên Cloudflare R2...`)
          const folder = item.type === 'image' ? 'posts/images' : 'documents'
          const res = await uploadFileToR2(item.file, folder)
          if (item.type === 'image') {
            uploadedMediaUrls.push(res.url)
          } else {
            uploadedDocUrls.push(res.url)
          }
        } else if (item.url && !item.url.startsWith('blob:')) {
          if (item.type === 'image') uploadedMediaUrls.push(item.url)
          else uploadedDocUrls.push(item.url)
        }
      }

      setUploadStatus('Đang lưu bài viết vào cơ sở dữ liệu...')

      const allTags = [...tags]
      if (selectedCourseId && !allTags.includes(selectedCourseId)) {
        allTags.unshift(selectedCourseId)
      }

      const payload = {
        title: title.trim() || undefined,
        content: content.trim(),
        postType,
        courseId: selectedCourseId || undefined,
        facultyCode: user?.faculty || undefined,
        targetAudience,
        tags: allTags,
        mediaUrls: uploadedMediaUrls,
        attachedDocumentIds: uploadedDocUrls,
        recruitSlotsTotal: postType === 'group_recruit' ? slotsTotal : undefined,
        recruitSlotsFilled: postType === 'group_recruit' ? slotsFilled : undefined
      }

      const response = await apiClient<{ success: boolean; data: PostItem }>('/posts', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response && response.data) {
        addPost(response.data)
        toast.success('Đã đăng bài viết và lưu trữ tệp lên Cloudflare R2 thành công!')
      }

      // Reset form
      setTitle('')
      setContent('')
      setSelectedCourseId(undefined)
      setTags([])
      setAttachedFiles([])
      setIsExpanded(false)
      setIsPreviewMode(false)
      setShowTagInput(false)
    } catch (err: any) {
      toast.error(err.message || 'Không thể đăng bài viết. Vui lòng thử lại.')
    } finally {
      setIsSubmitting(false)
      setUploadStatus('')
    }
  }

  const userInitials = (
    user?.displayName ||
    (user as any)?.display_name ||
    user?.username ||
    'PU'
  )
    .slice(0, 2)
    .toUpperCase()

  const placeholderText =
    postType === 'qa'
      ? 'Bạn đang thắc mắc bài tập hoặc đề thi học phần nào?...'
      : postType === 'document'
      ? 'Chia sẻ đề cương, tài liệu tham khảo hoặc slide bài giảng...'
      : postType === 'group_recruit'
      ? 'Mô tả đề tài đồ án, các kỹ năng cần thiết và số lượng thành viên...'
      : 'Chia sẻ thắc mắc học tập, kinh nghiệm học phần hoặc thông tin mới...'

  return (
    <div
      ref={composerRef}
      className={`rounded-2xl border bg-card transition-all duration-200 shadow-xs ${
        isExpanded
          ? 'border-border ring-1 ring-border p-4'
          : 'border-border hover:border-border/80 p-3.5'
      }`}
    >
      <div className="flex gap-3 items-start">
        {/* Left User Personal Avatar */}
        <Avatar className="h-10 w-10 shrink-0 rounded-full border border-border select-none shadow-xs">
          <AvatarImage src={user?.avatarUrl || (user as any)?.avatar || ''} alt={user?.displayName || 'User'} />
          <AvatarFallback className="bg-foreground text-background font-bold text-xs">
            {userInitials}
          </AvatarFallback>
        </Avatar>

        {/* Right Composer Body */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Expanded Top: Intent Selector + Course Picker */}
          {isExpanded && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/40">
              <ComposerIntentSelector value={postType} onChange={setPostType} />
              <ComposerCoursePicker
                selectedCourseId={selectedCourseId}
                onChange={setSelectedCourseId}
              />
            </div>
          )}

          {/* Optional Title Input for structured posts */}
          {isExpanded && (postType === 'qa' || postType === 'document' || postType === 'group_recruit') && (
            <div>
              <Input
                placeholder={
                  postType === 'qa'
                    ? 'Tiêu đề câu hỏi (Ví dụ: Cần giải thích giải thuật Dijkstra...)'
                    : postType === 'document'
                    ? 'Tên tài liệu / đề thi (Ví dụ: Đề thi Cuối kỳ Giải tích 1 năm 2024)'
                    : 'Tên đề tài đồ án PBL (Ví dụ: Xây dựng App Mobile với React Native)'
                }
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="h-9 font-semibold text-xs bg-muted/30 border-border text-foreground focus-visible:ring-1 focus-visible:ring-primary"
              />
            </div>
          )}

          {/* Group Recruit Extra Slots Fields */}
          {isExpanded && postType === 'group_recruit' && (
            <div className="flex items-center gap-3 p-2.5 rounded-xl bg-muted/40 border border-border text-xs">
              <Users className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="font-semibold text-foreground">Số thành viên:</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Đã có:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={slotsFilled}
                  onChange={(e) => setSlotsFilled(Number(e.target.value))}
                  className="w-12 h-6 rounded border border-border bg-background px-1.5 text-center text-xs font-bold text-foreground"
                />
              </div>
              <span className="text-muted-foreground">/</span>
              <div className="flex items-center gap-1.5">
                <span className="text-muted-foreground text-[11px]">Tổng slot:</span>
                <input
                  type="number"
                  min="1"
                  max="10"
                  value={slotsTotal}
                  onChange={(e) => setSlotsTotal(Number(e.target.value))}
                  className="w-12 h-6 rounded border border-border bg-background px-1.5 text-center text-xs font-bold text-foreground"
                />
              </div>
            </div>
          )}

          {/* Main Textarea / Live Preview Area */}
          <div className="relative">
            {isPreviewMode ? (
              <div className="min-h-[90px] max-h-[280px] overflow-y-auto rounded-xl border border-border bg-muted/20 p-3 text-xs">
                {content ? (
                  <MarkdownPreview content={content} />
                ) : (
                  <span className="text-muted-foreground italic">
                    Chưa có nội dung để xem trước...
                  </span>
                )}
              </div>
            ) : (
              <textarea
                ref={textareaRef}
                value={content}
                onChange={(e) => setContent(e.target.value)}
                onFocus={handleFocus}
                placeholder={placeholderText}
                rows={isExpanded ? 3 : 1}
                className="w-full resize-none bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed transition-all"
              />
            )}
          </div>

          {/* Attachment Preview Chips */}
          <ComposerAttachmentPreview
            files={attachedFiles}
            tags={tags}
            onRemoveFile={handleRemoveFile}
            onRemoveTag={handleRemoveTag}
          />

          {/* Expanded Inline Tag Input */}
          {isExpanded && showTagInput && (
            <div className="flex items-center gap-1.5 rounded-lg bg-muted/40 border border-border px-2.5 py-1">
              <Tag className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
              <input
                type="text"
                placeholder="Nhập thẻ tag và nhấn Enter (ví dụ: giua_ky, pbl, thay_phuong)..."
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
                autoFocus
              />
            </div>
          )}

          {/* Audience Selector (X-Style: "Everyone can reply") */}
          {isExpanded && (
            <div className="pt-0.5">
              <ComposerAudienceMenu
                value={targetAudience}
                onChange={setTargetAudience}
                facultyCode={user?.faculty || undefined}
                courseCode={selectedCourseId}
              />
            </div>
          )}

          {/* Bottom Action Bar: Toolbar on Left, Progress Ring & Post Button on Right */}
          <div className="flex items-center justify-between pt-2 border-t border-border/40">
            {/* Toolbar */}
            <ComposerToolbar
              onInsertText={handleInsertText}
              onAddFiles={handleAddFiles}
              onToggleTagInput={() => setShowTagInput((prev) => !prev)}
              showTagInput={showTagInput}
              isPreviewMode={isPreviewMode}
              onTogglePreview={() => setIsPreviewMode((prev) => !prev)}
            />

            {/* Right Controls: Progress Ring + Submit */}
            <div className="flex items-center gap-3">
              <ComposerProgressRing
                currentLength={content.length}
                maxLength={MAX_CHAR_LIMIT}
              />

              <Button
                type="button"
                size="sm"
                onClick={handleSubmit}
                disabled={isSubmitting || !content.trim() || content.length > MAX_CHAR_LIMIT}
                className="h-8 rounded-full px-5 text-xs font-bold bg-foreground text-background hover:bg-foreground/90 transition-all shadow-xs cursor-pointer disabled:opacity-40"
              >
                {isSubmitting ? (
                  <>
                    <Loader2 className="h-3.5 w-3.5 animate-spin mr-1" />
                    <span>{uploadStatus || 'Đang đăng...'}</span>
                  </>
                ) : (
                  <span>Đăng bài</span>
                )}
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
