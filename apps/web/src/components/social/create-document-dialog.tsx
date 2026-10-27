'use client'

import { CourseSelect } from '@/components/documents/course-select'
import React, { useRef, useState } from 'react'
import { usePathname } from 'next/navigation'
import { useQueryClient } from '@tanstack/react-query'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { FileUp, Loader2, Paperclip } from 'lucide-react'
import { DOC_CATEGORIES, DOC_CATEGORY_LABELS, type DocCategory, type DocumentItem } from '@pu/schemas'
import { apiClient, errorMessage, uploadFileToR2 } from '@/lib/api-client'
import { useCourses } from '@/hooks/use-course'
import { queryKeys } from '@/lib/query-keys'

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

const SELECT = 'w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring'

// Chia sẻ tài liệu thẳng vào kho môn học (không qua bài viết): tải tệp lên R2 rồi tạo tài liệu đã phân loại
export function CreateDocumentDialog({ open, onOpenChange, onSuccess }: CreateDocumentDialogProps) {
  const queryClient = useQueryClient()
  const pathname = usePathname()
  const { data: courses = [] } = useCourses()
  // Mở từ trang môn học ⇒ gắn sẵn môn đó
  const routeCode = decodeURIComponent(pathname.match(/^\/courses\/([^/]+)/)?.[1] ?? '')
  const routeCourse = courses.find((c) => c.code.toLowerCase() === routeCode.toLowerCase())

  const inputRef = useRef<HTMLInputElement>(null)
  const [file, setFile] = useState<File | null>(null)
  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [courseId, setCourseId] = useState('')
  const [category, setCategory] = useState<DocCategory | ''>('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const effectiveCourseId = courseId || routeCourse?.id || ''

  const pickFile = (f: File | undefined) => {
    if (!f) return
    setFile(f)
    if (!title.trim()) setTitle(f.name.replace(/\.[A-Za-z0-9]{1,8}$/, '').replace(/_+/g, ' '))
  }

  const reset = () => {
    setFile(null)
    setTitle('')
    setDescription('')
    setCourseId('')
    setCategory('')
  }

  const handleSubmit = async () => {
    if (!file) return toast.error('Chọn tệp tài liệu')
    if (!title.trim()) return toast.error('Vui lòng nhập tên tài liệu')
    if (!effectiveCourseId || !category) return toast.error('Chọn môn học và loại tài liệu')

    setIsSubmitting(true)
    try {
      const uploaded = await uploadFileToR2(file, 'documents')
      await apiClient<{ success: boolean; data: DocumentItem }>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          courseId: effectiveCourseId,
          docCategory: category,
          fileUrl: uploaded.url,
          fileSize: uploaded.size,
          mimeType: file.type || 'application/octet-stream',
          visibility: 'public'
        })
      })
      const code = courses.find((c) => c.id === effectiveCourseId)?.code
      if (code) {
        void queryClient.invalidateQueries({ queryKey: queryKeys.courseDocuments(code) })
        void queryClient.invalidateQueries({ queryKey: queryKeys.course(code) })
      }
      toast.success('Đã đưa tài liệu vào kho môn học')
      reset()
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể lưu tài liệu'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <FileUp className="h-4 w-4 text-primary" />
            Chia sẻ tài liệu vào kho môn học
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <input ref={inputRef} type="file" className="hidden" onChange={(e) => pickFile(e.target.files?.[0])} />
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            className="flex w-full items-center gap-2 rounded-xl border border-dashed border-border px-3 py-3 text-left hover:bg-muted/40 cursor-pointer"
          >
            <Paperclip className="h-4 w-4 shrink-0 text-muted-foreground" />
            <span className="truncate text-foreground">{file ? file.name : 'Chọn tệp (PDF, Word, PowerPoint, Excel, ZIP…, tối đa 50MB)'}</span>
          </button>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Tên tài liệu</label>
            <Input placeholder="Đề thi cuối kỳ Cấu trúc dữ liệu 2025" value={title} onChange={(e) => setTitle(e.target.value)} className="bg-background text-foreground" />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Môn học</label>
              <CourseSelect courses={courses} value={effectiveCourseId} onChange={setCourseId} placeholder="Chọn môn" className="w-full h-9" />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Loại tài liệu</label>
              <select value={category} onChange={(e) => setCategory(e.target.value as DocCategory | '')} className={SELECT}>
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
            <Input placeholder="Có đáp án chi tiết câu 1–5..." value={description} onChange={(e) => setDescription(e.target.value)} className="bg-background text-foreground" />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5 bg-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Đưa vào kho</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
