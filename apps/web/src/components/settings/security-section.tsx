'use client'

import React from 'react'
import { Laptop, Loader2, LogIn, LogOut, KeyRound, ShieldX, Smartphone } from 'lucide-react'
import type { LoginSession, SecurityEvent } from '@pu/schemas'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { useLoginSessions, useRevokeSessions, useSecurityEvents } from '@/hooks/use-login-sessions'
import { formatRelativeTime } from '@/lib/utils'
import { SettingsGroup } from './settings-ui'

const EVENT_LABEL: Record<string, string> = {
  login: 'Đăng nhập',
  login_failed: 'Nhập sai mật khẩu',
  login_blocked: 'Đăng nhập bị chặn',
  logout: 'Đăng xuất',
  register: 'Tạo tài khoản',
  password_reset: 'Đặt lại mật khẩu',
  password_reset_requested: 'Yêu cầu đặt lại mật khẩu',
  email_verified: 'Xác thực email',
  session_revoked: 'Đăng xuất thiết bị khác'
}

const isMobile = (device: string) => /iPhone|Android|iPad/.test(device)

// Đăng nhập & Bảo mật: thiết bị đang đăng nhập + hoạt động gần đây
export function SecuritySection() {
  const sessions = useLoginSessions()
  const events = useSecurityEvents()
  const { one, others } = useRevokeSessions()
  const otherCount = (sessions.data ?? []).filter((s) => !s.current).length

  return (
    <>
      <SettingsGroup label="Thiết bị đang đăng nhập" hint="Thấy thiết bị lạ? Đăng xuất ngay và đổi mật khẩu.">
        {sessions.isPending ? (
          <div className="space-y-3 py-2">
            <Skeleton className="h-12 w-full" />
            <Skeleton className="h-12 w-full" />
          </div>
        ) : (
          <>
            {(sessions.data ?? []).map((s) => (
              <SessionRow key={s.id} s={s} busy={one.isPending && one.variables === s.id} onRevoke={() => one.mutate(s.id)} />
            ))}
            {otherCount > 0 && (
              <div className="pt-2">
                <Button size="sm" variant="outline" className="h-8 rounded-full px-3.5 text-xs" disabled={others.isPending} onClick={() => others.mutate()}>
                  {others.isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <LogOut className="h-3.5 w-3.5" />}
                  Đăng xuất {otherCount} thiết bị khác
                </Button>
              </div>
            )}
          </>
        )}
      </SettingsGroup>

      <SettingsGroup label="Hoạt động đăng nhập gần đây" hint="Lưu 90 ngày để bảo vệ tài khoản của bạn.">
        {events.isPending ? (
          <Skeleton className="my-2 h-24 w-full" />
        ) : !events.data?.length ? (
          <p className="py-4 text-[13px] text-muted-foreground">Chưa có hoạt động nào được ghi nhận.</p>
        ) : (
          events.data.map((e) => <EventRow key={e.id} e={e} />)
        )}
      </SettingsGroup>
    </>
  )
}

function SessionRow({ s, busy, onRevoke }: { s: LoginSession; busy: boolean; onRevoke: () => void }) {
  const Icon = isMobile(s.device) ? Smartphone : Laptop
  return (
    <div className="flex items-center gap-3 py-2.5">
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted/70">
        <Icon className="h-4 w-4 text-muted-foreground" />
      </span>
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold">
          {s.device}
          {s.current && <span className="ml-1.5 text-xs font-medium text-emerald-600 dark:text-emerald-400">· Thiết bị này</span>}
        </p>
        <p className="truncate text-xs text-muted-foreground">
          {[s.ip, s.method === 'google' ? 'Google' : s.method === 'password' ? 'Mật khẩu' : null, `hoạt động ${formatRelativeTime(s.lastActiveAt)}`]
            .filter(Boolean)
            .join(' · ')}
        </p>
      </div>
      {!s.current && (
        <Button size="sm" variant="outline" className="h-8 rounded-full px-3.5 text-xs" disabled={busy} onClick={onRevoke}>
          {busy ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : 'Đăng xuất'}
        </Button>
      )}
    </div>
  )
}

function EventRow({ e }: { e: SecurityEvent }) {
  const Icon = !e.success ? ShieldX : e.event.startsWith('password') ? KeyRound : e.event === 'logout' || e.event === 'session_revoked' ? LogOut : LogIn
  return (
    <div className="flex items-start gap-3 py-2">
      <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${e.success ? 'text-muted-foreground' : 'text-red-500'}`} />
      <div className="min-w-0 flex-1">
        <p className={`text-[13px] ${e.success ? '' : 'font-medium text-red-500'}`}>{EVENT_LABEL[e.event] ?? e.event}</p>
        <p className="truncate text-xs text-muted-foreground">{[e.device, e.ip, formatRelativeTime(e.createdAt)].filter(Boolean).join(' · ')}</p>
      </div>
    </div>
  )
}
