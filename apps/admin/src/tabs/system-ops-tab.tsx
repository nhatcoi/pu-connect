import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ListFooter, ListSearch, ParamSelect, useListState, usePaged } from '@/components/list/list-kit'
import { Bell, History, Send } from 'lucide-react'
import { toast } from 'sonner'
import { USER_ROLES, type AdminAuditLog, type AdminBroadcastInput, type TopSearchQuery, type ZeroResultQuery } from '@pu/schemas'
import { adminApi, cn, formatNumber, formatRelativeTime, ROLE_SHORT } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  Input,
  LoadingRows,
  PageHeader,
  Segmented,
  Select,
  Skeleton,
  Table,
  TBody,
  Td,
  Textarea,
  Th,
  THead,
  Toolbar,
  Tr
} from '@/components/ui'

export const ACTION_LABELS: Record<string, string> = {
  'post.hide': 'Ẩn bài viết',
  'post.unhide': 'Hiện lại bài viết',
  'post.pin': 'Ghim bài viết',
  'post.unpin': 'Bỏ ghim bài viết',
  'report.dismiss': 'Bỏ qua báo cáo',
  'comment.delete': 'Xóa bình luận',
  'user.warn': 'Cảnh cáo',
  'user.restrict': 'Hạn chế (chỉ xem)',
  'user.unrestrict': 'Gỡ hạn chế',
  'user.sanction_revoke': 'Hủy chế tài',
  'user.suspend': 'Khóa tài khoản',
  'user.unsuspend': 'Mở khóa tài khoản',
  'user.role_change': 'Đổi vai trò',
  'user.verify': 'Cấp tích xanh',
  'user.unverify': 'Gỡ tích xanh',
  'user.revoke_sessions': 'Đăng xuất mọi thiết bị',
  'user.insight_view': 'Xem insight',
  'user.note_add': 'Thêm ghi chú',
  'user.note_delete': 'Xóa ghi chú',
  'user.export': 'Xuất danh sách người dùng',
  'ai.ticket_status': 'Cập nhật yêu cầu N7AI',
  'ai.skill_moderate': 'Kiểm duyệt skill',
  'course.create': 'Tạo học phần',
  'course.update': 'Sửa học phần',
  'document.delete': 'Xóa tài liệu',
  'system.broadcast': 'Gửi thông báo'
}

const ACTION_TONE = (action: string) =>
  /suspend$|delete|hide$|unverify|revoke/.test(action) && !/unsuspend|unhide/.test(action)
    ? 'danger'
    : action.startsWith('user.') || action.startsWith('system.')
      ? 'primary'
      : 'neutral'

/* ── Tìm kiếm ─────────────────────────────────────────── */

export function SearchAnalyticsTab() {
  const [days, setDays] = useState(30)
  const zero = useQuery({
    queryKey: ['admin', 'search', 'zero', days],
    queryFn: () => adminApi.get<ZeroResultQuery[]>(`/admin/search/zero-results?days=${days}`),
    placeholderData: keepPreviousData
  })
  const top = useQuery({
    queryKey: ['admin', 'search', 'top', days],
    queryFn: () => adminApi.get<TopSearchQuery[]>(`/admin/search/top?days=${days}`),
    placeholderData: keepPreviousData
  })

  return (
    <>
      <PageHeader
        title="Tìm kiếm"
        description="Sinh viên đang tìm gì và nội dung nào còn thiếu."
        actions={
          <Segmented
            value={days}
            onChange={setDays}
            items={[
              { id: 7, label: '7 ngày' },
              { id: 30, label: '30 ngày' },
              { id: 90, label: '90 ngày' }
            ]}
          />
        }
      />
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <QueryList
          title="Không có kết quả"
          description="Nội dung nên bổ sung"
          loading={zero.isPending}
          rows={zero.data?.map((r) => ({ query: r.query, count: r.count, meta: formatRelativeTime(r.lastSearchedAt) }))}
          barClass="bg-amber-500/15"
        />
        <QueryList
          title="Tìm nhiều nhất"
          loading={top.isPending}
          rows={top.data?.map((r) => ({ query: r.query, count: r.count, meta: `~${r.avgResults} kết quả` }))}
          barClass="bg-primary/10"
        />
      </div>
    </>
  )
}

