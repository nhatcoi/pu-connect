'use client'

import React, { useState } from 'react'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter
} from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Textarea } from '@/components/ui/textarea'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { ShieldAlert, Loader2 } from 'lucide-react'

interface ReportPostDialogProps {
  postId: string
  open: boolean
  onOpenChange: (open: boolean) => void
}

const REPORT_REASONS = [
  { id: 'spam', label: 'Spam / Nội dung quảng cáo rác' },
  { id: 'exam_leak', label: 'Lộ đề thi / Tài liệu cấm của nhà trường' },
  { id: 'harassment', label: 'Công kích cá nhân / Ngôn từ không phù hợp' },
  { id: 'inaccurate_info', label: 'Thông tin học thuật sai lệch nghiêm trọng' },
  { id: 'other', label: 'Lý do khác' }
]

export function ReportPostDialog({ postId, open, onOpenChange }: ReportPostDialogProps) {
  const [selectedReason, setSelectedReason] = useState<string>('spam')
  const [details, setDetails] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSubmitting(true)
    try {
      await apiClient(`/posts/${postId}/report`, {
        method: 'POST',
        body: JSON.stringify({
          reason: selectedReason,
          details: details.trim() || undefined
        })
      })

      toast.success('Báo cáo vi phạm đã được gửi đến Ban Quản trị')
      onOpenChange(false)
      setDetails('')
    } catch (err: any) {
      toast.error('Không thể gửi báo cáo vi phạm')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-6 gap-4">
        <DialogHeader>
          <div className="flex items-center gap-2 text-destructive">
            <ShieldAlert className="h-5 w-5" />
            <DialogTitle>Báo cáo vi phạm bài viết</DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground">
            Báo cáo của bạn giúp duy trì môi trường học tập văn minh, chuẩn mực tại Đại học Phenikaa.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4 py-2">
          <div className="space-y-2">
            <label className="text-xs font-semibold text-foreground">Lý do báo cáo *</label>
            <div className="space-y-1.5">
              {REPORT_REASONS.map((reason) => (
                <label
                  key={reason.id}
                  className="flex items-center gap-2.5 rounded-lg border border-border/70 p-2.5 text-xs transition-colors hover:bg-muted/40 cursor-pointer"
                >
                  <input
                    type="radio"
                    name="reportReason"
                    value={reason.id}
                    checked={selectedReason === reason.id}
                    onChange={(e) => setSelectedReason(e.target.value)}
                    className="accent-primary"
                  />
                  <span>{reason.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-muted-foreground">Mô tả chi tiết (Tùy chọn)</label>
            <Textarea
              value={details}
              onChange={(e) => setDetails(e.target.value)}
              rows={3}
              placeholder="Cung cấp thêm ngữ cảnh cho Ban Quản trị..."
            />
          </div>

          <DialogFooter className="pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isSubmitting}
            >
              Hủy
            </Button>
            <Button type="submit" variant="destructive" disabled={isSubmitting} className="gap-2">
              {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
              Gửi báo cáo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  )
}
