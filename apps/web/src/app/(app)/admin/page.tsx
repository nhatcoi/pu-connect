'use client'

import React, { useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Activity, EyeOff, Eye, Loader2, Lock, LockOpen, SearchX, ShieldCheck, X } from 'lucide-react'
import { toast } from 'sonner'
import type { AdminAuditLog, AdminReportedPost, AdminStats, AdminUserRow, ZeroResultQuery } from '@pu/schemas'
import { apiClient } from '@/lib/api-client'
import { markdownToPlainText } from '@/lib/plain-text'
import { queryKeys } from '@/lib/query-keys'
import { cn, formatRelativeTime } from '@/lib/utils'
import { useAppStore } from '@/store'
import { SlidingTabs } from '@/components/navigation/sliding-tabs'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { CardListSkeleton } from '@/components/skeletons/catalog-skeleton'
import { UserInsightDialog } from '@/components/admin/user-insight-dialog'

type Tab = 'reports' | 'users' | 'searches' | 'logs'
type Envelope<T> = { success: boolean; data: T }

const get = async <T,>(path: string) => (await apiClient<Envelope<T>>(path)).data
const post = <T,>(path: string, body: unknown = {}) =>
  apiClient<Envelope<T>>(path, { method: 'POST', body: JSON.stringify(body) })

const REASON_LABELS: Record<string, string> = {
  // Khớp lý do trong report-post-dialog
  spam: 'Spam / quảng cáo',
  exam_leak: 'Lộ đề thi',
  harassment: 'Công kích / ngôn từ',
  inaccurate_info: 'Sai lệch học thuật',
  other: 'Khác'
}

const ACTION_LABELS: Record<string, string> = {
  'post.hide': 'Ẩn bài viết',
  'post.unhide': 'Hiện lại bài viết',
  'report.dismiss': 'Bỏ qua báo cáo',
  'user.suspend': 'Khóa tài khoản',
  'user.unsuspend': 'Mở khóa tài khoản',
  'user.insight_view': 'Xem dữ liệu cá nhân hóa'
}

// Trang quản trị tối giản: xử lý báo cáo, khóa/mở tài khoản, từ khóa tìm trống, nhật ký
export default function AdminPage() {
  const router = useRouter()
  const user = useAppStore((s) => s.user)
  const [tab, setTab] = useState<Tab>('reports')
  const isAdmin = user?.role === 'admin'

  const stats = useQuery({
    queryKey: queryKeys.admin('stats'),
    queryFn: () => get<AdminStats>('/admin/stats'),
    enabled: isAdmin
  })

  if (!isAdmin) {
    return (
      <div className="py-24 text-center space-y-3 text-muted-foreground">
        <ShieldCheck className="h-10 w-10 mx-auto opacity-30" />
        <p className="text-sm font-medium">Chỉ quản trị viên mới truy cập được trang này.</p>
        <Button variant="outline" size="sm" className="rounded-full" onClick={() => router.push('/home')}>
          Về bảng tin
        </Button>
      </div>
    )
  }

  const s = stats.data
  return (
    <>
      <div className="sticky top-0 md:top-14 z-30 bg-surface/90 backdrop-blur-md px-4 py-3">
        <h1 className="text-[15px] font-semibold tracking-tight flex items-center gap-2">
          <ShieldCheck className="h-4 w-4 text-primary" /> Quản trị
        </h1>
      </div>

      <div className="mx-2 sm:mx-0 mb-2.5 rounded-xl bg-card p-4 space-y-4">
        <div className="grid grid-cols-3 gap-2">
          <Stat label="Báo cáo chờ" value={s?.pendingReports} highlight={!!s?.pendingReports} />
          <Stat label="Bài bị báo cáo" value={s?.reportedPosts} />
          <Stat label="Bài đã ẩn" value={s?.hiddenPosts} />
          <Stat label="Người dùng" value={s?.totalUsers} />
          <Stat label="Mới (7 ngày)" value={s?.newUsers7d} />
          <Stat label="Đang bị khóa" value={s?.suspendedUsers} />
        </div>
        <SlidingTabs<Tab>
          value={tab}
          onChange={setTab}
          items={[
            { id: 'reports', label: 'Báo cáo', badge: s?.pendingReports || undefined },
            { id: 'users', label: 'Người dùng' },
            { id: 'searches', label: 'Tìm không ra' },
            { id: 'logs', label: 'Nhật ký' }
          ]}
        />
      </div>

      <div className="px-2 sm:px-0 space-y-2">
        {tab === 'reports' && <ReportsTab />}
        {tab === 'users' && <UsersTab currentUserId={user.id} />}
        {tab === 'searches' && <ZeroResultsTab />}
        {tab === 'logs' && <AuditLogTab />}
      </div>
    </>
  )
}

