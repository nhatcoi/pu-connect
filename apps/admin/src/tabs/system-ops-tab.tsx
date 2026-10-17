import React, { useState } from 'react'
import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
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

const ACTION_LABELS: Record<string, string> = {
  'post.hide': 'Ẩn bài viết',
  'post.unhide': 'Hiện lại bài viết',
  'post.pin': 'Ghim bài viết',
  'post.unpin': 'Bỏ ghim bài viết',
  'report.dismiss': 'Bỏ qua báo cáo',
  'comment.delete': 'Xóa bình luận',
  'user.suspend': 'Khóa tài khoản',
  'user.unsuspend': 'Mở khóa tài khoản',
  'user.role_change': 'Đổi vai trò',
  'user.verify': 'Cấp tích xanh',
  'user.unverify': 'Gỡ tích xanh',
  'user.revoke_sessions': 'Đăng xuất mọi thiết bị',
  'user.insight_view': 'Xem insight',
  'ai.ticket_status': 'Cập nhật yêu cầu PU AI',
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

export function AuditLogsTab() {
  const [action, setAction] = useState('')
  const logs = useQuery({
    queryKey: ['admin', 'audit-logs', action],
    queryFn: () => adminApi.get<AdminAuditLog[]>(`/admin/audit-logs?limit=150${action ? `&action=${encodeURIComponent(action)}` : ''}`),
    placeholderData: keepPreviousData
  })

  return (
    <>
      <PageHeader title="Nhật ký" description="Mọi thao tác quản trị đều được ghi lại." />
      <Toolbar>
        <Select value={action} onChange={(e) => setAction(e.target.value)} className="w-56">
          <option value="">Mọi thao tác</option>
          {Object.entries(ACTION_LABELS).map(([k, label]) => (
            <option key={k} value={k}>
              {label}
            </option>
          ))}
        </Select>
      </Toolbar>

      {logs.isPending ? (
        <LoadingRows rows={8} />
      ) : !logs.data?.length ? (
        <EmptyState icon={History} title="Chưa có bản ghi" />
      ) : (
        <Table className={cn(logs.isPlaceholderData && 'opacity-60')}>
          <THead>
            <Th>Thao tác</Th>
            <Th>Người thực hiện</Th>
            <Th className="hidden md:table-cell">Đối tượng</Th>
            <Th className="hidden lg:table-cell">Chi tiết</Th>
            <Th className="text-right">Thời gian</Th>
          </THead>
          <TBody>
            {logs.data.map((log) => (
              <Tr key={log.id}>
                <Td>
                  <Badge tone={ACTION_TONE(log.action)}>{ACTION_LABELS[log.action] || log.action}</Badge>
                </Td>
                <Td className="font-medium text-foreground">@{log.admin?.username || 'system'}</Td>
                <Td className="hidden text-xs text-muted-foreground md:table-cell">
                  {log.targetType} <code className="font-mono">{log.targetId.slice(0, 8)}</code>
                </Td>
                <Td className="hidden max-w-[280px] lg:table-cell">
                  {log.details && Object.keys(log.details).length > 0 ? (
                    <code className="block truncate font-mono text-xs text-muted-foreground" title={JSON.stringify(log.details, null, 2)}>
                      {JSON.stringify(log.details)}
                    </code>
                  ) : (
                    <span className="text-muted-foreground">—</span>
                  )}
                </Td>
                <Td className="whitespace-nowrap text-right text-xs text-muted-foreground" >
                  <span title={new Date(log.createdAt).toLocaleString('vi-VN')}>{formatRelativeTime(log.createdAt)}</span>
                </Td>
              </Tr>
            ))}
          </TBody>
        </Table>
      )}
    </>
  )
}
