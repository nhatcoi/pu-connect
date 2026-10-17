import React from 'react'
import { AlertTriangle, Eye, KeyRound, LogIn, LogOut, MonitorSmartphone, ShieldX, Users } from 'lucide-react'
import type { AdminUserRow, SecurityEvent } from '@pu/schemas'
import { cn, formatRelativeTime } from '@/lib/api'
import { Avatar, Badge, ErrorState, Skeleton } from '@/components/ui'
import { useUserSecurity } from './use-users'

const EVENT_LABEL: Record<string, string> = {
  login: 'Đăng nhập',
  login_failed: 'Sai mật khẩu',
  login_blocked: 'Đăng nhập khi bị khóa',
  logout: 'Đăng xuất',
  register: 'Đăng ký',
  password_reset: 'Đặt lại mật khẩu',
  password_reset_requested: 'Yêu cầu đặt lại mật khẩu',
  email_verified: 'Xác thực email',
  session_revoked: 'Đăng xuất thiết bị khác'
}

const EVENT_ICON: Record<string, React.ElementType> = {
  login: LogIn,
  register: LogIn,
  logout: LogOut,
  login_failed: ShieldX,
  login_blocked: ShieldX,
  password_reset: KeyRound,
  password_reset_requested: KeyRound,
  session_revoked: LogOut
}

// Điểm rủi ro + lý do (hiện ở tab Tổng quan)
export function RiskCard({ u }: { u: AdminUserRow }) {
  if (!u.riskScore) return null
  const high = u.riskScore >= 50
  return (
    <div className={cn('rounded-lg border p-3 text-sm', high ? 'border-red-500/30 bg-red-500/5' : 'border-amber-500/30 bg-amber-500/5')}>
      <p className={cn('flex items-center gap-1.5 font-medium', high ? 'text-danger' : 'text-warning')}>
        <AlertTriangle className="size-4" /> Điểm rủi ro {u.riskScore}/100
      </p>
      <ul className="mt-1.5 space-y-0.5 text-muted-foreground">
        {u.riskFactors.map((f) => (
          <li key={f.key} className="flex justify-between gap-3">
            <span>{f.label}</span>
            <span className="tabular-nums">+{f.points}</span>
          </li>
        ))}
      </ul>
    </div>
  )
}

export function SecurityTab({ userId, onOpenUser }: { userId: string; onOpenUser: (id: string) => void }) {
  const { data, isPending, isError, error } = useUserSecurity(userId, true)

  if (isPending) {
    return (
      <div className="space-y-3">
        <Skeleton className="h-16" />
        <Skeleton className="h-40" />
      </div>
    )
  }
  if (isError || !data) return <ErrorState message={(error as Error)?.message || 'Không tải được dữ liệu'} />

  return (
    <div className="space-y-6 text-sm">
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" /> Lượt xem này được ghi vào nhật ký · dữ liệu giữ 90 ngày
      </p>

      {data.failedLogins24h >= 5 && (
        <div className="flex gap-2 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3">
          <ShieldX className="mt-0.5 size-4 shrink-0 text-warning" />
          <p className="text-foreground">{data.failedLogins24h} lần đăng nhập sai trong 24 giờ — có thể đang bị dò mật khẩu.</p>
        </div>
      )}

      <Section title="Tài khoản dùng chung IP" icon={Users} hint="Bỏ qua IP có hơn 10 tài khoản (wifi trường, NAT)">
        {data.linkedAccounts.length === 0 ? (
          <p className="text-muted-foreground">Không có</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {data.linkedAccounts.map((a) => (
              <li key={a.id}>
                <button type="button" onClick={() => onOpenUser(a.id)} className="flex w-full items-center gap-3 px-3 py-2 text-left hover:bg-accent/60 cursor-pointer">
                  <Avatar src={a.avatarUrl} name={a.displayName} className="size-8" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate font-medium text-foreground">{a.displayName}</span>
                    <span className="block truncate text-xs text-muted-foreground">
                      @{a.username} · {a.sharedIps} IP chung · {formatRelativeTime(a.lastSeenTogetherAt)}
                    </span>
                  </span>
                  {a.status === 'suspended' && <Badge tone="danger">Bị khóa</Badge>}
                </button>
              </li>
            ))}
          </ul>
        )}
      </Section>

      <Section title="IP gần đây" icon={MonitorSmartphone}>
        {data.ips.length === 0 ? (
          <p className="text-muted-foreground">Chưa có dữ liệu (nhật ký bắt đầu từ 17/10/2026)</p>
        ) : (
          <table className="w-full text-sm">
            <tbody className="divide-y divide-border">
              {data.ips.map((ip) => (
                <tr key={ip.ip}>
                  <td className="py-1.5 font-mono text-xs">{ip.ip}</td>
                  <td className="py-1.5 text-xs text-muted-foreground">{ip.count} lần</td>
                  <td className="py-1.5 text-xs">
                    {ip.accounts > 10 ? (
                      <span className="text-muted-foreground">{ip.accounts} TK · mạng chung</span>
                    ) : ip.accounts > 1 ? (
                      <span className="font-medium text-warning">{ip.accounts} tài khoản</span>
                    ) : (
                      <span className="text-muted-foreground">chỉ người này</span>
                    )}
                  </td>
                  <td className="py-1.5 text-right text-xs text-muted-foreground">{formatRelativeTime(ip.lastAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </Section>

      {data.devices.length > 0 && (
        <Section title="Thiết bị">
          <div className="flex flex-wrap gap-1.5">
            {data.devices.map((d) => (
              <Badge key={d.device}>
                {d.device} · {d.count}
              </Badge>
            ))}
          </div>
        </Section>
      )}

      <Section title="Hoạt động bảo mật">
        {data.events.length === 0 ? (
          <p className="text-muted-foreground">Chưa có</p>
        ) : (
          <ul className="space-y-2">
            {data.events.map((e) => (
              <EventRow key={e.id} e={e} />
            ))}
          </ul>
        )}
      </Section>
    </div>
  )
}

function EventRow({ e }: { e: SecurityEvent }) {
  const Icon = EVENT_ICON[e.event] ?? LogIn
  return (
    <li className="flex items-start gap-2.5">
      <Icon className={cn('mt-0.5 size-4 shrink-0', e.success ? 'text-muted-foreground' : 'text-danger')} />
      <div className="min-w-0 flex-1">
        <p className={cn('text-foreground', !e.success && 'text-danger')}>
          {EVENT_LABEL[e.event] ?? e.event}
          {e.method && <span className="text-muted-foreground"> · {e.method === 'google' ? 'Google' : 'mật khẩu'}</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[e.device, e.ip].filter(Boolean).join(' · ')} · {formatRelativeTime(e.createdAt)}
        </p>
      </div>
    </li>
  )
}

function Section({ title, icon: Icon, hint, children }: { title: string; icon?: React.ElementType; hint?: string; children: React.ReactNode }) {
  return (
    <section>
      <h3 className="mb-2 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
        {Icon && <Icon className="size-3.5" />}
        {title}
      </h3>
      {hint && <p className="-mt-1 mb-2 text-xs text-muted-foreground">{hint}</p>}
      {children}
    </section>
  )
}
