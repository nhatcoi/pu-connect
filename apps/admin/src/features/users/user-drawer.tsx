import React, { useState } from 'react'
import { Activity, BadgeCheck, Ban, Chrome, Gavel, KeyRound, LockOpen, LogOut, MoreHorizontal, ShieldAlert, ShieldCheck, StickyNote, Trash2, Undo2, Lock, Maximize2, Minimize2 } from 'lucide-react'
import type { AdminUserDetail, AdminUserRow } from '@pu/schemas'
import { cn, formatNumber, formatRelativeTime, markdownToPlainText, ROLE_SHORT, WEB_PORTAL_URL } from '@/lib/api'
import { Avatar, Badge, Button, Drawer, ErrorState, ROLE_TONE, Skeleton, Tabs, Textarea } from '@/components/ui'
import { ACTION_LABELS } from '@/tabs/system-ops-tab'
import { UserActionsMenu, type UserActionHandlers } from './user-actions'
import { isOnline, useRevokeSanction, useUserDetail, useUserNotes } from './use-users'
import { durationLabel, SANCTION_LABEL } from './sanction-dialog'
import { RiskCard, SecurityTab } from './user-security'
import { ActivityTab, ProfileViewsTab, SessionsPanel } from './user-activity'

type Tab = 'overview' | 'activity' | 'views' | 'security' | 'sanctions' | 'moderation' | 'notes'

export function UserDrawer({
  userId,
  selfId,
  onClose,
  handlers
}: {
  userId: string | null
  selfId: string
  onClose: () => void
  handlers: UserActionHandlers
}) {
  const { data, isPending, isError, error } = useUserDetail(userId)
  const [tab, setTab] = useState<Tab>('overview')
  // Phóng to ⇒ gần toàn màn hình (nhớ theo trình duyệt)
  const [wide, setWide] = useState(() => {
    try {
      return localStorage.getItem('puc-admin-drawer') === 'wide'
    } catch {
      return false
    }
  })
  const toggleWide = () =>
    setWide((v) => {
      try {
        localStorage.setItem('puc-admin-drawer', v ? 'normal' : 'wide')
      } catch {
        // ignore
      }
      return !v
    })
  const u = data?.user
  const openUser = (id: string) => handlers.onOpen?.(id)

  return (
    <Drawer
      open={!!userId}
      onClose={onClose}
      width={wide ? 'sm:max-w-[min(1200px,92vw)]' : 'sm:max-w-xl'}
      actions={
        <Button variant="ghost" size="icon-sm" onClick={toggleWide} aria-label={wide ? 'Thu nhỏ' : 'Phóng to'} title={wide ? 'Thu nhỏ' : 'Phóng to'} className="hidden sm:inline-flex">
          {wide ? <Minimize2 /> : <Maximize2 />}
        </Button>
      }
      header={
        u ? (
          <DrawerHeader u={u} />
        ) : (
          <div className="flex items-center gap-3">
            <Skeleton className="size-14 rounded-full" />
            <div className="space-y-2">
              <Skeleton className="h-4 w-40" />
              <Skeleton className="h-3 w-28" />
            </div>
          </div>
        )
      }
    >
      {isPending ? (
        <div className="space-y-3 p-5">
          <Skeleton className="h-9" />
          <Skeleton className="h-28" />
          <Skeleton className="h-40" />
        </div>
      ) : isError || !data || !u ? (
        <div className="p-5">
          <ErrorState message={(error as Error)?.message || 'Không tải được hồ sơ'} />
        </div>
      ) : (
        <>
          {/* Hành động nhanh */}
          <div className="flex flex-wrap gap-2 border-b border-border px-5 py-3">
            <Button size="sm" onClick={() => handlers.run({ ids: [u.id], action: u.isVerified ? 'unverify' : 'verify' })}>
              <BadgeCheck /> {u.isVerified ? 'Gỡ tích xanh' : 'Cấp tích xanh'}
            </Button>
            {u.id !== selfId && (
              <>
                <Button size="sm" onClick={() => handlers.run({ ids: [u.id], action: 'revoke_sessions' })}>
                  <LogOut /> Đăng xuất
                </Button>
                {u.status === 'suspended' && (
                  <Button size="sm" onClick={() => handlers.run({ ids: [u.id], action: 'unsuspend' })}>
                    <LockOpen /> Mở khóa
                  </Button>
                )}
                {u.isRestricted && (
                  <Button size="sm" onClick={() => handlers.run({ ids: [u.id], action: 'unrestrict' })}>
                    <ShieldCheck /> Gỡ hạn chế
                  </Button>
                )}
                {u.role !== 'admin' && u.status !== 'suspended' && (
                  <Button size="sm" onClick={() => handlers.onSanction([u], 'suspend')}>
                    <Lock /> Khóa
                  </Button>
                )}
                {u.role !== 'admin' && (
                  <Button size="sm" variant="danger" onClick={() => handlers.onSanction([u])}>
                    <Gavel /> Xử phạt
                  </Button>
                )}
              </>
            )}
            <UserActionsMenu
              user={u}
              selfId={selfId}
              handlers={{ ...handlers, onOpen: undefined }}
              trigger={(p) => (
                <Button size="icon-sm" aria-label="Thêm" {...p}>
                  <MoreHorizontal />
                </Button>
              )}
            />
          </div>

          <div className="px-5 pt-3">
            <Tabs
              value={tab}
              onChange={setTab}
              items={[
                { id: 'overview', label: 'Tổng quan' },
                { id: 'activity', label: 'Hoạt động' },
                { id: 'views', label: 'Lượt xem hồ sơ' },
                { id: 'security', label: 'Phiên & Bảo mật', count: data.stats.activeSessions || undefined },
                { id: 'sanctions', label: 'Xử phạt', count: data.recommendation.strikes || undefined },
                { id: 'moderation', label: 'Kiểm duyệt', count: data.moderationLog.length || undefined },
                { id: 'notes', label: 'Ghi chú', count: data.notes.length || undefined }
              ]}
            />
          </div>

          <div className="p-5">
            {tab === 'overview' && <Overview d={data} onInsight={handlers.onInsight} />}
            {tab === 'sanctions' && <Sanctions d={data} onSanction={() => handlers.onSanction([u])} />}
            {tab === 'activity' && <ActivityTab userId={u.id} onOpenUser={openUser} />}
            {tab === 'views' && <ProfileViewsTab userId={u.id} onOpenUser={openUser} />}
            {tab === 'security' && (
              <div className="space-y-6">
                <SessionsPanel userId={u.id} canRevokeAll={u.id !== selfId} />
                <SecurityTab userId={u.id} onOpenUser={openUser} />
              </div>
            )}
            {tab === 'moderation' && <Moderation d={data} />}
            {tab === 'notes' && <Notes userId={u.id} d={data} />}
          </div>
        </>
      )}
    </Drawer>
  )
}

