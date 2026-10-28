'use client'

import React, { useState } from 'react'
import { Loader2 } from 'lucide-react'
import { toast } from 'sonner'
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { useUnits } from '@/hooks/use-units'
import { useMyCourseSuggestions, useSuggestCourse } from '@/hooks/use-course-suggestions'
import { errorMessage } from '@/lib/api-client'
import { formatRelativeTime } from '@/lib/utils'

const STATUS_LABEL = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Từ chối' } as const
const FIELD = 'w-full rounded-md border border-input bg-background px-3 py-2 text-xs text-foreground outline-none focus:border-primary'

// Đề xuất môn học còn thiếu: admin duyệt mới thành môn thật
export function SuggestCourseDialog({ open, onOpenChange }: { open: boolean; onOpenChange: (open: boolean) => void }) {
  const { data: units } = useUnits()
  const fields = units?.fields ?? []
  const { data: mine = [] } = useMyCourseSuggestions(open)
  const suggest = useSuggestCourse()
  const [name, setName] = useState('')
  const [fieldId, setFieldId] = useState('')
  const [note, setNote] = useState('')

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    suggest.mutate(
      { name: name.trim(), fieldId: fieldId || undefined, note: note.trim() || undefined },
      {
        onSuccess: () => {
          toast.success('Đã gửi đề xuất, admin sẽ xem xét')
          setName('')
          setNote('')
        },
        onError: (err) => toast.error(errorMessage(err, 'Không gửi được đề xuất'))
      }
    )
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md gap-4 p-6">
        <DialogHeader>
          <DialogTitle className="text-base font-bold">Đề xuất môn học</DialogTitle>
          <DialogDescription className="text-xs">Không thấy môn của bạn trong danh mục? Gửi đề xuất, admin duyệt xong môn sẽ xuất hiện để chọn khi đăng tài liệu.</DialogDescription>
        </DialogHeader>

        <form id="suggest-course" onSubmit={submit} className="space-y-3 text-xs">
          <div>
            <label className="mb-1 block font-semibold">Tên môn học</label>
            <Input required minLength={3} maxLength={150} value={name} onChange={(e) => setName(e.target.value)} placeholder="Vd. An toàn thông tin" className="text-xs" />
          </div>
          <div>
            <label className="mb-1 block font-semibold">Lĩnh vực (nếu biết)</label>
            <select value={fieldId} onChange={(e) => setFieldId(e.target.value)} className={FIELD}>
              <option value="">Chưa rõ</option>
              {fields.map((f) => (
                <option key={f.id} value={f.id}>
                  {f.name}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="mb-1 block font-semibold">Ghi chú</label>
            <Input maxLength={500} value={note} onChange={(e) => setNote(e.target.value)} placeholder="Mã môn, giảng viên, học kỳ… (tùy chọn)" className="text-xs" />
          </div>
        </form>

        {mine.length > 0 && (
          <div className="space-y-1.5 border-t border-border pt-3">
            <p className="text-[11px] font-semibold text-muted-foreground">Đề xuất của bạn</p>
            <ul className="max-h-40 space-y-1.5 overflow-y-auto text-xs">
              {mine.map((s) => (
                <li key={s.id} className="flex items-start justify-between gap-3">
                  <span className="min-w-0">
                    <span className="block truncate font-medium">{s.name}</span>
                    {s.status === 'rejected' && s.reviewNote && <span className="block text-[11px] text-muted-foreground">Lý do: {s.reviewNote}</span>}
                    {s.status === 'pending' && <span className="block text-[11px] text-muted-foreground">{formatRelativeTime(s.createdAt)}</span>}
                  </span>
                  <span className="shrink-0 text-[11px] text-muted-foreground">{STATUS_LABEL[s.status]}</span>
                </li>
              ))}
            </ul>
          </div>
        )}

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Đóng
          </Button>
          <Button type="submit" form="suggest-course" disabled={suggest.isPending || name.trim().length < 3} className="gap-1.5">
            {suggest.isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Gửi đề xuất
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