function Stat({ label, value, highlight }: { label: string; value?: number; highlight?: boolean }) {
  return (
    <div className={cn('rounded-lg px-3 py-2', highlight ? 'bg-brand-orange/10' : 'bg-muted/40')}>
      <p className="text-[11px] text-muted-foreground">{label}</p>
      <p className={cn('text-base font-bold tabular-nums', highlight && 'text-brand-orange')}>{value ?? '–'}</p>
    </div>
  )
}

function Loading() {
  return <CardListSkeleton count={4} />
}

function EmptyState({ text }: { text: string }) {
  return <p className="py-16 text-center text-sm text-muted-foreground">{text}</p>
}

// Làm mới số liệu + danh sách sau mỗi thao tác
function useAdminRefresh() {
  const qc = useQueryClient()
  return () => qc.invalidateQueries({ queryKey: ['admin'] })
}

function ReportsTab() {
  const [status, setStatus] = useState<'pending' | 'resolved'>('pending')
  const refresh = useAdminRefresh()
  const qc = useQueryClient()
  const reports = useQuery({
    queryKey: queryKeys.admin('reports', status),
    queryFn: () => get<AdminReportedPost[]>(`/admin/reports?status=${status}`)
  })

  const act = useMutation({
    mutationFn: ({ postId, action, reason }: { postId: string; action: 'hide' | 'unhide' | 'dismiss-reports'; reason?: string }) =>
      post(`/admin/posts/${postId}/${action}`, reason ? { reason } : {}),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'hide' ? 'Đã ẩn bài viết' : v.action === 'unhide' ? 'Đã hiện lại bài viết' : 'Đã bỏ qua báo cáo')
      // Bài bị ẩn/hiện ⇒ feed cache cũ không còn đúng
      void qc.invalidateQueries({ queryKey: ['feed'] })
      void refresh()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <>
      <div className="flex gap-1.5">
        {(['pending', 'resolved'] as const).map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold cursor-pointer',
              status === s ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {s === 'pending' ? 'Chờ xử lý' : 'Đã xử lý'}
          </button>
        ))}
      </div>
      {reports.isPending ? (
        <Loading />
      ) : !reports.data?.length ? (
        <EmptyState text={status === 'pending' ? 'Không có báo cáo nào cần xử lý 🎉' : 'Chưa xử lý báo cáo nào.'} />
      ) : (
        reports.data.map((r) => (
          <ReportRow
            key={r.postId}
            report={r}
            busy={act.isPending && act.variables?.postId === r.postId}
            onAction={(action, reason) => act.mutate({ postId: r.postId, action, reason })}
          />
        ))
      )}
    </>
  )
}

