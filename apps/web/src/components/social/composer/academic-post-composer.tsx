'use client'

import { FEATURES } from '@/lib/features'
import React, { useState, useRef, useEffect } from 'react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar'
import { MarkdownPreview } from '@/components/renderer/markdown-preview'
import { useAppStore } from '@/store'
import { useQueryClient } from '@tanstack/react-query'
import { onPostCreated as notifyPostCreated } from '@/lib/post-cache'
import { toast } from 'sonner'
import { Loader2, Sparkles, X, Users, Tag, BarChart2 } from 'lucide-react'
import { apiClient, uploadFileToR2, errorMessage } from '@/lib/api-client'
import type { PostItem, PostType, TargetAudience } from '@pu/schemas'

import { ComposerProgressRing } from './composer-progress-ring'
import { ComposerAudienceMenu } from './composer-audience-menu'
import { ComposerIntentSelector } from './composer-intent-selector'
import { ComposerCoursePicker } from './composer-course-picker'
import { ComposerAttachmentPreview, type AttachedFile } from './composer-attachment-preview'
import { ComposerToolbar } from './composer-toolbar'

const MAX_CHAR_LIMIT = 1000

interface AcademicPostComposerProps {
  onPostCreated?: (post: PostItem) => void
  defaultCommunityId?: string
  defaultCommunitySlug?: string
  // Trang học phần: gắn sẵn mã môn
  defaultCourseId?: string
}

