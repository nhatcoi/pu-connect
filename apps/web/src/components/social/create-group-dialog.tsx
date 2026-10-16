'use client'

import React, { useState } from 'react'
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { toast } from 'sonner'
import { Users, Loader2 } from 'lucide-react'
import { apiClient, errorMessage } from '@/lib/api-client'
import type { StudyGroup } from '@pu/schemas'

interface CreateGroupDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  onSuccess?: () => void
}

export function CreateGroupDialog({ open, onOpenChange, onSuccess }: CreateGroupDialogProps) {
  const [name, setName] = useState('')
  const [courseCode, setCourseCode] = useState('')
  const [topic, setTopic] = useState('')
  const [description, setDescription] = useState('')
  const [techStackInput, setTechStackInput] = useState('')
  const [maxMembers, setMaxMembers] = useState(5)
  const [isSubmitting, setIsSubmitting] = useState(false)

  const handleSubmit = async () => {
    if (!name.trim() || !description.trim() || !topic.trim()) {
      toast.error('Vui lòng điền đầy đủ tên nhóm, chủ đề và mô tả')
      return
    }

    const techStack = techStackInput
      .split(',')
      .map((t) => t.trim())
      .filter(Boolean)

    setIsSubmitting(true)
    try {
      const response = await apiClient<{ success: boolean; data: StudyGroup }>('/study-groups', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          courseCode: courseCode.trim().toUpperCase() || undefined,
          topic: topic.trim(),
          description: description.trim(),
          techStack,
          maxMembers: Number(maxMembers) || 5
        })
      })

      if (response && response.data) {
        toast.success('Đã tạo nhóm đồ án')
      }

      setName('')
      setCourseCode('')
      setTopic('')
      setDescription('')
      setTechStackInput('')
      onOpenChange(false)
      onSuccess?.()
    } catch (err) {
      toast.error(errorMessage(err, 'Không thể tạo nhóm'))
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md p-6 gap-4">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base font-bold text-foreground">
            <Users className="h-4 w-4 text-primary" />
            Tạo nhóm đồ án và PBL mới
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-3 py-2 text-xs">
          <div>
            <label className="font-semibold block mb-1 text-foreground">Tên nhóm</label>
            <Input
              placeholder="Ví dụ: Nhóm làm Đồ án PBL3: App Phenikaa"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-background text-foreground"
            />
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div>
              <label className="font-semibold block mb-1 text-foreground">Mã môn học</label>
              <Input
                placeholder="Ví dụ: IT305, MATH201"
                value={courseCode}
                onChange={(e) => setCourseCode(e.target.value)}
                className="bg-background text-foreground"
              />
            </div>
            <div>
              <label className="font-semibold block mb-1 text-foreground">Số lượng thành viên tối đa</label>
              <Input
                type="number"
                min={2}
                max={15}
                value={maxMembers}
                onChange={(e) => setMaxMembers(Number(e.target.value))}
                className="bg-background text-foreground"
              />
            </div>
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Chủ đề và đề tài</label>
            <Input
              placeholder="Ví dụ: PBL3 Đồ án Phần mềm, Ôn thi cuối kỳ..."
              value={topic}
              onChange={(e) => setTopic(e.target.value)}
              className="bg-background text-foreground"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Kỹ năng cần tuyển</label>
            <Input
              placeholder="React Native, NestJS, PostgreSQL..."
              value={techStackInput}
              onChange={(e) => setTechStackInput(e.target.value)}
              className="bg-background text-foreground"
            />
          </div>

          <div>
            <label className="font-semibold block mb-1 text-foreground">Mô tả chi tiết yêu cầu</label>
            <textarea
              rows={3}
              placeholder="Mô tả mục tiêu nhóm, vai trò cần tìm..."
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="w-full rounded-md border border-input bg-background p-2 text-xs text-foreground outline-none focus:ring-1 focus:ring-ring"
            />
          </div>
        </div>

        <DialogFooter className="gap-2 sm:gap-0">
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isSubmitting}>
            Hủy
          </Button>
          <Button onClick={handleSubmit} disabled={isSubmitting} className="gap-1.5 bg-primary text-primary-foreground">
            {isSubmitting && <Loader2 className="h-4 w-4 animate-spin" />}
            <span>Tạo nhóm</span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
