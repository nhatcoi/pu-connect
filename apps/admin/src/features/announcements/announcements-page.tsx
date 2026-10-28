import React, { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Bell, Megaphone, Send, X } from 'lucide-react'
import { toast } from 'sonner'
import { USER_ROLES, type AdminAnnouncement, type AdminAnnouncementAudience, type AdminAnnouncementInput } from '@pu/schemas'
import { adminApi, formatNumber, formatRelativeTime, ROLE_SHORT } from '@/lib/api'
import { useDebounced } from '@/hooks/use-debounced'
import { Badge, Button, Card, Checkbox, ConfirmDialog, EmptyState, Field, Input, LoadingRows, PageHeader, Textarea } from '@/components/ui'
import { useAdminUnits } from '@/features/units/use-units'

const KEY = ['admin', 'announcements']
const STATUS: Record<AdminAnnouncement['status'], { label: string; tone: 'warning' | 'success' | 'neutral' }> = {
  scheduled: { label: 'Chờ gửi', tone: 'warning' },
  sent: { label: 'Đã gửi', tone: 'success' },
  cancelled: { label: 'Đã hủy', tone: 'neutral' }
}

const EMPTY = { title: '', message: '', link: '', sendInApp: true, banner: false, bannerUntil: '', scheduledAt: '' }

// datetime-local ("2026-10-21T08:30", giờ máy admin) → ISO
const toIso = (v: string) => (v ? new Date(v).toISOString() : null)
const toggle = <T,>(list: T[], v: T) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

function describeAudience(a: AdminAnnouncementAudience, unitName: (id: string) => string) {
  const parts = [
    a.roles?.length ? a.roles.map((r) => ROLE_SHORT[r] ?? r).join(', ') : '',
    a.universityIds?.length ? a.universityIds.map(unitName).join(', ') : '',
    a.fieldIds?.length ? a.fieldIds.map(unitName).join(', ') : ''
  ].filter(Boolean)
  return parts.length ? parts.join(' · ') : 'Tất cả thành viên'
}

