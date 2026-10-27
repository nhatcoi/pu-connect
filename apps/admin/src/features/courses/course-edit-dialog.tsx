import React, { useEffect, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { GitMerge, Trash2, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCourseInput, AdminCourseLecturer, AdminCourseRow, AdminPage } from '@pu/schemas'
import { adminApi } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import { Avatar, Button, ConfirmDialog, Dialog, Field, Input, Textarea } from '@/components/ui'

const toInput = (c: AdminCourseRow): AdminCourseInput => ({
  code: c.code,
  name: c.name,
  credits: c.credits,
  facultyCode: c.facultyCode ?? '',
  description: c.description ?? '',
  syllabusUrl: c.syllabusUrl ?? ''
})

export function CourseEditDialog({ course, onClose }: { course: AdminCourseRow | null; onClose: () => void }) {
  const qc = useQueryClient()
  const [form, setForm] = useState<AdminCourseInput | null>(null)
  const [lecturers, setLecturers] = useState<AdminCourseLecturer[]>([])
  const [lq, setLq] = useState('')
  const [mq, setMq] = useState('')
  const [mergeInto, setMergeInto] = useState<AdminCourseRow | null>(null)
  const [confirmDelete, setConfirmDelete] = useState(false)
  const dl = useDebounced(lq, 300)
  const dm = useDebounced(mq, 300)

  const current = useQuery({
    queryKey: ['admin', 'course-lecturers', course?.id],
    queryFn: () => adminApi.get<AdminCourseLecturer[]>(`/admin/courses/${course!.id}/lecturers`),
    enabled: !!course
  })
  const candidates = useQuery({
    queryKey: ['admin', 'lecturer-candidates', dl],
    queryFn: () => adminApi.get<AdminCourseLecturer[]>(`/admin/courses/lecturer-candidates?q=${encodeURIComponent(dl)}`),
    enabled: !!course && dl.length > 0
  })
  const targets = useQuery({
    queryKey: ['admin', 'merge-targets', dm],
    queryFn: () => adminApi.get<AdminPage<AdminCourseRow>>(`/admin/courses?q=${encodeURIComponent(dm)}&pageSize=6`),
    enabled: !!course && dm.length > 0
  })

  useEffect(() => {
    if (!course) return
    setForm(toInput(course))
    setLq('')
    setMq('')
    setMergeInto(null)
  }, [course])
  useEffect(() => {
    if (current.data) setLecturers(current.data)
  }, [current.data])

  const done = (msg: string) => () => {
    toast.success(msg)
    void qc.invalidateQueries({ queryKey: ['admin'] })
    onClose()
  }
  const onError = (err: Error) => toast.error(err.message)

  const save = useMutation({
    mutationFn: async () => {
      await adminApi.patch(`/admin/courses/${course!.id}`, form)
      await adminApi.put(`/admin/courses/${course!.id}/lecturers`, { userIds: lecturers.map((l) => l.id) })
    },
    onSuccess: done('Đã lưu học phần'),
    onError
  })
  const merge = useMutation({
    mutationFn: () => adminApi.post(`/admin/courses/${course!.id}/merge`, { intoId: mergeInto!.id }),
    onSuccess: done('Đã gộp học phần'),
    onError
  })
  const remove = useMutation({
    mutationFn: () => adminApi.delete(`/admin/courses/${course!.id}`),
    onSuccess: done('Đã xóa học phần'),
    onError
  })

  if (!course || !form) return null
  const picked = new Set(lecturers.map((l) => l.id))

  return (
    <>
      <Dialog
        open
        onClose={onClose}
        title={`Học phần ${course.code}`}
        size="lg"
        footer={
          <>
            <Button onClick={onClose}>Hủy</Button>
            <Button variant="primary" loading={save.isPending} type="submit" form="edit-course">
              Lưu
            </Button>
          </>
        }
      >
        <form
          id="edit-course"
          onSubmit={(e) => {
            e.preventDefault()
            save.mutate()
          }}
          className="space-y-4"
        >
          <div className="grid grid-cols-3 gap-3">
            <Field label="Mã môn">
              <Input required value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} />
            </Field>
            <Field label="Khoa">
              <Input required value={form.facultyCode} onChange={(e) => setForm({ ...form, facultyCode: e.target.value })} />
            </Field>
            <Field label="Tín chỉ">
              <Input type="number" min={1} max={15} value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) || 3 })} />
            </Field>
          </div>
          <Field label="Tên học phần">
            <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
          </Field>
          <Field label="Mô tả">
            <Textarea rows={3} value={form.description || ''} onChange={(e) => setForm({ ...form, description: e.target.value })} />
          </Field>
          <Field label="Đề cương (URL)">
            <Input value={form.syllabusUrl || ''} onChange={(e) => setForm({ ...form, syllabusUrl: e.target.value })} />
          </Field>

          <div className="space-y-2">
            <span className="text-sm font-medium">Giảng viên phụ trách</span>
            <div className="flex flex-wrap gap-1.5">
              {lecturers.length === 0 && <span className="text-xs text-muted-foreground">Chưa gán ai.</span>}
              {lecturers.map((l) => (
                <span key={l.id} className="inline-flex items-center gap-1.5 rounded-full bg-muted py-0.5 pl-0.5 pr-2 text-xs">
                  <Avatar src={l.avatarUrl} name={l.displayName} className="size-5 text-[10px]" />
                  {l.displayName}
                  <button type="button" aria-label="Bỏ" onClick={() => setLecturers(lecturers.filter((x) => x.id !== l.id))}>
                    <X className="size-3" />
                  </button>
                </span>
              ))}
            </div>
            <Input value={lq} onChange={(e) => setLq(e.target.value)} placeholder="Tìm giảng viên / trợ giảng theo tên hoặc @username" />
            {dl && (candidates.data ?? []).filter((c) => !picked.has(c.id)).length > 0 && (
              <ul className="divide-y divide-border rounded-md border border-border">
                {candidates.data!.filter((c) => !picked.has(c.id)).map((c) => (
                  <li key={c.id}>
                    <button type="button" className="flex w-full items-center gap-2 px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => (setLecturers([...lecturers, c]), setLq(''))}>
                      <Avatar src={c.avatarUrl} name={c.displayName} className="size-6 text-[10px]" />
                      {c.displayName} <span className="text-muted-foreground">@{c.username}</span>
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="space-y-2 rounded-lg border border-border p-3">
            <span className="flex items-center gap-1.5 text-sm font-medium">
              <GitMerge className="size-4" /> Gộp vào môn khác
            </span>
            <p className="text-xs text-muted-foreground">Chuyển toàn bộ bài viết, tài liệu, nhóm học sang môn đích rồi xóa môn này. Không hoàn tác.</p>
            {mergeInto ? (
              <div className="flex items-center justify-between gap-2 text-sm">
                <span>
                  → <strong>{mergeInto.code}</strong> {mergeInto.name}
                </span>
                <div className="flex gap-2">
                  <Button size="sm" onClick={() => setMergeInto(null)}>
                    Đổi
                  </Button>
                  <Button size="sm" variant="danger" loading={merge.isPending} onClick={() => merge.mutate()}>
                    Gộp
                  </Button>
                </div>
              </div>
            ) : (
              <>
                <Input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="Tìm môn đích theo mã hoặc tên" />
                {dm && (
                  <ul className="divide-y divide-border rounded-md border border-border">
                    {(targets.data?.items ?? []).filter((t) => t.id !== course.id).map((t) => (
                      <li key={t.id}>
                        <button type="button" className="w-full px-2 py-1.5 text-left text-sm hover:bg-muted" onClick={() => setMergeInto(t)}>
                          <strong>{t.code}</strong> {t.name}
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </>
            )}
          </div>

          <div className="flex justify-end">
            <Button variant="danger-soft" size="sm" onClick={() => setConfirmDelete(true)}>
              <Trash2 /> Xóa học phần
            </Button>
          </div>
        </form>
      </Dialog>
      <ConfirmDialog
        open={confirmDelete}
        onClose={() => setConfirmDelete(false)}
        title={`Xóa học phần ${course.code}?`}
        description="Chỉ xóa được khi môn không còn bài viết, tài liệu hay nhóm học gắn vào. Nếu còn, hãy gộp sang môn khác."
        confirmLabel="Xóa"
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  )
}