function QueryList({
  title,
  description,
  loading,
  rows,
  barClass
}: {
  title: string
  description?: string
  loading: boolean
  rows?: { query: string; count: number; meta: string }[]
  barClass: string
}) {
  const max = Math.max(1, ...(rows ?? []).map((r) => r.count))
  return (
    <Card className="overflow-hidden">
      <CardHeader title={title} description={description} />
      {loading ? (
        <div className="space-y-2 px-5 pb-5">
          {Array.from({ length: 6 }, (_, i) => (
            <Skeleton key={i} className="h-8" />
          ))}
        </div>
      ) : !rows?.length ? (
        <p className="px-5 pb-5 text-sm text-muted-foreground">Chưa có dữ liệu</p>
      ) : (
        <ol className="space-y-1 px-3 pb-3">
          {rows.map((r, i) => (
            <li key={r.query} className="relative flex items-center gap-3 overflow-hidden rounded-md px-2 py-1.5 text-sm">
              <span className={cn('absolute inset-y-0 left-0 rounded-md', barClass)} style={{ width: `${(r.count / max) * 100}%` }} />
              <span className="relative w-5 text-right text-xs tabular-nums text-muted-foreground">{i + 1}</span>
              <span className="relative flex-1 truncate font-medium text-foreground">{r.query}</span>
              <span className="relative hidden text-xs text-muted-foreground sm:inline">{r.meta}</span>
              <span className="relative w-10 text-right font-semibold tabular-nums">{formatNumber(r.count)}</span>
            </li>
          ))}
        </ol>
      )}
    </Card>
  )
}

/* ── Thông báo hệ thống ───────────────────────────────── */

const EMPTY_BROADCAST: AdminBroadcastInput = { title: '', message: '', link: '', targetRole: 'all' }

export function BroadcastTab() {
  const [form, setForm] = useState<AdminBroadcastInput>(EMPTY_BROADCAST)
  const qc = useQueryClient()
  const send = useMutation({
    mutationFn: (body: AdminBroadcastInput) => adminApi.post<{ sentCount: number }>('/admin/broadcast', body),
    onSuccess: (res) => {
      toast.success(`Đã gửi tới ${formatNumber(res.sentCount)} người`)
      setForm(EMPTY_BROADCAST)
      void qc.invalidateQueries({ queryKey: ['admin'] })
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <>
      <PageHeader title="Thông báo" description="Gửi thông báo trong ứng dụng tới thành viên." />
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-5">
        <Card className="lg:col-span-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              send.mutate(form)
            }}
            className="space-y-4 p-5"
          >
            <Field label="Người nhận">
              <Select value={form.targetRole} onChange={(e) => setForm({ ...form, targetRole: e.target.value as AdminBroadcastInput['targetRole'] })}>
                <option value="all">Tất cả thành viên</option>
                {USER_ROLES.map((r) => (
                  <option key={r} value={r}>
                    {ROLE_SHORT[r]}
                  </option>
                ))}
              </Select>
            </Field>
            <Field label="Tiêu đề" hint={`${form.title.length}/120`}>
              <Input required minLength={3} maxLength={120} value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} />
            </Field>
            <Field label="Nội dung" hint={`${form.message.length}/500`}>
              <Textarea required minLength={5} maxLength={500} rows={4} value={form.message} onChange={(e) => setForm({ ...form, message: e.target.value })} />
            </Field>
            <Field label="Liên kết" hint="Không bắt buộc">
              <Input value={form.link || ''} onChange={(e) => setForm({ ...form, link: e.target.value })} placeholder="/courses" />
            </Field>
            <div className="flex justify-end pt-1">
              <Button type="submit" variant="primary" loading={send.isPending}>
                <Send /> Gửi thông báo
              </Button>
            </div>
          </form>
        </Card>

        {/* Xem trước thông báo */}
        <div className="lg:col-span-2">
          <p className="mb-2 text-xs font-medium text-muted-foreground">Xem trước</p>
          <Card className="flex gap-3 p-4">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary">
              <Bell className="size-5" />
            </span>
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">{form.title || 'Tiêu đề thông báo'}</p>
              <p className="mt-0.5 line-clamp-3 text-sm text-muted-foreground">{form.message || 'Nội dung hiển thị ở đây.'}</p>
              <p className="mt-1.5 text-xs font-medium text-primary">Vừa xong</p>
            </div>
          </Card>
        </div>
      </div>
    </>
  )
}

/* ── Nhật ký kiểm toán ────────────────────────────────── */

const TARGET_LABELS: Record<string, string> = {
  user: 'Người dùng',
  post: 'Bài viết',
  comment: 'Bình luận',
  course: 'Học phần',
  document: 'Tài liệu',
  ai_ticket: 'Yêu cầu N7AI',
  ai_skill: 'Skill',
  system: 'Hệ thống'
}