export function AnnouncementsPage() {
  const qc = useQueryClient()
  const [form, setForm] = useState(EMPTY)
  const [roles, setRoles] = useState<string[]>([])
  const [universityIds, setUniversityIds] = useState<string[]>([])
  const [fieldIds, setFieldIds] = useState<string[]>([])
  const [cancelId, setCancelId] = useState<string | null>(null)
  const units = useAdminUnits()
  const unitName = (id: string) => [...(units.data?.universities ?? []), ...(units.data?.fields ?? [])].find((u) => u.id === id)?.name || id.slice(0, 8)

  const audience: AdminAnnouncementAudience = {
    ...(roles.length && { roles: roles as AdminAnnouncementAudience['roles'] }),
    ...(universityIds.length && { universityIds }),
    ...(fieldIds.length && { fieldIds })
  }
  const debounced = useDebounced(JSON.stringify(audience), 400)
  const preview = useQuery({
    queryKey: ['admin', 'announcements', 'preview', debounced],
    queryFn: () => adminApi.post<{ count: number }>('/admin/announcements/preview', { audience: JSON.parse(debounced) }),
    placeholderData: (prev) => prev
  })

  const list = useQuery({ queryKey: KEY, queryFn: () => adminApi.get<AdminAnnouncement[]>('/admin/announcements') })

  const send = useMutation({
    mutationFn: (body: AdminAnnouncementInput) => adminApi.post('/admin/announcements', body),
    onSuccess: () => {
      toast.success(form.scheduledAt ? 'Đã hẹn giờ gửi' : 'Đã gửi thông báo')
      setForm(EMPTY)
      setRoles([])
      setUniversityIds([])
      setFieldIds([])
      void qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (err: Error) => toast.error(err.message)
  })
  const cancel = useMutation({
    mutationFn: (id: string) => adminApi.delete(`/admin/announcements/${id}`),
    onSuccess: () => {
      toast.success('Đã hủy')
      setCancelId(null)
      void qc.invalidateQueries({ queryKey: KEY })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  const submit = (e: React.FormEvent) => {
    e.preventDefault()
    send.mutate({
      title: form.title,
      message: form.message,
      link: form.link || null,
      audience,
      sendInApp: form.sendInApp,
      banner: form.banner,
      bannerUntil: form.banner ? toIso(form.bannerUntil) : null,
      scheduledAt: toIso(form.scheduledAt)
    })
  }

  return (
    <>
      <PageHeader title="Thông báo" description="Gửi thông báo trong ứng dụng hoặc đặt banner toàn trang, theo vai trò, trường, lĩnh vực quan tâm; có thể hẹn giờ." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form onSubmit={submit} className="space-y-4 p-5">
            <Field label="Tiêu đề" hint={`${form.title.length}/120`}>
              <Input required minLength={3} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Nội dung" hint={`${form.message.length}/500`}>
              <Textarea required minLength={5} maxLength={500} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </Field>
            <Field label="Liên kết">
              <Input value={form.link} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="Tùy chọn (/courses...)" />
            </Field>

            <fieldset className="space-y-2 rounded-lg border border-border p-3">
              <legend className="px-1 text-sm font-medium">Đối tượng nhận (bỏ trống = tất cả)</legend>
              <div className="flex flex-wrap gap-x-4 gap-y-1.5">
                {USER_ROLES.map((r) => (
                  <label key={r} className="flex items-center gap-1.5 text-sm">
                    <Checkbox checked={roles.includes(r)} onChange={() => setRoles(toggle(roles, r))} label={ROLE_SHORT[r]} /> {ROLE_SHORT[r]}
                  </label>
                ))}
              </div>
              {(
                [
                  { title: 'Trường đại học', items: units.data?.universities ?? [], selected: universityIds, set: setUniversityIds },
                  { title: 'Lĩnh vực quan tâm', items: units.data?.fields ?? [], selected: fieldIds, set: setFieldIds }
                ] as const
              ).map((g) => (
                <div key={g.title} className="space-y-1">
                  <span className="text-sm font-medium">{g.title}</span>
                  <div className="max-h-40 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                    {g.items.map((unit) => (
                      <label key={unit.id} className="flex items-center gap-1.5 text-sm">
                        <Checkbox checked={g.selected.includes(unit.id)} onChange={() => g.set(toggle([...g.selected], unit.id))} label={unit.name} /> {unit.name}
                      </label>
                    ))}
                    {g.items.length === 0 && <p className="text-xs text-muted-foreground">Chưa có mục nào.</p>}
                  </div>
                </div>
              ))}
              <p className="text-xs text-muted-foreground">
                Sẽ gửi tới <strong className="text-foreground">{preview.data ? formatNumber(preview.data.count) : '…'}</strong> người.
              </p>
            </fieldset>

            <div className="flex flex-wrap gap-x-6 gap-y-2">
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.sendInApp} onChange={(v) => setForm({ ...form, sendInApp: v })} label="Thông báo trong app" /> Thông báo trong app
              </label>
              <label className="flex items-center gap-2 text-sm">
                <Checkbox checked={form.banner} onChange={(v) => setForm({ ...form, banner: v })} label="Banner" /> Banner đầu trang
              </label>
            </div>
            {form.banner && (
              <Field label="Banner hiển thị đến" hint="Bỏ trống = đến khi hủy">
                <Input type="datetime-local" value={form.bannerUntil} onChange={(e) => setForm({ ...form, bannerUntil: e.target.value })} />
              </Field>
            )}
            <Field label="Hẹn giờ gửi" hint="Bỏ trống = gửi ngay">
              <Input type="datetime-local" value={form.scheduledAt} onChange={(e) => setForm({ ...form, scheduledAt: e.target.value })} />
            </Field>
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="primary" loading={send.isPending} disabled={!form.sendInApp && !form.banner}>
                <Send /> {form.scheduledAt ? 'Hẹn giờ' : 'Gửi'}
              </Button>
            </div>
          </form>
        </Card>

        <div className="space-y-3 lg:col-span-2">
          <p className="text-xs font-medium text-muted-foreground">Xem trước</p>
          <Card className="flex gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{form.title || 'Tiêu đề thông báo'}</p>
              <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{form.message || 'Nội dung hiển thị ở đây.'}</p>
            </div>
          </Card>
          {form.banner && (
            <div className="flex items-start gap-2 rounded-lg bg-primary px-3 py-2 text-sm text-primary-foreground">
              <Megaphone className="mt-0.5 size-4 shrink-0" />
              <span className="min-w-0">
                <strong>{form.title || 'Tiêu đề'}</strong> {form.message}
              </span>
            </div>
          )}
        </div>
      </div>

      <h2 className="mb-3 mt-8 text-sm font-semibold text-foreground">Lịch sử</h2>
      {list.isPending ? (
        <LoadingRows rows={3} />
      ) : (list.data ?? []).length === 0 ? (
        <EmptyState icon={Megaphone} title="Chưa có thông báo nào" />
      ) : (
        <ul className="divide-y divide-border rounded-xl border border-border bg-card">
          {list.data!.map((a) => (
            <li key={a.id} className="flex items-start gap-3 p-4">
              <div className="min-w-0 flex-1 space-y-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <span className="font-medium text-foreground">{a.title}</span>
                  <Badge tone={STATUS[a.status].tone}>{STATUS[a.status].label}</Badge>
                  {a.banner && <Badge tone="primary">Banner</Badge>}
                  {!a.sendInApp && <Badge>Chỉ banner</Badge>}
                </div>
                <p className="line-clamp-2 text-sm text-muted-foreground">{a.message}</p>
                <p className="text-xs text-muted-foreground">
                  {describeAudience(a.audience, unitName)} ·{' '}
                  {a.status === 'scheduled' ? `gửi ${new Date(a.scheduledAt).toLocaleString('vi-VN')}` : a.sentAt ? `${formatRelativeTime(a.sentAt)} · ${formatNumber(a.recipientsCount ?? 0)} người` : ''}
                  {a.createdBy && ` · @${a.createdBy}`}
                </p>
              </div>
              {(a.status === 'scheduled' || (a.status === 'sent' && a.banner && (!a.bannerUntil || new Date(a.bannerUntil) > new Date()))) && (
                <Button size="sm" variant="ghost" onClick={() => setCancelId(a.id)}>
                  <X /> {a.status === 'scheduled' ? 'Hủy' : 'Gỡ banner'}
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}

      <ConfirmDialog
        open={!!cancelId}
        onClose={() => setCancelId(null)}
        title="Hủy thông báo?"
        description="Thông báo chưa gửi sẽ không gửi nữa; banner đang hiển thị sẽ được gỡ. Thông báo đã vào hộp thư người dùng thì giữ nguyên."
        confirmLabel="Hủy thông báo"
        loading={cancel.isPending}
        onConfirm={() => cancelId && cancel.mutate(cancelId)}
      />
    </>
  )
}
