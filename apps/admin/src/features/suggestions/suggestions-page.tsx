import React, { useMemo, useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Check, Lightbulb, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminCourseSuggestion, AdminUnitRequest, CourseSuggestionStatus } from '@pu/schemas'
import { adminApi, cn, formatRelativeTime } from '@/lib/api'
import { FieldSelect } from '@/features/units/field-select'
import { UnitRequestApproveDialog, UnitRequestRejectDialog } from '@/features/units/units-panel'
import { useAdminUnits, useUnitActions, useUnitRequests } from '@/features/units/use-units'
import { Badge, Button, ConfirmDialog, Dialog, EmptyState, Field, Input, LoadingRows, PageHeader, Segmented, Table, TBody, Td, Th, THead, Toolbar, Tr } from '@/components/ui'

type Kind = 'university' | 'field' | 'course'

const KIND_LABEL: Record<Kind, string> = { university: 'Trường', field: 'Lĩnh vực', course: 'Môn học' }
const KIND_TONE = { university: 'primary', field: 'orange', course: 'success' } as const
const STATUS_TONE = { pending: undefined, approved: 'success', rejected: 'danger' } as const
const STATUS_LABEL: Record<CourseSuggestionStatus, string> = { pending: 'Chờ duyệt', approved: 'Đã duyệt', rejected: 'Đã từ chối' }

// Dòng chung cho mọi loại đề xuất (trường / lĩnh vực / môn học) — một nơi duyệt duy nhất
interface Row {
  key: string
  kind: Kind
  name: string
  detail: string[]
  who: string
  at: string
  status: CourseSuggestionStatus
  unit?: AdminUnitRequest
  course?: AdminCourseSuggestion
}

