import React from 'react'
import { AlertTriangle, ChevronRight, Flag, LifeBuoy } from 'lucide-react'
import type { AdminPermission, AdminStats } from '@pu/schemas'
import type { NavId } from '@/App'
import { cn, formatCompact, formatNumber, ROLE_SHORT } from '@/lib/api'
import { Card, CardHeader, PageHeader, Skeleton, Stat } from '@/components/ui'

const ROLE_BAR: Record<string, string> = {
  admin: 'bg-red-500',
  lecturer: 'bg-primary',
  ta: 'bg-green-500',
  club_lead: 'bg-brand-orange',
  student: 'bg-zinc-300 dark:bg-zinc-600'
}

interface DashboardTabProps {
  stats?: AdminStats
  isLoading: boolean
  permissions: AdminPermission[]
  userName: string
  onNavigate: (tab: NavId) => void
}

export function DashboardTab({ stats: s, isLoading, permissions, userName, onNavigate }: DashboardTabProps) {
  const can = (p: AdminPermission) => permissions.includes(p)
  const go = (tab: NavId, perm: AdminPermission) => (can(perm) ? () => onNavigate(tab) : undefined)

  return (
    <>
      <PageHeader title="Tổng quan" description={`Xin chào, ${userName}`} />

      {isLoading || !s ? (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          {Array.from({ length: 8 }, (_, i) => (
            <Skeleton key={i} className="h-[106px] rounded-xl" />
          ))}
        </div>
      ) : (
        <div className="space-y-6">
          {/* Việc cần xử lý */}
          {(s.pendingReports > 0 || s.openSupportTickets > 0 || s.aiErrorRuns24h > 0) && (
            <Card className="divide-y divide-border overflow-hidden">
              {s.pendingReports > 0 && (
                <TodoRow
                  icon={Flag}
                  tone="warning"
                  title={`${s.pendingReports} báo cáo chờ duyệt`}
                  sub={`Trên ${s.reportedPosts} bài viết`}
                  onClick={go('moderation', 'moderation:read')}
                />
              )}
              {s.openSupportTickets > 0 && (
                <TodoRow
                  icon={LifeBuoy}
                  tone="primary"
                  title={`${s.openSupportTickets} yêu cầu hỗ trợ N7AI`}
                  sub="Chưa xử lý"
                  onClick={go('ai', 'ai:read')}
                />
              )}
              {s.aiErrorRuns24h > 0 && (
                <TodoRow
                  icon={AlertTriangle}
                  tone="danger"
                  title={`${s.aiErrorRuns24h} lỗi N7AI trong 24 giờ`}
                  sub="Xem nhật ký lỗi"
                  onClick={go('ai', 'ai:read')}
                />
              )}
            </Card>
          )}

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Cộng đồng</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Thành viên"
                value={formatNumber(s.totalUsers)}
                sub={`+${s.newUsers7d} trong 7 ngày`}
                onClick={go('users', 'users:read')}
              />
              <Stat
                label="Hoạt động 24h"
                value={formatNumber(s.activeUsers24h)}
                sub={`${s.totalUsers ? Math.round((s.activeUsers24h / s.totalUsers) * 100) : 0}% thành viên`}
              />
              <Stat
                label="Bài viết"
                value={formatNumber(s.totalPosts)}
                sub={`${formatNumber(s.totalComments)} bình luận`}
                onClick={go('moderation', 'moderation:read')}
              />
              <Stat
                label="Báo cáo chờ"
                value={formatNumber(s.pendingReports)}
                tone={s.pendingReports > 0 ? 'warning' : undefined}
                sub={`${s.hiddenPosts} bài đang ẩn`}
                onClick={go('moderation', 'moderation:read')}
              />
            </div>
          </section>

          <section className="space-y-3">
            <h2 className="text-sm font-semibold text-muted-foreground">Học thuật & N7AI</h2>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
              <Stat
                label="Học phần"
                value={formatNumber(s.totalCourses)}
                sub={`${s.totalStudyGroups} nhóm học`}
                onClick={go('academic', 'academic:read')}
              />
              <Stat
                label="Tài liệu"
                value={formatNumber(s.totalDocuments)}
                sub={`${s.totalCommunities} cộng đồng`}
                onClick={go('academic', 'academic:read')}
              />
              <Stat
                label="Lượt N7AI 24h"
                value={formatNumber(s.aiRuns24h)}
                sub={`${formatCompact(s.aiTokens24h)} tokens`}
                onClick={go('ai', 'ai:read')}
              />
              <Stat
                label="Độ trễ TB"
                value={`${(s.aiAvgLatencyMs24h / 1000).toFixed(1)}s`}
                tone={s.aiAvgLatencyMs24h > 8000 ? 'warning' : undefined}
                sub="24 giờ qua"
                onClick={go('ai', 'ai:read')}
              />
            </div>
          </section>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-3">
            <Card className="lg:col-span-2">
              <CardHeader title="Phân bố vai trò" description={`${formatNumber(s.totalUsers)} tài khoản`} />
              <div className="space-y-4 px-5 pb-5">
                <div className="flex h-2.5 overflow-hidden rounded-full bg-muted">
                  {s.roleDistribution.map((r) => (
                    <div
                      key={r.role}
                      className={cn('h-full', ROLE_BAR[r.role])}
                      style={{ width: `${(r.count / Math.max(1, s.totalUsers)) * 100}%` }}
                    />
                  ))}
                </div>
                <ul className="grid grid-cols-2 gap-x-6 gap-y-2.5 sm:grid-cols-3">
                  {s.roleDistribution.map((r) => (
                    <li key={r.role} className="flex items-center gap-2 text-sm">
                      <span className={cn('size-2 shrink-0 rounded-full', ROLE_BAR[r.role])} />
                      <span className="flex-1 truncate text-muted-foreground">{ROLE_SHORT[r.role] ?? r.role}</span>
                      <span className="font-semibold tabular-nums text-foreground">{formatNumber(r.count)}</span>
                    </li>
                  ))}
                </ul>
              </div>
            </Card>

            <Card>
              <CardHeader title="An toàn tài khoản" />
              <dl className="divide-y divide-border px-5 pb-2 text-sm">
                <Row label="Đã xác thực" value={s.verifiedUsers} />
                <Row label="Đang bị khóa" value={s.suspendedUsers} danger={s.suspendedUsers > 0} />
                <Row label="Bài viết đang ẩn" value={s.hiddenPosts} />
              </dl>
            </Card>
          </div>
        </div>
      )}
    </>
  )
}

function TodoRow({
  icon: Icon,
  tone,
  title,
  sub,
  onClick
}: {
  icon: React.ElementType
  tone: 'warning' | 'primary' | 'danger'
  title: string
  sub: string
  onClick?: () => void
}) {
  const toneCls = {
    warning: 'bg-amber-500/12 text-warning',
    primary: 'bg-primary/10 text-primary',
    danger: 'bg-red-500/10 text-danger'
  }[tone]
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={!onClick}
      className="flex w-full items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-accent/60 disabled:cursor-default cursor-pointer"
    >
      <span className={cn('flex size-9 shrink-0 items-center justify-center rounded-full', toneCls)}>
        <Icon className="size-4" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-sm font-semibold text-foreground">{title}</span>
        <span className="block text-xs text-muted-foreground">{sub}</span>
      </span>
      {onClick && <ChevronRight className="size-4 text-muted-foreground" />}
    </button>
  )
}

function Row({ label, value, danger }: { label: string; value: number; danger?: boolean }) {
  return (
    <div className="flex items-center justify-between py-2.5">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className={cn('font-semibold tabular-nums', danger ? 'text-danger' : 'text-foreground')}>{formatNumber(value)}</dd>
    </div>
  )
}