function DrawerHeader({ u }: { u: AdminUserRow }) {
  const online = isOnline(u.lastSeenAt)
  return (
    <div className="flex items-center gap-3.5">
      <span className="relative">
        <Avatar src={u.avatarUrl} name={u.displayName} className="size-14 text-lg" />
        {online && <span className="absolute bottom-0.5 right-0.5 size-3.5 rounded-full border-2 border-background bg-green-500" />}
      </span>
      <div className="min-w-0">
        <div className="flex items-center gap-1.5">
          <h2 className="truncate text-lg font-bold text-foreground">{u.displayName}</h2>
          {u.isVerified && <BadgeCheck className="size-5 shrink-0 fill-primary text-background" />}
        </div>
        <a href={`${WEB_PORTAL_URL}/${u.username}`} target="_blank" rel="noreferrer" className="text-sm text-muted-foreground hover:text-primary">
          @{u.username}
        </a>
        <div className="mt-1.5 flex flex-wrap gap-1">
          <Badge tone={ROLE_TONE[u.role]}>{ROLE_SHORT[u.role]}</Badge>
          {u.status === 'suspended' ? (
            <Badge tone="danger" dot>
              Bị khóa
            </Badge>
          ) : online ? (
            <Badge tone="success" dot>
              Online
            </Badge>
          ) : (
            <Badge>Hoạt động {formatRelativeTime(u.lastSeenAt)}</Badge>
          )}
        </div>
      </div>
    </div>
  )
}