// Đề xuất từ người dùng: duyệt ⇒ cập nhật dữ liệu của họ đúng theo đề xuất; từ chối ⇒ dữ liệu của họ vẫn là "Khác"
export function SuggestionsPage({ canManage }: { canManage: boolean }) {
  const [status, setStatus] = useState<CourseSuggestionStatus>('pending')
  const [kind, setKind] = useState<Kind | 'all'>('all')
  const [approvingUnit, setApprovingUnit] = useState<AdminUnitRequest | null>(null)
  const [rejectingUnit, setRejectingUnit] = useState<AdminUnitRequest | null>(null)
  const [approvingCourse, setApprovingCourse] = useState<AdminCourseSuggestion | null>(null)
  const [rejectingCourse, setRejectingCourse] = useState<AdminCourseSuggestion | null>(null)
  const qc = useQueryClient()
  const refresh = () => void qc.invalidateQueries({ queryKey: ['admin'] })

  const catalog = useAdminUnits()
  const unitActions = useUnitActions()
  const units = useUnitRequests(status)
  const courses = useQuery({
    queryKey: ['admin', 'course-suggestions', status],
    queryFn: () => adminApi.get<AdminCourseSuggestion[]>(`/admin/courses/suggestions?status=${status}`)
  })

  const rows = useMemo<Row[]>(() => {
    const fromUnits: Row[] = (units.data ?? []).map((r) => ({
      key: `u-${r.id}`,
      kind: r.kind,
      name: r.name,
      detail: [
        r.sameNameCount > 1 && r.status === 'pending' ? `+${r.sameNameCount - 1} người khác cùng tên` : '',
        r.suggestion && r.status === 'pending' ? `giống "${r.suggestion.name}"` : '',
        r.status === 'approved' && r.resolvedName ? `→ "${r.resolvedName}"` : '',
        r.status === 'rejected' && r.rejectReason ? `Lý do: ${r.rejectReason}` : ''
      ].filter(Boolean),
      who: r.user.username,
      at: r.createdAt,
      status: r.status,
      unit: r
    }))
    const fromCourses: Row[] = (courses.data ?? []).map((s) => ({
      key: `c-${s.id}`,
      kind: 'course',
      name: s.name,
      detail: [s.fieldName ?? '', s.note ?? '', s.status === 'rejected' && s.reviewNote ? `Lý do: ${s.reviewNote}` : ''].filter(Boolean),
      who: s.requester.username,
      at: s.createdAt,
      status: s.status,
      course: s
    }))
    return [...fromUnits, ...fromCourses].filter((r) => kind === 'all' || r.kind === kind).sort((a, b) => b.at.localeCompare(a.at))
  }, [units.data, courses.data, kind])

  const rejectCourse = useMutation({
    mutationFn: ({ id, note }: { id: string; note: string }) => adminApi.post(`/admin/courses/suggestions/${id}/reject`, { note }),
    onSuccess: () => {
      toast.success('Đã từ chối đề xuất')
      setRejectingCourse(null)
      refresh()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const loading = units.isPending || courses.isPending

  return (
    <>
      <PageHeader title="Đề xuất" />
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
        <Segmented
          value={kind}
          onChange={(v) => setKind(v as Kind | 'all')}
          items={[{ id: 'all', label: 'Tất cả' }, ...(Object.keys(KIND_LABEL) as Kind[]).map((k) => ({ id: k, label: KIND_LABEL[k] }))]}
        />
      </Toolbar>
      <p className="mb-3 text-xs text-muted-foreground">
        Người dùng chọn &quot;Khác&quot; và đề xuất trường, lĩnh vực hoặc môn học. Duyệt ⇒ dữ liệu của họ cập nhật đúng theo đề xuất và họ nhận thông báo. Từ chối ⇒ dữ liệu của họ vẫn là &quot;Khác&quot;.
      </p>
      {loading ? (
        <LoadingRows />
      ) : rows.length === 0 ? (
        <EmptyState icon={Lightbulb} title="Không có đề xuất nào" />
      ) : (
        <Table>
          <THead>
            <Th>Loại</Th>
            <Th>Đề xuất</Th>
            <Th className="hidden md:table-cell">Người đề xuất</Th>
            <Th className="hidden lg:table-cell">Gửi lúc</Th>
            <Th>Trạng thái</Th>
            <Th className="w-44" />
          </THead>
          <TBody>
            {rows.map((r) => (
              <Tr key={r.key}>
                <Td>
                  <Badge tone={KIND_TONE[r.kind]}>{KIND_LABEL[r.kind]}</Badge>
                </Td>
                <Td className="max-w-[380px]">
                  <p className="truncate font-medium text-foreground">{r.name}</p>
                  {r.detail.length > 0 && <p className="truncate text-xs text-muted-foreground">{r.detail.join(' · ')}</p>}
                </Td>
                <Td className="hidden text-muted-foreground md:table-cell">@{r.who}</Td>
                <Td className="hidden text-muted-foreground lg:table-cell">{formatRelativeTime(r.at)}</Td>
                <Td>
                  <Badge tone={STATUS_TONE[r.status]}>{STATUS_LABEL[r.status]}</Badge>
                </Td>
                <Td className="text-right">
                  {canManage && r.status === 'pending' && (
                    <div className="flex justify-end gap-1.5">
                      <Button size="sm" onClick={() => (r.unit ? setRejectingUnit(r.unit) : setRejectingCourse(r.course!))}>
                        <X /> Từ chối
                      </Button>
                      <Button size="sm" variant="primary" onClick={() => (r.unit ? setApprovingUnit(r.unit) : setApprovingCourse(r.course!))}>
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

      <UnitRequestApproveDialog request={approvingUnit} data={catalog.data ?? { universities: [], fields: [] }} onClose={() => setApprovingUnit(null)} actions={unitActions} />
      <UnitRequestRejectDialog request={rejectingUnit} onClose={() => setRejectingUnit(null)} actions={unitActions} />
      <CourseSuggestionApproveDialog suggestion={approvingCourse} onClose={() => setApprovingCourse(null)} onDone={refresh} />
      <ConfirmDialog
        open={!!rejectingCourse}
        onClose={() => setRejectingCourse(null)}
        title="Từ chối đề xuất?"
        description={rejectingCourse ? `“${rejectingCourse.name}” sẽ bị từ chối; người đề xuất xem được lý do bên dưới.` : undefined}
        confirmLabel="Từ chối"
        withReason
        loading={rejectCourse.isPending}
        onConfirm={(note) => rejectingCourse && rejectCourse.mutate({ id: rejectingCourse.id, note: note || '' })}
      />
    </>
  )
}

// Duyệt đề xuất môn: admin chốt mã, lĩnh vực, tín chỉ ⇒ tạo môn thật
export function CourseSuggestionApproveDialog({ suggestion, onClose, onDone }: { suggestion: AdminCourseSuggestion | null; onClose: () => void; onDone: () => void }) {
  const [form, setForm] = useState({ code: '', name: '', credits: 3, fieldId: null as string | null })
  const [seen, setSeen] = useState<string | null>(null)
  // Mở đề xuất mới ⇒ điền sẵn từ đề xuất
  if (suggestion && suggestion.id !== seen) {
    setSeen(suggestion.id)
    setForm({ code: suggestion.code ?? '', name: suggestion.name, credits: suggestion.credits ?? 3, fieldId: suggestion.fieldId })
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
          <Field label="Lĩnh vực">
            <FieldSelect value={form.fieldId} onChange={(fieldId) => setForm({ ...form, fieldId })} />
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
