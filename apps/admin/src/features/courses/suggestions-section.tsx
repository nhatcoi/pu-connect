import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lightbulb, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCourseSuggestion, CourseSuggestionStatus } from '@pu/schemas'
import { adminApi, cn, formatRelativeTime } from '@/lib/api'
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, Field, Input, LoadingRows, Segmented, Table, TBody, Td, Th, THead, Toolbar, Tr } from '@/components/ui'

const STATUS_TONE = { pending: undefined, approved: 'success', rejected: 'danger' } as const
const STATUS_LABEL: Record<CourseSuggestionStatus, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' }

// Đề xuất môn học từ người dùng: duyệt (chốt mã, khoa, tín chỉ ⇒ tạo môn) hoặc từ chối kèm lý do
export function SuggestionsSection({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<CourseSuggestionStatus>('pending')
  const [approving, setApproving] = useState<AdminCourseSuggestion | null>(null)
  const [rejecting, setRejecting] = useState<AdminCourseSuggestion | null>(null)
  const qc = useQueryClient()
  const list = useQuery({
    queryKey: ['admin', 'course-suggestions', status],
    queryFn: () => adminApi.get<AdminCourseSuggestion[]>(`/admin/courses/suggestions?status=${status}`)
  })
  const rows = list.data ?? []
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] })

  const reject = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.post(`/admin/courses/suggestions/${id}/reject`, { note }),
    onSuccess: () => {
      toast.success('Đã từ chối đề xuất')
      setRejecting(null)
      refresh()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <>
      <Toolbar>
        <Segmented
          value={status}
          onChange={(v) => setStatus(v as CourseSuggestionStatus)}
          items={[
            { id: 'pending', label: 'Chờ duyệt' },
            { id: 'approved', label: 'Đã duyệt' },
            { id: 'rejected', label: 'Đã từ chối' }
          ]}
        />
      </Toolbar>
      {list.isPending ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Không có đề xuất nào" />
      ) : (
        <Table>
          <THead>
            <Th>Môn đề xuất</Th>
            <Th className="hidden md:table-cell">Người đề xuất</Th>
            <Th className="hidden sm:table-cell">Khoa</Th>
            <Th className="hidden lg:table-cell">Gửi lúc</Th>
            <Th>Trạng thái</Th>
            <Th className="w-44" />
          </THead>
          <TBody>
            {rows.map((s) => (
              <Tr key={s.id}>
                <Td className="max-w-[380px]">
                  <p className="truncate font-medium text-foreground">{s.name}</p>
                  {s.note && <p className="truncate text-xs text-muted-foreground">{s.note}</p>}
                  {s.status === 'rejected' && s.reviewNote && <p className="truncate text-xs text-muted-foreground">Lý do: {s.reviewNote}</p>}
                </Td>
                <Td className="hidden text-muted-foreground md:table-cell">@{s.requester.username}</Td>
                <Td className="hidden text-muted-foreground sm:table-cell">{s.facultyCode || '—'}</Td>
                <Td className="hidden text-muted-foreground lg:table-cell">{formatRelativeTime(s.createdAt)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[s.status]}>{STATUS_LABEL[s.status]}</Badge>
                </Td>
                <Td className="text-right">
                  {canManage && s.status === 'pending' && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => setRejecting(s)}>
                        <X /> Từ chối
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => setApproving(s)}>
                        <Check /> Duyệt
                      </Button>
                    </div>
                  )}
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}

      <ApproveDialog suggestion={approving} onClose={() => setApproving(null)} onDone={refresh} />
      <ConfirmDialog
        open={!!rejecting}
        onClose={() => setRejecting(null)}
        title="Từ chối đề xuất?"
        description={rejecting ? `“${rejecting.name}” sẽ bị từ chối; người đề xuất xem được lý do bên dưới.` : undefined}
        confirmLabel="Từ chối"
        withReason
        loading={reject.isPending}
        onConfirm={(note) => rejecting && reject.mutate({ id: rejecting.id, note: note || '' })}
      />
    </>
  )
}

// Admin chốt thông tin môn trước khi tạo
function ApproveDialog({ suggestion, onClose, onDone }: { suggestion: AdminCourseSuggestion | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', credits: 3, facultyCode: '' })
  const [seen, setSeen] = useState<string | null>(null)
  // Mở đề xuất mới ⇒ điền sẵn từ đề xuất
  if (suggestion && suggestion.id !== seen) {
    setSeen(suggestion.id)
    setForm({ code: suggestion.code ?? '', name: suggestion.name, credits: suggestion.credits ?? 3, facultyCode: suggestion.facultyCode ?? '' })
  }
  const approve = useMutation({
    mutationFn: () => adminApi.post(`/admin/courses/suggestions/${suggestion!.id}/approve`, form),
    onSuccess: () => {
      toast.success('Đã tạo môn học')
      onClose()
      onDone()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <Dialog
      open={!!suggestion}
      onClose={onClose}
      title="Duyệt đề xuất môn học"
      footer={
        <>
          <Button onClick={onClose}>Hủy</Button>
          <Button variant="primary" type="submit" form="approve-suggestion" loading={approve.isPending}>
            Tạo môn học
          </Button>
        </>
      }
    >
      <form
        id="approve-suggestion"
        onSubmit={(e) => {
          e.preventDefault()
          approve.mutate()
        }}
        className={cn('space-y-4')}
      >
        <div className="grid grid-cols-3 gap-3">
          <Field label="Mã môn">
            <Input required autoFocus value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase() })} placeholder="IT302" />
          </Field>
          <Field label="Khoa">
            <Input required value={form.facultyCode} onChange={(e) => setForm({ ...form, facultyCode: e.target.value })} placeholder="CNTT" />
          </Field>
          <Field label="Tín chỉ">
            <Input type="number" min={1} max={15} value={form.credits} onChange={(e) => setForm({ ...form, credits: Number(e.target.value) || 3 })} />
          </Field>
        </div>
        <Field label="Tên học phần">
          <Input required value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} />
        </Field>
        {suggestion?.note && <p className="text-xs text-muted-foreground">Ghi chú của người đề xuất: {suggestion.note}</p>}
      </form>
    </Dialog>
  )
}
