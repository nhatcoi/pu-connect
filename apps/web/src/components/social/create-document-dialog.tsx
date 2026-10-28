'use client'

import { CourseSelect } from '@/components/documents/course-select'
import React, { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { FileUp, Loader2, Paperclip, Sparkles, X } from 'lucide-react'
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory, type DocumentItem } from '@pu/schemas'
import { apiClient, errorMessage, uploadFileToR2 } from '@/lib/api-client'
import { suggestUploadedFile } from '@/lib/document-api'
import { useCourses } from '@/hooks/use-course'
import { queryKeys } from '@/lib/query-keys'
import { cn } from '@/lib/utils'

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const SELECT = 'w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring'
const MAX_FILES = 10

interface Item {
  key: string
  file: File
  title: string
  category: DocCategory | ''
  status: 'idle' | 'uploading' | 'error'
  error?: string
  uploaded?: { url: string; size: number } // đã tải lên R2 (khi nhờ N7AI đọc tệp) ⇒ lúc lưu không tải lại
  suggesting?: boolean
}

const titleOf = (name: string) => name.replace(/\.[A-Za-z0-9]{1,8}$/, '').replace(/_+/g, ' ')

// Chia sẻ tài liệu thẳng vào kho môn học (không qua bài viết): chọn nhiều tệp (tối đa MAX_FILES) dùng chung môn học;
// mỗi tệp sửa được tên + loại. Tải lên R2 rồi tạo tài liệu lần lượt; tệp lỗi được giữ lại để thử lại.
export function CreateDocumentDialog({ open, onOpenChange, onSuccess }: CreateDocumentDialogProps) {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const { data: courses = [] } = useCourses()
  // Mở từ trang môn học ⇒ gắn sẵn môn đó
  const routeCode = decodeURIComponent(pathname.match(/^\/courses\/([^/]+)/)?.[1] ?? '')
  const routeCourse = courses.find((c) => c.code.toLowerCase() === routeCode.toLowerCase())

  const inputRef = useRef<HTMLInputElement>(null)
  const [items, setItems] = useState<Item[]>([])
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [category, setCategory] = useState<DocCategory | ''>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const effectiveCourseId = courseId || routeCourse?.id || ''

  const patch = (key: string, next: Partial<Item>) => setItems((list) => list.map((i) => (i.key === key ? { ...i, ...next } : i)))

  const pickFiles = (picked: FileList | null) => {
    if (!picked?.length) return
    const room = MAX_FILES - items.length
    if (picked.length > room) toast.info(`Tối đa ${MAX_FILES} tệp một lần`)
    const added = [...picked].slice(0, Math.max(room, 0)).map((file) => ({
      key: `${file.name}-${file.size}-${file.lastModified}-${Math.random().toString(36).slice(2, 7)}`,
      file,
      title: titleOf(file.name),
      category,
      status: 'idle' as const
    }))
    setItems((list) => [...list, ...added])
    if (inputRef.current) inputRef.current.value = ''
  }

  // Chọn loại chung ⇒ áp cho mọi tệp; từng tệp vẫn đổi riêng được
  const changeCategory = (next: DocCategory | '') => {
    setCategory(next)
    setItems((list) => list.map((i) => ({ ...i, category: next })))
  }

  // N7AI đọc tệp (tải lên R2 một lần, dùng lại khi lưu) rồi điền tên + loại của tệp; môn chung chỉ điền nếu chưa chọn
  const suggestFor = async (item: Item): Promise<boolean> => {
    patch(item.key, { suggesting: true })
    try {
      const uploaded = item.uploaded ?? (await uploadFileToR2(item.file, 'documents'))
      const s = await suggestUploadedFile({ fileUrl: uploaded.url, fileName: item.file.name, mimeType: item.file.type || 'application/octet-stream' })
      patch(item.key, { uploaded, ...(s.title ? { title: s.title } : {}), ...(s.docCategory ? { category: s.docCategory } : {}) })
      if (s.courseId) setCourseId((cur) => cur || routeCourse?.id || s.courseId!)
      return !!(s.title || s.docCategory || s.courseId)
    } catch (err) {
      toast.error(errorMessage(err, 'N7AI chưa gợi ý được'))
      return false
    } finally {
      patch(item.key, { suggesting: false })
    }
  }

  const suggestOne = async (item: Item) => {
    if (await suggestFor(item)) toast.success('N7AI đã điền gợi ý — kiểm tra lại trước khi lưu')
    else toast.info('N7AI chưa đủ thông tin để phân loại tệp này')
  }

  // Lần lượt từng tệp (mỗi tệp 1 lượt N7AI)
  const suggestAll = async () => {
    let filled = 0
    for (const item of items) if (await suggestFor(item)) filled++
    toast[filled ? 'success' : 'info'](filled ? `N7AI đã điền ${filled}/${items.length} tệp — kiểm tra lại trước khi lưu` : 'N7AI chưa đủ thông tin để phân loại')
  }

  const busy = isSubmitting || items.some((i) => i.suggesting)

  const reset = () => {
    setItems([])
    setDescription('')
    setCourseId('')
    setCategory('')
  }

  const handleSubmit = async () => {
    if (!items.length) return toast.error('Chọn tệp tài liệu')
    if (!effectiveCourseId) return toast.error('Chọn môn học')
    if (items.some((i) => !i.title.trim())) return toast.error('Mỗi tài liệu cần có tên')
    if (items.some((i) => !i.category)) return toast.error('Chọn loại cho mọi tài liệu')

    setIsSubmitting(true)
    let done = 0
    const failed = new Set<string>()
    for (const item of items) {
      patch(item.key, { status: 'uploading', error: undefined })
      try {
        const uploaded = item.uploaded ?? (await uploadFileToR2(item.file, 'documents'))
        await apiClient<{ success: boolean; data: DocumentItem }>('/documents', {
          method: 'POST',
          body: JSON.stringify({
            title: item.title.trim(),
            description: description.trim() || undefined,
            courseId: effectiveCourseId,
            docCategory: item.category,
            fileUrl: uploaded.url,
            fileSize: uploaded.size,
            mimeType: item.file.type || 'application/octet-stream',
            visibility: 'public'
          })
        })
        done++
      } catch (err) {
        failed.add(item.key)
        patch(item.key, { status: 'error', error: errorMessage(err, 'Không thể lưu tài liệu') })
      }
    }
    setIsSubmitting(false)

    if (done > 0) {
      const code = courses.find((c) => c.id === effectiveCourseId)?.code
      if (code) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.courseDocuments(code) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.course(code) })
      }
      onSuccess?.()
    }
    if (failed.size === 0) {
      toast.success(done > 1 ? `Đã đưa ${done} tài liệu vào kho môn học` : 'Đã đưa tài liệu vào kho môn học')
      reset()
      onOpenChange(false)
    } else {
      // Giữ lại tệp lỗi để thử lại
      setItems((list) => list.filter((i) => failed.has(i.key)))
      toast.error(`Đã đưa ${done}/${done + failed.size} tài liệu, ${failed.size} tệp lỗi — bấm lại để thử lại`)
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !isSubmitting && onOpenChange(v)}>
      <DialogContent className="max-w-lg p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileUp className="h-4 w-4 text-primary" />
            Chia sẻ tài liệu vào kho môn học
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <input ref={inputRef} type="file" multiple className="hidden" onChange={(e) => pickFiles(e.target.files)} />
          <button
            type="button"
            disabled={isSubmitting || items.length >= MAX_FILES}
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-left hover:bg-muted/40 cursor-pointer disabled:cursor-not-allowed disabled:opacity-50"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground">
              {items.length ? `Thêm tệp (${items.length}/${MAX_FILES})` : `Chọn tệp (PDF, Word, PowerPoint, Excel, ZIP…, tối đa 50MB mỗi tệp, ${MAX_FILES} tệp)`}
            </span>
          </button>

          {items.length > 1 && (
            <button
              type="button"
              onClick={() => void suggestAll()}
              disabled={busy}
              className="inline-flex items-center gap-1.5 rounded-full border border-primary/30 px-3 py-1.5 text-[11px] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60 cursor-pointer"
            >
              {items.some((i) => i.suggesting) ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Sparkles className="h-3.5 w-3.5" />}
              N7AI điền tất cả ({items.length} tệp, {items.length} lượt)
            </button>
          )}

          {items.length > 0 && (
            <ul className="max-h-52 space-y-2 overflow-y-auto pr-1">
              {items.map((i) => (
                <li key={i.key} className="rounded-lg border border-border p-2">
                  <div className="flex items-center gap-2">
                    <Input
                      aria-label="Tên tài liệu"
                      value={i.title}
                      disabled={isSubmitting}
                      onChange={(e) => patch(i.key, { title: e.target.value })}
                      className="h-8 flex-1 bg-background text-xs text-foreground"
                    />
                    <button
                      type="button"
                      onClick={() => void suggestOne(i)}
                      disabled={busy}
                      title="N7AI đọc tệp và điền tên, loại tài liệu (và môn học nếu chưa chọn)"
                      className="inline-flex shrink-0 items-center gap-1 rounded-full border border-primary/30 px-2 py-1 text-[10px] font-semibold text-primary transition-colors hover:bg-primary/5 disabled:opacity-60 cursor-pointer"
                    >
                      {i.suggesting ? <Loader2 className="h-3 w-3 animate-spin" /> : <Sparkles className="h-3 w-3" />}
                      N7AI
                    </button>
                    {i.status === 'uploading' ? (
                      <Loader2 className="h-4 w-4 shrink-0 animate-spin text-muted-foreground" />
                    ) : (
                      <button
                        type="button"
                        aria-label="Bỏ tệp"
                        disabled={isSubmitting}
                        onClick={() => setItems((list) => list.filter((x) => x.key !== i.key))}
                        className="shrink-0 rounded-full p-1 text-muted-foreground hover:bg-muted cursor-pointer"
                      >
                        <X className="h-3.5 w-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="mt-1.5 flex items-center gap-2">
                    <select
                      aria-label="Loại tài liệu"
                      value={i.category}
                      disabled={isSubmitting}
                      onChange={(e) => patch(i.key, { category: e.target.value as DocCategory | '' })}
                      className={cn(SELECT, 'h-8 w-44 py-1')}
                    >
                      <option value="">Chọn loại</option>
                      {DOC_CATEGORIES.map((k) => (
                        <option key={k} value={k}>
                          {DOC_CATEGORY_LABELS[k]}
                        </option>
                      ))}
                    </select>
                    <span className={cn('min-w-0 flex-1 truncate text-[11px]', i.status === 'error' ? 'text-destructive' : 'text-muted-foreground')}>
                      {i.status === 'error' ? i.error : i.file.name}
                    </span>
                  </div>
                </li>
              ))}
            </ul>
          )}

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Môn học</label>
              <CourseSelect courses={courses} value={effectiveCourseId} onChange={setCourseId} placeholder="Chọn môn" className="w-full h-9" />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">{items.length > 1 ? 'Loại (áp cho tất cả)' : 'Loại tài liệu'}</label>
              <select value={category} disabled={isSubmitting} onChange={(e) => changeCategory(e.target.value as DocCategory | '')} className={SELECT}>
                <option value="">Chọn loại</option>
                {DOC_CATEGORIES.map((k) => (
                  <option key={k} value={k}>
                    {DOC_CATEGORY_LABELS[k]}
                  </option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Mô tả (tùy chọn)</label>
            <Input placeholder="Có đáp án chi tiết câu 1–5..." value={description} disabled={isSubmitting} onChange={(e) => setDescription(e.target.value)} className="bg-background text-foreground" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={busy || items.length === 0} className="gap-1.5 bg-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>{items.length > 1 ? `Đưa ${items.length} tài liệu vào kho` : 'Đưa vào kho'}</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