function ReportRow({
  report,
  busy,
  onAction
}: {
  report: AdminReportedPost
  busy: boolean
  onAction: (action: 'hide' | 'unhide' | 'dismiss-reports', reason?: string) => void
}) {
  const [confirmHide, setConfirmHide] = useState(false)
  const [reason, setReason] = useState('')
  const hidden = !!report.hiddenAt

  return (
    <div className="rounded-xl bg-card p-4 space-y-2.5">
      <div className="flex items-center gap-2 text-xs">
        <Avatar className="h-6 w-6">
          <AvatarImage src={report.author.avatarUrl || ''} />
          <AvatarFallback className="text-[9px]">{report.author.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <Link href={`/${report.author.username}`} className="font-semibold hover:underline truncate">
          {report.author.displayName}
        </Link>
        {report.author.status === 'suspended' && (
          <span className="rounded-full bg-destructive/10 text-destructive px-1.5 py-0.5 text-[10px] font-semibold">Đã khóa</span>
        )}
        <span className="text-muted-foreground ml-auto shrink-0">{formatRelativeTime(report.lastReportedAt)}</span>
      </div>

      <Link href={`/post/${report.postId}`} className="block rounded-lg bg-muted/40 p-3 hover:bg-muted/60">
        {report.title && <p className="text-sm font-semibold line-clamp-1">{report.title}</p>}
        <p className="text-xs text-muted-foreground line-clamp-3">{markdownToPlainText(report.content)}</p>
      </Link>

      <div className="flex flex-wrap items-center gap-1.5 text-[11px]">
        <span className="font-semibold text-brand-orange">{report.reportCount} báo cáo</span>
        {report.reasons.map((x) => (
          <span key={x.reason} className="rounded-full bg-muted px-2 py-0.5">
            {REASON_LABELS[x.reason] || x.reason} · {x.count}
          </span>
        ))}
        {hidden && <span className="rounded-full bg-destructive/10 text-destructive px-2 py-0.5 font-semibold">Đang ẩn</span>}
      </div>
      {report.details.length > 0 && (
        <ul className="text-xs text-muted-foreground list-disc pl-4 space-y-0.5">
          {report.details.map((d, i) => (
            <li key={i} className="line-clamp-2">{d}</li>
          ))}
        </ul>
      )}

      {confirmHide ? (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do ẩn (không bắt buộc)"
            className="h-8 text-xs"
            maxLength={255}
          />
          <Button size="sm" variant="destructive" className="h-8 text-xs" disabled={busy} onClick={() => onAction('hide', reason.trim() || undefined)}>
            {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Xác nhận ẩn'}
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirmHide(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      ) : (
        <div className="flex gap-1.5">
          {hidden ? (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onAction('unhide')}>
              <Eye className="h-3.5 w-3.5" /> Hiện lại
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive" disabled={busy} onClick={() => setConfirmHide(true)}>
              <EyeOff className="h-3.5 w-3.5" /> Ẩn bài
            </Button>
          )}
          {!hidden && report.reportCount > 0 && (
            <Button size="sm" variant="ghost" className="h-8 text-xs" disabled={busy} onClick={() => onAction('dismiss-reports')}>
              Bỏ qua
            </Button>
          )}
        </div>
      )}
    </div>
  )
}

function UsersTab({ currentUserId }: { currentUserId: string }) {
  const [q, setQ] = useState('')
  const [onlySuspended, setOnlySuspended] = useState(false)
  const [insightId, setInsightId] = useState<string | null>(null)
  const refresh = useAdminRefresh()
  const params = new URLSearchParams()
  if (q.trim()) params.set('q', q.trim())
  if (onlySuspended) params.set('status', 'suspended')

  const users = useQuery({
    queryKey: queryKeys.admin('users', q.trim(), onlySuspended),
    queryFn: () => get<AdminUserRow[]>(`/admin/users?${params.toString()}`),
    placeholderData: (prev) => prev
  })

  const act = useMutation({
    mutationFn: ({ id, action, reason }: { id: string; action: 'suspend' | 'unsuspend'; reason?: string }) =>
      post(`/admin/users/${id}/${action}`, reason ? { reason } : {}),
    onSuccess: (_d, v) => {
      toast.success(v.action === 'suspend' ? 'Đã khóa tài khoản' : 'Đã mở khóa tài khoản')
      void refresh()
    },
    onError: (err: Error) => toast.error(err.message)
  })

  return (
    <>
      <div className="flex items-center gap-2">
        <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Tìm username, email, tên" className="h-9 text-sm rounded-full" />
        <button
          onClick={() => setOnlySuspended((v) => !v)}
          className={cn(
            'px-3 h-9 rounded-full text-xs font-semibold shrink-0 cursor-pointer',
            onlySuspended ? 'bg-destructive/10 text-destructive' : 'text-muted-foreground hover:bg-muted'
          )}
        >
          Đang khóa
        </button>
      </div>
      {users.isPending ? (
        <Loading />
      ) : !users.data?.length ? (
        <EmptyState text="Không có người dùng phù hợp." />
      ) : (
        users.data.map((u) => (
          <UserRow
            key={u.id}
            user={u}
            isSelf={u.id === currentUserId}
            busy={act.isPending && act.variables?.id === u.id}
            onAction={(action, reason) => act.mutate({ id: u.id, action, reason })}
            onInsight={() => setInsightId(u.id)}
          />
        ))
      )}
      <UserInsightDialog userId={insightId} onClose={() => setInsightId(null)} />
    </>
  )
}

function UserRow({
  user,
  isSelf,
  busy,
  onAction,
  onInsight
}: {
  user: AdminUserRow
  isSelf: boolean
  busy: boolean
  onAction: (action: 'suspend' | 'unsuspend', reason?: string) => void
  onInsight: () => void
}) {
  const [confirm, setConfirm] = useState(false)
  const [reason, setReason] = useState('')
  const suspended = user.status === 'suspended'
  const protectedAccount = isSelf || user.role === 'admin'

  return (
    <div className="rounded-xl bg-card p-3.5 space-y-2">
      <div className="flex items-center gap-2.5">
        <Avatar className="h-9 w-9">
          <AvatarImage src={user.avatarUrl || ''} />
          <AvatarFallback className="text-[10px]">{user.displayName.slice(0, 2).toUpperCase()}</AvatarFallback>
        </Avatar>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-1.5">
            <Link href={`/${user.username}`} className="text-sm font-semibold truncate hover:underline">
              {user.displayName}
            </Link>
            {user.role !== 'student' && <span className="rounded bg-primary/10 text-primary px-1.5 text-[10px] font-semibold">{user.role}</span>}
            {suspended && <span className="rounded bg-destructive/10 text-destructive px-1.5 text-[10px] font-semibold">Đã khóa</span>}
          </div>
          <p className="text-[11px] text-muted-foreground truncate">
            @{user.username} · {user.email} · {user.postCount} bài · {user.reportCount} lượt bị báo cáo
          </p>
          {suspended && user.suspendedReason && (
            <p className="text-[11px] text-destructive truncate">Lý do: {user.suspendedReason}</p>
          )}
        </div>
        <Button size="icon" variant="ghost" className="h-8 w-8 shrink-0" title="Dữ liệu cá nhân hóa" aria-label="Dữ liệu cá nhân hóa" onClick={onInsight}>
          <Activity className="h-3.5 w-3.5" />
        </Button>
        {!protectedAccount && !confirm && (
          suspended ? (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5" disabled={busy} onClick={() => onAction('unsuspend')}>
              <LockOpen className="h-3.5 w-3.5" /> Mở khóa
            </Button>
          ) : (
            <Button size="sm" variant="outline" className="h-8 text-xs gap-1.5 text-destructive" disabled={busy} onClick={() => setConfirm(true)}>
              <Lock className="h-3.5 w-3.5" /> Khóa
            </Button>
          )
        )}
      </div>
      {confirm && (
        <div className="flex items-center gap-1.5">
          <Input
            autoFocus
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Lý do khóa (người dùng sẽ bị đăng xuất ngay)"
            className="h-8 text-xs"
            maxLength={255}
          />
          <Button
            size="sm"
            variant="destructive"
            className="h-8 text-xs"
            disabled={busy}
            onClick={() => {
              onAction('suspend', reason.trim() || undefined)
              setConfirm(false)
            }}
          >
            Xác nhận khóa
          </Button>
          <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => setConfirm(false)}>
            <X className="h-3.5 w-3.5" />
          </Button>
        </div>
      )}
    </div>
  )
}

function ZeroResultsTab() {
  const [days, setDays] = useState(30)
  const data = useQuery({
    queryKey: queryKeys.admin('zero-results', days),
    queryFn: () => get<ZeroResultQuery[]>(`/admin/search/zero-results?days=${days}`)
  })
  return (
    <>
      <div className="flex items-center gap-1.5">
        {[7, 30, 90].map((d) => (
          <button
            key={d}
            onClick={() => setDays(d)}
            className={cn(
              'px-3 py-1 rounded-full text-xs font-semibold cursor-pointer',
              days === d ? 'bg-primary text-primary-foreground' : 'text-muted-foreground hover:bg-muted'
            )}
          >
            {d} ngày
          </button>
        ))}
      </div>
      {data.isPending ? (
        <Loading />
      ) : !data.data?.length ? (
        <EmptyState text="Không có từ khóa nào tìm mà không ra kết quả." />
      ) : (
        <div className="rounded-xl bg-card divide-y divide-border/60">
          {data.data.map((row) => (
            <div key={row.query} className="flex items-center gap-3 px-4 py-2.5">
              <SearchX className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-sm flex-1 truncate">{row.query}</span>
              <span className="text-[11px] text-muted-foreground">{formatRelativeTime(row.lastSearchedAt)}</span>
              <span className="text-xs font-bold tabular-nums w-8 text-right">{row.count}</span>
            </div>
          ))}
        </div>
      )}
    </>
  )
}

function AuditLogTab() {
  const logs = useQuery({
    queryKey: queryKeys.admin('logs'),
    queryFn: () => get<AdminAuditLog[]>('/admin/audit-logs?limit=100')
  })
  if (logs.isPending) return <Loading />
  if (!logs.data?.length) return <EmptyState text="Chưa có thao tác quản trị nào." />
  return (
    <div className="rounded-xl bg-card divide-y divide-border/60">
      {logs.data.map((log) => {
        const reason = typeof log.details?.reason === 'string' ? log.details.reason : null
        return (
          <div key={log.id} className="px-4 py-2.5 text-xs space-y-0.5">
            <div className="flex items-center gap-2">
              <span className="font-semibold">{ACTION_LABELS[log.action] || log.action}</span>
              <span className="text-muted-foreground ml-auto">{formatRelativeTime(log.createdAt)}</span>
            </div>
            <p className="text-muted-foreground">
              bởi @{log.admin?.username || 'không rõ'} ·{' '}
              {log.targetType === 'post' ? (
                <Link href={`/post/${log.targetId}`} className="hover:underline">bài viết</Link>
              ) : (
                'người dùng'
              )}{' '}
              <span className="font-mono">{log.targetId.slice(0, 8)}</span>
              {reason && <> · “{reason}”</>}
            </p>
          </div>
        )
      })}
    </div>
  )
}
