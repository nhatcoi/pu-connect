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
import { useAppStore } from '@/store'
import { toast } from 'sonner'
import { FileUp, Loader2 } from 'lucide-react'
import { apiClient, errorMessage } from '@/lib/api-client'
import type { DocumentItem } from '@pu/schemas'

interface CreateDocumentDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateDocumentDialog({ open, onOpenChange, onSuccess }: CreateDocumentDialogProps) {
  const addDocument = useAppStore((state) => state.addDocument)

  const [title, setTitle] = useState('')
  const [description, setDescription] = useState('')
  const [type, setType] = useState<'pdf' | 'code' | 'sheet' | 'markdown'>('pdf')
  const [fileUrl, setFileUrl] = useState('')
  const [tagInput, setTagInput] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!title.trim()) {
      toast.error('Vui lòng nhập tên tài liệu hoặc đề thi')
      return
    }

    const tags = tagInput
      .split(',')
      .map((t) => t.trim().toLowerCase())
      .filter(Boolean)

    setIsSubmitting(true)
    try {
      const response = await apiClient<{ success: boolean; data: DocumentItem }>('/documents', {
        method: 'POST',
        body: JSON.stringify({
          title: title.trim(),
          description: description.trim() || undefined,
          type,
          fileUrl: fileUrl.trim() || 'https://storage.puconnector.com/docs/' + encodeURIComponent(title),
          fileSize: 1024 * 1024 * 2,
          mimeType: type === 'pdf' ? 'application/pdf' : 'text/plain',
          tags,
          visibility: 'public'
        })
      })

      if (response && response.data) {
        addDocument(response.data)
        toast.success('Đã đăng tài liệu')
      }

      setTitle('')
      setDescription('')
      setFileUrl('')
      setTagInput('')
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
            Thêm tài liệu và đề thi học phần
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-foreground">Tên tài liệu hoặc mã đề thi</label>
            <Input
              placeholder="Ví dụ: De_thi_Cuoi_Ky_IT101_Cau_truc_du_lieu_2025.pdf"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="bg-background text-foreground"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Mô tả tóm tắt</label>
            <Input
              placeholder="Tổng hợp đề thi và đáp án chi tiết..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="bg-background text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Định dạng</label>
              <select
                value={type}
                onChange={(e) => setType(e.target.value as typeof type)}
                className="w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
              >
                <option value="pdf">Tệp PDF</option>
                <option value="code">Mã nguồn (Code)</option>
                <option value="sheet">Bảng tính (Excel/Sheet)</option>
                <option value="markdown">Văn bản Markdown</option>
              </select>
            </div>

            <div>
              <label className="font-semibold block mb-1 text-foreground">Thẻ tags (Mã môn)</label>
              <Input
                placeholder="it101, math201, dethi"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                className="bg-background text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Đường dẫn tệp</label>
            <Input
              placeholder="https://..."
              value={fileUrl}
              onChange={(e) => setFileUrl(e.target.value)}
              className="bg-background text-foreground"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5 bg-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Lưu tài liệu</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