function Overview({ d, onInsight }: { d: AdminUserDetail; onInsight?: (id: string) => void }) {
  const u = d.user
  const s = d.stats
  const stats: [string, number, boolean?][] = [
    ['Bài viết', s.posts],
    ['Bình luận', s.comments],
    ['Tài liệu', s.documents],
    ['Người theo dõi', s.followers],
    ['Đang theo dõi', s.following],
    ['Lượt N7AI 30 ngày', s.aiRuns30d],
    ['Bị báo cáo', s.reportsReceived, s.reportsReceived > 0],
    ['Đã báo cáo người khác', s.reportsFiled],
    ['Phiên đang mở', s.activeSessions]
  ]

  return (
    <div className="space-y-6">
      <RiskCard u={u} />
      {u.status === 'suspended' && (
        <div className="flex gap-2.5 rounded-lg border border-red-500/30 bg-red-500/5 p-3 text-sm">
          <Ban className="mt-0.5 size-4 shrink-0 text-danger" />
          <div>
            <p className="font-medium text-danger">
              Bị khóa {formatRelativeTime(u.suspendedAt)} · {u.suspendedUntil ? `đến ${new Date(u.suspendedUntil).toLocaleString('vi-VN')}` : 'vĩnh viễn'}
            </p>
            {u.suspendedReason && <p className="mt-0.5 text-muted-foreground">{u.suspendedReason}</p>}
          </div>
        </div>
      )}
      {u.isRestricted && (
        <div className="flex gap-2.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-3 text-sm">
          <ShieldAlert className="mt-0.5 size-4 shrink-0 text-warning" />
          <div>
            <p className="font-medium text-warning">
              Đang bị hạn chế (chỉ xem) · {u.restrictedUntil ? `đến ${new Date(u.restrictedUntil).toLocaleString('vi-VN')}` : 'vô thời hạn'}
            </p>
            {u.restrictedReason && <p className="mt-0.5 text-muted-foreground">{u.restrictedReason}</p>}
          </div>
        </div>
      )}

      <div className="grid grid-cols-3 overflow-hidden rounded-lg border border-border">
        {stats.map(([label, value, warn], i) => (
          <div key={label} className={cn('px-3 py-2.5', i % 3 !== 2 && 'border-r border-border', i < 6 && 'border-b border-border')}>
            <p className={cn('text-lg font-bold tabular-nums', warn ? 'text-warning' : 'text-foreground')}>{formatNumber(value)}</p>
            <p className="truncate text-[11px] text-muted-foreground">{label}</p>
          </div>
        ))}
      </div>

      <dl className="grid grid-cols-[120px_1fr] gap-x-4 gap-y-2.5 text-sm">
        <Info label="Email">{u.email}</Info>
        <Info label="Mã SV">{u.studentId}</Info>
        <Info label="Khoa">{u.faculty}</Info>
        <Info label="Ngành / lớp">{[u.major, u.className].filter(Boolean).join(' · ')}</Info>
        <Info label="Uy tín">{formatNumber(u.reputationPoints)}</Info>
        <Info label="Đăng nhập bằng">
          <span className="flex gap-1.5">
            {u.authProviders.includes('password') && (
              <Badge>
                <KeyRound /> Mật khẩu
              </Badge>
            )}
            {u.authProviders.includes('google') && (
              <Badge>
                <Chrome /> Google
              </Badge>
            )}
          </span>
        </Info>
        <Info label="Tham gia">{new Date(u.createdAt).toLocaleDateString('vi-VN')}</Info>
        <Info label="Xác thực">{u.verifiedAt ? new Date(u.verifiedAt).toLocaleDateString('vi-VN') : null}</Info>
        <Info label="Giới thiệu">{u.bio}</Info>
      </dl>

      {onInsight && (
        <Button size="sm" variant="ghost" className="-ml-3 text-primary" onClick={() => onInsight(u.id)}>
          <Activity /> Xem dữ liệu cá nhân hóa
        </Button>
      )}

      <section>
        <h3 className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">Bài viết gần đây</h3>
        {d.recentPosts.length === 0 ? (
          <p className="text-sm text-muted-foreground">Chưa có bài viết</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {d.recentPosts.map((p) => (
              <li key={p.id}>
                <a href={`${WEB_PORTAL_URL}/post/${p.id}`} target="_blank" rel="noreferrer" className="block px-3 py-2.5 hover:bg-accent/60">
                  <p className="line-clamp-1 text-sm font-medium text-foreground">{p.title || markdownToPlainText(p.content).slice(0, 80)}</p>
                  <p className="mt-0.5 flex items-center gap-1.5 text-xs text-muted-foreground">
                    {formatRelativeTime(p.createdAt)} · {p.likes} thích · {p.comments} bình luận
                    {p.hiddenAt && <Badge tone="danger">Đã ẩn</Badge>}
                  </p>
                </a>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}

function Info({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <>
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="min-w-0 break-words text-foreground">{children || <span className="text-muted-foreground">—</span>}</dd>
    </>
  )
}

function Sanctions({ d, onSanction }: { d: AdminUserDetail; onSanction: () => void }) {
  const revoke = useRevokeSanction(d.user.id)
  const r = d.recommendation
  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3 rounded-lg border border-border p-3">
        <div className="text-sm">
          <p className="font-medium text-foreground">{r.strikes} lần vi phạm / 180 ngày</p>
          <p className="text-xs text-muted-foreground">
            Bậc tiếp theo: {SANCTION_LABEL[r.kind]}
            {r.kind !== 'warning' && ` ${durationLabel(r.durationDays).toLowerCase()}`}
          </p>
        </div>
        {d.user.role !== 'admin' && (
          <Button size="sm" variant="danger" onClick={onSanction}>
            <Gavel /> Xử phạt
          </Button>
        )}
      </div>

      {d.sanctions.length === 0 ? (
        <p className="text-sm text-muted-foreground">Chưa bị xử phạt lần nào.</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {d.sanctions.map((x) => (
            <li key={x.id} className={cn('flex items-start gap-3 px-3 py-2.5', x.revokedAt && 'opacity-55')}>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-1.5">
                  <Badge tone={x.kind === 'warning' ? 'primary' : x.kind === 'restrict' ? 'warning' : 'danger'}>{SANCTION_LABEL[x.kind]}</Badge>
                  {x.kind !== 'warning' && (
                    <span className="text-xs text-muted-foreground">{x.endsAt ? `đến ${new Date(x.endsAt).toLocaleString('vi-VN')}` : 'vĩnh viễn'}</span>
                  )}
                  {x.active && <Badge tone="danger" dot>Đang hiệu lực</Badge>}
                  {x.revokedAt && <Badge>Đã hủy</Badge>}
                </div>
                {x.reason && <p className="mt-1 text-sm text-foreground">{x.reason}</p>}
                <p className="mt-0.5 text-xs text-muted-foreground">
                  @{x.admin?.username ?? '—'} · {formatRelativeTime(x.startsAt)}
                  {x.revokedAt && ` · hủy bởi @${x.revokedBy?.username ?? '—'}`}
                </p>
              </div>
              {!x.revokedAt && (
                <Button
                  size="sm"
                  variant="ghost"
                  title="Hủy (nhầm lẫn) — không tính là vi phạm, gỡ ngay nếu đang hiệu lực"
                  disabled={revoke.isPending}
                  onClick={() => revoke.mutate(x.id)}
                >
                  <Undo2 /> Hủy
                </Button>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}

function Moderation({ d }: { d: AdminUserDetail }) {
  if (d.moderationLog.length === 0) return <p className="text-sm text-muted-foreground">Chưa có thao tác quản trị nào với tài khoản này.</p>
  return (
    <ol className="relative space-y-4 border-l border-border pl-5">
      {d.moderationLog.map((l) => {
        const reason = (l.details as { reason?: string; to?: string } | null) ?? {}
        return (
          <li key={l.id} className="relative">
            <span className="absolute -left-[25px] top-1.5 size-2.5 rounded-full border-2 border-background bg-primary" />
            <p className="text-sm font-medium text-foreground">
              {ACTION_LABELS[l.action] ?? l.action}
              {reason.to && <span className="font-normal text-muted-foreground"> → {ROLE_SHORT[reason.to] ?? reason.to}</span>}
            </p>
            {reason.reason && <p className="text-sm text-muted-foreground">“{reason.reason}”</p>}
            <p className="text-xs text-muted-foreground">
              @{l.admin?.username ?? 'system'} · {formatRelativeTime(l.createdAt)}
            </p>
          </li>
        )
      })}
    </ol>
  )
}

function Notes({ userId, d }: { userId: string; d: AdminUserDetail }) {
  const [body, setBody] = useState('')
  const { add, remove } = useUserNotes(userId)

  return (
    <div className="space-y-4">
      <form
        onSubmit={(e) => {
          e.preventDefault()
          if (body.trim()) add.mutate(body.trim(), { onSuccess: () => setBody('') })
        }}
        className="space-y-2"
      >
        <Textarea
          rows={3}
          maxLength={1000}
          value={body}
          onChange={(e) => setBody(e.target.value)}
          placeholder="Ghi chú nội bộ — chỉ quản trị viên thấy"
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) e.currentTarget.form?.requestSubmit()
          }}
        />
        <div className="flex items-center justify-between text-xs text-muted-foreground">
          <span>⌘ + Enter để lưu</span>
          <Button type="submit" size="sm" variant="primary" loading={add.isPending} disabled={!body.trim()}>
            Thêm ghi chú
          </Button>
        </div>
      </form>

      {d.notes.length === 0 ? (
        <div className="flex flex-col items-center py-8 text-center text-sm text-muted-foreground">
          <StickyNote className="mb-2 size-5" />
          Chưa có ghi chú
        </div>
      ) : (
        <ul className="space-y-2">
          {d.notes.map((n) => (
            <li key={n.id} className="group rounded-lg border border-border bg-amber-500/5 p-3">
              <p className="whitespace-pre-wrap text-sm text-foreground">{n.body}</p>
              <div className="mt-1.5 flex items-center justify-between text-xs text-muted-foreground">
                <span>
                  @{n.author?.username ?? '—'} · {formatRelativeTime(n.createdAt)}
                </span>
                <button
                  type="button"
                  onClick={() => remove.mutate(n.id)}
                  className="rounded p-1 opacity-0 transition-opacity hover:text-danger group-hover:opacity-100 focus:opacity-100 cursor-pointer"
                  aria-label="Xóa ghi chú"
                >
                  <Trash2 className="size-3.5" />
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