// Chi tiết dễ đọc: lý do, vai trò mới, số người trong thao tác hàng loạt
function detailText(d: Record<string, unknown> | null): string | null {
  if (!d) return null
  const parts: string[] = []
  if (typeof d.reason === 'string' && d.reason) parts.push(`“${d.reason}”`)
  if (typeof d.to === 'string') parts.push(`→ ${ROLE_SHORT[d.to] ?? d.to}`)
  if (typeof d.snippet === 'string') parts.push(`“${d.snippet}”`)
  if (typeof d.days === 'number') parts.push(`${d.days} ngày`)
  if (d.days === 'permanent') parts.push('vĩnh viễn')
  if (typeof d.bulk === 'number') parts.push(`hàng loạt ${d.bulk}`)
  if (typeof d.closedReports === 'number' && d.closedReports) parts.push(`đóng ${d.closedReports} báo cáo`)
  if (typeof d.revokedSessions === 'number') parts.push(`${d.revokedSessions} phiên`)
  return parts.length ? parts.join(' · ') : null
}

export function AuditLogsTab() {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminAuditLog>('audit-logs', '/admin/audit-logs', state.params, ['q', 'action', 'admin', 'targetType', 'days'])
  const rows = list.data?.items ?? []

  return (
    <>
      <PageHeader title="Nhật ký" description="Mọi thao tác quản trị đều được ghi lại, không sửa được." />
      <Toolbar>
        <Segmented
          value={state.params.days ?? ''}
          onChange={(v) => state.set({ days: v })}
          items={[
            { id: '1', label: '24 giờ' },
            { id: '7', label: '7 ngày' },
            { id: '30', label: '30 ngày' },
            { id: '', label: 'Tất cả' }
          ]}
        />
        <ParamSelect state={state} name="action" all="Mọi thao tác" options={Object.entries(ACTION_LABELS).map(([value, label]) => ({ value, label }))} className="w-52" />
        <ParamSelect state={state} name="targetType" all="Mọi đối tượng" options={Object.entries(TARGET_LABELS).map(([value, label]) => ({ value, label }))} className="w-40" />
        <ParamSelect
          state={state}
          name="admin"
          all="Mọi người thực hiện"
          options={(list.data?.facets?.admin ?? []).map((f) => ({ value: f.value, label: `@${f.value}`, count: f.count }))}
          className="w-48"
        />
        <ListSearch state={state} placeholder="ID đối tượng" className="w-44" />
        {list.data && <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatNumber(list.data.total)} bản ghi</span>}
      </Toolbar>

      {list.isPending ? (
        <LoadingRows rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="Không có bản ghi phù hợp" />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <Table>
            <THead>
              <Th>Thao tác</Th>
              <Th>Người thực hiện</Th>
              <Th className="hidden md:table-cell">Đối tượng</Th>
              <Th className="hidden lg:table-cell">Chi tiết</Th>
              <Th className="text-right">Thời gian</Th>
            </THead>
            <TBody>
              {rows.map((log) => (
                <Tr key={log.id}>
                  <Td>
                    <Badge tone={ACTION_TONE(log.action)}>{ACTION_LABELS[log.action] || log.action}</Badge>
                  </Td>
                  <Td className="font-medium text-foreground">@{log.admin?.username || 'system'}</Td>
                  <Td className="hidden text-xs text-muted-foreground md:table-cell">
                    {TARGET_LABELS[log.targetType] ?? log.targetType}{' '}
                    {log.targetType === 'user' ? (
                      <a href={`#/users?user=${log.targetId}`} className="font-mono text-primary hover:underline">
                        {log.targetId.slice(0, 8)}
                      </a>
                    ) : (
                      <code className="font-mono">{log.targetId.slice(0, 8)}</code>
                    )}
                  </Td>
                  <Td className="hidden max-w-[320px] lg:table-cell">
                    <span className="block truncate text-xs text-muted-foreground" title={log.details ? JSON.stringify(log.details, null, 2) : undefined}>
                      {detailText(log.details) ?? '—'}
                    </span>
                  </Td>
                  <Td className="whitespace-nowrap text-right text-xs text-muted-foreground">
                    <span title={new Date(log.createdAt).toLocaleString('vi-VN')}>{formatRelativeTime(log.createdAt)}</span>
                  </Td>
                </Tr>
              ))}
            </TBody>
          </Table>
          <ListFooter state={state} total={list.data?.total ?? 0} />
        </div>
      )}
    </>
  )
}
