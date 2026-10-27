import React, { useState } from 'react'
import { keepPreviousData, useQuery } from '@tanstack/react-query'
import { SavedViews } from '@/components/list/saved-views'
import { useHashQuery } from '@/hooks/use-hash-query'
import { ListFooter, ListSearch, ParamSelect, useListState, usePaged } from '@/components/list/list-kit'
import { History } from 'lucide-react'
import type { AdminSecurityEventRow, AdminAuditLog, TopSearchQuery, ZeroResultQuery } from '@pu/schemas'
import { adminApi, cn, formatNumber, formatRelativeTime, ROLE_SHORT } from '@/lib/api'
import {
  Badge,
  Button,
  Card,
  CardHeader,
  EmptyState,
  Field,
  FilterChip,
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
  Tabs,
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
  'user.reset_link': 'Gửi link đặt lại mật khẩu',
  'user.force_reset': 'Bắt đổi mật khẩu',
  'user.insight_view': 'Xem insight',
  'user.security_view': 'Xem nhật ký bảo mật',
  'user.data_view': 'Xem dữ liệu chi tiết',
  'user.session_revoke': 'Đăng xuất 1 phiên',
  'user.note_add': 'Thêm ghi chú',
  'user.note_delete': 'Xóa ghi chú',
  'user.export': 'Xuất danh sách người dùng',
  'ai.ticket_status': 'Cập nhật yêu cầu N7AI',
  'ai.skill_moderate': 'Kiểm duyệt skill',
  'course.create': 'Tạo học phần',
  'course.update': 'Sửa học phần',
  'document.delete': 'Xóa tài liệu',
  'system.broadcast': 'Gửi thông báo',
  'course.merge': 'Gộp học phần',
  'course.delete': 'Xóa học phần',
  'course.import': 'Nhập học phần từ file',
  'course.lecturers': 'Gán giảng viên học phần',
  'announcement.create': 'Tạo thông báo hệ thống',
  'announcement.cancel': 'Hủy thông báo hệ thống',
  'bot.account_create': 'Tạo bot',
  'bot.account_update': 'Sửa bot',
  'bot.account_delete': 'Xóa bot',
  'bot.job_create': 'Tạo job đăng bài của Bot',
  'bot.job_update': 'Sửa job Bot (bật/tắt, tự trả lời/thả tim)',
  'bot.job_delete': 'Xóa job Bot',
  'bot.job_post_now': 'Đăng ngay / thử lại bài của job Bot',
  'bot.job_post_remove': 'Bỏ bài khỏi job Bot'
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

function AdminActionsSection() {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminAuditLog>('audit-logs', '/admin/audit-logs', state.params, ['q', 'action', 'admin', 'targetType', 'days'])
  const rows = list.data?.items ?? []

  return (
    <>
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

/* ── Trang Nhật ký: thao tác admin + đăng nhập toàn hệ thống ── */

export function AuditLogsTab() {
  const [params, set] = useHashQuery()
  const tab = params.tab === 'logins' ? 'logins' : 'admin'
  return (
    <>
      <PageHeader
        title="Nhật ký"
        description={tab === 'admin' ? 'Mọi thao tác quản trị đều được ghi lại, không sửa được.' : 'Đăng nhập, sai mật khẩu, đăng xuất… của mọi tài khoản (lưu 90 ngày).'}
        actions={<SavedViews page="audit" />}
        tabs={
          <Tabs
            value={tab}
            onChange={(t) => set({ tab: t === 'admin' ? undefined : t }, { replace: true })}
            items={[
              { id: 'admin', label: 'Thao tác quản trị' },
              { id: 'logins', label: 'Đăng nhập' }
            ]}
          />
        }
      />
      {tab === 'admin' ? <AdminActionsSection /> : <LoginsSection />}
    </>
  )
}

const LOGIN_EVENT_LABEL: Record<string, string> = {
  login: 'Đăng nhập',
  login_failed: 'Sai mật khẩu',
  login_blocked: 'Bị chặn (đang khóa)',
  logout: 'Đăng xuất',
  register: 'Đăng ký',
  password_reset: 'Đặt lại mật khẩu',
  password_reset_requested: 'Yêu cầu đặt lại MK',
  email_verified: 'Xác thực email',
  session_revoked: 'Đăng xuất thiết bị'
}

function LoginsSection() {
  const state = useListState({ sort: 'recent' })
  const list = usePaged<AdminSecurityEventRow>('security-events', '/admin/security-events', state.params, ['q', 'event', 'result', 'days', 'country'])
  const rows = list.data?.items ?? []

  return (
    <>
      <Toolbar>
        <Segmented
          value={state.params.result ?? ''}
          onChange={(v) => state.set({ result: v })}
          items={[
            { id: '', label: 'Tất cả' },
            { id: 'failed', label: 'Thất bại' },
            { id: 'unusual', label: 'Nơi lạ' }
          ]}
        />
        <ParamSelect state={state} name="event" all="Mọi sự kiện" options={Object.entries(LOGIN_EVENT_LABEL).map(([value, label]) => ({ value, label }))} className="w-48" />
        <ParamSelect
          state={state}
          name="days"
          all="Mọi thời gian"
          options={[
            { value: '1', label: '24 giờ' },
            { value: '7', label: '7 ngày' },
            { value: '30', label: '30 ngày' }
          ]}
          className="w-36"
        />
        <ListSearch state={state} placeholder="@username hoặc IP" className="w-52" />
        {state.params.country && <FilterChip label="Quốc gia" value={state.params.country} onRemove={() => state.set({ country: undefined })} />}
        {list.data && <span className="ml-auto text-sm tabular-nums text-muted-foreground">{formatNumber(list.data.total)} sự kiện</span>}
      </Toolbar>

      {list.isPending ? (
        <LoadingRows rows={8} />
      ) : rows.length === 0 ? (
        <EmptyState icon={History} title="Chưa có sự kiện" description="Nhật ký đăng nhập bắt đầu ghi từ 17/10/2026." />
      ) : (
        <div className={cn(list.isPlaceholderData && 'opacity-60')}>
          <Table>
            <THead>
              <Th>Sự kiện</Th>
              <Th>Tài khoản</Th>
              <Th className="hidden md:table-cell">IP · Vị trí</Th>
              <Th className="hidden lg:table-cell">Thiết bị</Th>
              <Th className="text-right">Thời gian</Th>
            </THead>
            <TBody>
              {rows.map((e) => (
                <Tr key={e.id}>
                  <Td>
                    <Badge tone={e.success ? 'neutral' : 'danger'}>{LOGIN_EVENT_LABEL[e.event] ?? e.event}</Badge>
                    {e.method && (
                      <span className="ml-1.5 text-xs text-muted-foreground">{e.method === 'admin' ? 'bởi quản trị viên' : e.method === 'google' ? 'Google' : 'mật khẩu'}</span>
                    )}
                  </Td>
                  <Td>
                    {e.user ? (
                      <a href={`#/users?user=${e.user.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        @{e.user.username}
                      </a>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </Td>
                  <Td className="hidden md:table-cell">
                    {e.ip ? (
                      <span className="block">
                        <button type="button" onClick={() => state.set({ q: e.ip })} className="font-mono text-xs text-muted-foreground hover:text-primary cursor-pointer" title="Lọc theo IP này">
                          {e.ip}
                        </button>
                        {e.location && (
                          <button
                            type="button"
                            onClick={() => e.country && state.set({ country: e.country })}
                            className="block text-xs text-muted-foreground hover:text-primary cursor-pointer"
                            title="Lọc theo quốc gia này"
                          >
                            {e.location}
                            {e.unusual && <span className="ml-1 font-medium text-warning">· nơi lạ</span>}
                          </button>
                        )}
                      </span>
                    ) : (
                      '—'
                    )}
                  </Td>
                  <Td className="hidden text-xs text-muted-foreground lg:table-cell">{e.device ?? '—'}</Td>
                  <Td className="whitespace-nowrap text-right text-xs text-muted-foreground">
                    <span title={new Date(e.createdAt).toLocaleString('vi-VN')}>{formatRelativeTime(e.createdAt)}</span>
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