export function AcademicPostComposer({
  onPostCreated,
  defaultCommunityId,
  defaultCommunitySlug,
  defaultCourseId
}: AcademicPostComposerProps = {}) {
  const user = useAppStore((state) => state.user)
  const queryClient = useQueryClient()

  // Expanded state
  const [isExpanded, setIsExpanded] = useState(false)
  const [isPreviewMode, setIsPreviewMode] = useState(false)
  const [showTagInput, setShowTagInput] = useState(false)
  const [showPollCreator, setShowPollCreator] = useState(false)

  // Form states
  const [postType, setPostType] = useState<PostType>('general')
  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [selectedCourseId, setSelectedCourseId] = useState<string | undefined>(defaultCourseId)
  const [targetAudience, setTargetAudience] = useState<TargetAudience>('everyone')
  const [tags, setTags] = useState<string[]>([])
  const [tagInputValue, setTagInputValue] = useState('')
  const [attachedFiles, setAttachedFiles] = useState<AttachedFile[]>([])
  const [slotsTotal, setSlotsTotal] = useState<number>(4)
  const [slotsFilled, setSlotsFilled] = useState<number>(1)
  const [pollQuestion, setPollQuestion] = useState('')
  const [pollOptions, setPollOptions] = useState<string[]>(['', ''])
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
        if (
          !content.trim() &&
          !title.trim() &&
          attachedFiles.length === 0 &&
          tags.length === 0 &&
          !showPollCreator
        ) {
          setIsExpanded(false)
          setIsPreviewMode(false)
          setShowTagInput(false)
        }
      }
    }
    document.addEventListener('mousedown', handleDocumentClick)
    return () => document.removeEventListener('mousedown', handleDocumentClick)
  }, [content, title, attachedFiles.length, tags.length, showPollCreator])

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

    if (showPollCreator) {
      const validOptions = pollOptions.filter((o) => o.trim())
      if (!pollQuestion.trim() || validOptions.length < 2) {
        toast.error('Vui lòng nhập câu hỏi và ít nhất 2 lựa chọn cho khảo sát')
        return
      }
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

      const validPollOptions = pollOptions.filter((o) => o.trim())

      const payload = {
        title: title.trim() || undefined,
        content: content.trim(),
        postType,
        courseId: selectedCourseId || undefined,
        communityId: defaultCommunityId,
        communitySlug: defaultCommunitySlug,
        facultyCode: user?.faculty || undefined,
        targetAudience,
        tags: allTags,
        mediaUrls: uploadedMediaUrls,
        attachedDocumentIds: uploadedDocUrls,
        recruitSlotsTotal: postType === 'group_recruit' ? slotsTotal : undefined,
        recruitSlotsFilled: postType === 'group_recruit' ? slotsFilled : undefined,
        pollQuestion: showPollCreator && pollQuestion.trim() ? pollQuestion.trim() : undefined,
        pollOptions: showPollCreator && validPollOptions.length >= 2 ? validPollOptions : undefined
      }

      const response = await apiClient<{ success: boolean; data: PostItem }>('/posts', {
        method: 'POST',
        body: JSON.stringify(payload)
      })

      if (response && response.data) {
        // Chèn vào mọi danh sách liên quan trong cache (feed, cộng đồng, hồ sơ)
        notifyPostCreated(queryClient, response.data, useAppStore.getState().user?.username)
        if (onPostCreated) {
          onPostCreated(response.data)
        }
        toast.success('Đã đăng bài viết')
      }

      // Reset form
      setTitle('')
      setContent('')
      setSelectedCourseId(defaultCourseId)
      setTags([])
      setAttachedFiles([])
      setShowPollCreator(false)
      setPollQuestion('')
      setPollOptions(['', ''])
      setIsExpanded(false)
      setIsPreviewMode(false)
      setShowTagInput(false)
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể đăng bài viết. Vui lòng thử lại.'))
    } finally {
      setIsSubmitting(false)
      setUploadStatus('')
    }
  }

  const userInitials = (
    user?.displayName ||
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
      : 'Có gì mới? Chia sẻ thắc mắc học tập, kinh nghiệm môn học...'

  return (
    <div
      ref={composerRef}
      className="transition-all duration-200"
    >
      <div className="flex gap-3 items-start">
        {/* Left User Personal Avatar */}
        <Avatar className="h-9 w-9 shrink-0 rounded-full border border-border/40 select-none">
          <AvatarImage src={user?.avatarUrl || ''} alt={user?.displayName || 'User'} />
          <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
            {userInitials}
          </AvatarFallback>
        </Avatar>

        {/* Right Composer Body */}
        <div className="flex-1 min-w-0 space-y-3">
          {/* Expanded Top: Intent Selector + Course Picker + Community Tag */}
          {isExpanded && (
            <div className="flex flex-wrap items-center justify-between gap-2 pb-1 border-b border-border/40">
              <div className="flex items-center gap-2 flex-wrap">
                <ComposerIntentSelector value={postType} onChange={setPostType} />
                {defaultCommunitySlug && (
                  <span className="text-xs font-mono font-bold text-primary bg-primary/10 border border-primary/20 px-2 py-0.5 rounded-full">
                    c/{defaultCommunitySlug}
                  </span>
                )}
              </div>
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

          {/* Poll Creator Box */}
          {isExpanded && showPollCreator && (
            <div className="rounded-xl border border-primary/30 bg-primary/[0.02] p-3 space-y-2.5">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-1.5 text-xs font-bold text-primary">
                  <BarChart2 className="h-4 w-4" />
                  <span>Tạo Khảo sát / Bình chọn sinh viên</span>
                </div>
                <button
                  type="button"
                  onClick={() => setShowPollCreator(false)}
                  className="text-muted-foreground hover:text-foreground cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
              <Input
                placeholder="Câu hỏi bình chọn (Ví dụ: Bạn muốn chọn đề tài nào?)..."
                value={pollQuestion}
                onChange={(e) => setPollQuestion(e.target.value)}
                className="h-8 text-xs bg-background"
              />
              <div className="space-y-1.5">
                {pollOptions.map((opt, idx) => (
                  <div key={idx} className="flex items-center gap-2">
                    <Input
                      placeholder={`Lựa chọn ${idx + 1}...`}
                      value={opt}
                      onChange={(e) => {
                        const next = [...pollOptions]
                        next[idx] = e.target.value
                        setPollOptions(next)
                      }}
                      className="h-8 text-xs bg-background flex-1"
                    />
                    {pollOptions.length > 2 && (
                      <button
                        type="button"
                        onClick={() => setPollOptions(pollOptions.filter((_, i) => i !== idx))}
                        className="text-muted-foreground hover:text-destructive p-1 cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                ))}
                {pollOptions.length < 5 && (
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setPollOptions([...pollOptions, ''])}
                    className="h-7 text-[11px] font-semibold text-primary border-primary/30 hover:bg-primary/5 cursor-pointer"
                  >
                    + Thêm lựa chọn
                  </Button>
                )}
              </div>
            </div>
          )}

          {/* Main Textarea / Live Preview Area */}
          <div className="relative">
            {isPreviewMode ? (
              <div className="min-h-[90px] max-h-[280px] overflow-y-auto rounded-xl border border-border/40 bg-muted/20 p-3 text-xs">
                {content ? (
                  <MarkdownPreview content={content} />
                ) : (
                  <span className="text-muted-foreground italic">
                    Chưa có nội dung để xem trước...
                  </span>
                )}
              </div>
            ) : (
              <div className="flex items-center justify-between gap-3">
                <textarea
                  ref={textareaRef}
                  value={content}
                  onChange={(e) => setContent(e.target.value)}
                  onFocus={handleFocus}
                  placeholder={placeholderText}
                  rows={isExpanded ? 3 : 1}
                  className="w-full resize-none bg-transparent text-xs sm:text-sm text-foreground placeholder:text-muted-foreground focus:outline-none leading-relaxed transition-all py-1"
                />
                {!isExpanded && (
                  <Button
                    type="button"
                    onClick={() => setIsExpanded(true)}
                    size="sm"
                    className="h-8 px-4 rounded-full font-semibold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shrink-0 cursor-pointer shadow-none"
                  >
                    Đăng
                  </Button>
                )}
              </div>
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
                value={tagInputValue}
                onChange={(e) => setTagInputValue(e.target.value)}
                onKeyDown={handleTagInputKeyDown}
                placeholder="Nhập thẻ hashtag và nhấn Enter (ví dụ: IT101, PostgreSQL)..."
                className="w-full bg-transparent text-xs text-foreground placeholder:text-muted-foreground focus:outline-none"
              />
            </div>
          )}

          {/* Expanded Bottom Toolbar & Submit Button */}
          {isExpanded && (
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-2.5 pt-2 border-t border-border/40">
              <ComposerToolbar
                onInsertText={handleInsertText}
                onAddFiles={handleAddFiles}
                onToggleTagInput={() => setShowTagInput((prev) => !prev)}
                onTogglePoll={() => setShowPollCreator((prev) => !prev)}
                showPoll={showPollCreator}
                isPreviewMode={isPreviewMode}
                onTogglePreview={() => setIsPreviewMode((prev) => !prev)}
                showTagInput={showTagInput}
              />

              <div className="flex items-center justify-between sm:justify-end gap-2 shrink-0">
                {/* Character Count Progress Ring */}
                <ComposerProgressRing currentLength={content.length} maxLength={MAX_CHAR_LIMIT} />

                {/* Audience Menu */}
                {FEATURES.postAudience && (
                  <ComposerAudienceMenu value={targetAudience} onChange={setTargetAudience} />
                )}

                {/* Submit Button */}
                <Button
                  onClick={handleSubmit}
                  disabled={!content.trim() || isSubmitting || content.length > MAX_CHAR_LIMIT}
                  size="sm"
                  className="gap-1.5 font-bold text-xs bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-full transition-all cursor-pointer"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="h-3.5 w-3.5 animate-spin" />
                      <span>{uploadStatus ? 'Đang lưu...' : 'Đang đăng...'}</span>
                    </>
                  ) : (
                    <>
                      <Sparkles className="h-3.5 w-3.5" />
                      <span>Đăng bài</span>
                    </>
                  )}
                </Button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
