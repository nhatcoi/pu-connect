import React, { useEffect, useState } from 'react'
import { ChevronLeft, ChevronRight, ExternalLink, Eye, Laptop, LogOut, Smartphone } from 'lucide-react'
import type { AdminActivityItem, AdminActivityType } from '@pu/schemas'
import { cn, formatNumber, formatRelativeTime, WEB_PORTAL_URL } from '@/lib/api'
import { Avatar, Badge, Button, ErrorState, Skeleton } from '@/components/ui'
import { useRevokeUserSession, useUserActivity, useUserSessions, useUserActions } from './use-users'

const ACTIVITY_GROUPS: { label: string; types: [AdminActivityType, string][] }[] = [
  {
    label: 'Nội dung',
    types: [
      ['posts', 'Bài viết'],
      ['comments', 'Bình luận'],
      ['documents', 'Tài liệu']
    ]
  },
  {
    label: 'Tương tác',
    types: [
      ['reactions', 'Cảm xúc'],
      ['saved', 'Đã lưu'],
      ['following', 'Đang theo dõi'],
      ['followers', 'Người theo dõi']
    ]
  },
  {
    label: 'Cộng đồng',
    types: [
      ['communities', 'Cộng đồng'],
      ['groups', 'Nhóm học'],
      ['conversations', 'Hội thoại']
    ]
  },
  {
    label: 'Kiểm duyệt',
    types: [
      ['reports_received', 'Bị báo cáo'],
      ['reports_filed', 'Đã báo cáo']
    ]
  },
  { label: 'Hành vi', types: [['events', 'Xem & tìm kiếm']] }
]

const EVENT_LABEL: Record<string, string> = {
  post_view: 'Xem bài',
  post_open: 'Mở bài',
  doc_open: 'Mở tài liệu',
  doc_download: 'Tải tài liệu',
  search: 'Tìm kiếm',
  search_click: 'Bấm kết quả tìm',
  ai_suggestion_click: 'Bấm gợi ý N7AI'
}

const NOTE: Partial<Record<AdminActivityType, string>> = {
  conversations: 'Chỉ siêu dữ liệu (ai, bao nhiêu tin) — không đọc nội dung tin nhắn. Lượt xem được ghi nhật ký.',
  events: 'Dữ liệu cá nhân hóa: chỉ có khi người dùng bật. Lượt xem được ghi nhật ký.'
}

/* ── Tab Hoạt động ─────────────────────────────────────── */

export function ActivityTab({ userId, onOpenUser }: { userId: string; onOpenUser: (id: string) => void }) {
  const [type, setType] = useState<AdminActivityType>('posts')
  return (
    <div className="space-y-4">
      <div className="space-y-2">
        {ACTIVITY_GROUPS.map((g) => (
          <div key={g.label} className="flex flex-wrap items-center gap-1.5">
            <span className="w-20 shrink-0 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{g.label}</span>
            {g.types.map(([t, label]) => (
              <button
                key={t}
                type="button"
                onClick={() => setType(t)}
                className={cn(
                  'h-7 rounded-full border px-2.5 text-xs transition-colors cursor-pointer',
                  type === t ? 'border-primary bg-primary text-primary-foreground' : 'border-border text-foreground hover:bg-accent'
                )}
              >
                {label}
              </button>
            ))}
          </div>
        ))}
      </div>
      {NOTE[type] && <p className="text-xs text-muted-foreground">{NOTE[type]}</p>}
      <ActivityList userId={userId} type={type} onOpenUser={onOpenUser} />
    </div>
  )
}

/* ── Tab Lượt xem hồ sơ ────────────────────────────────── */

export function ProfileViewsTab({ userId, onOpenUser }: { userId: string; onOpenUser: (id: string) => void }) {
  const [type, setType] = useState<'profile_viewers' | 'profiles_viewed'>('profile_viewers')
  return (
    <div className="space-y-4">
      <div className="inline-flex rounded-md bg-muted p-0.5">
        {(
          [
            ['profile_viewers', 'Ai đã xem hồ sơ này'],
            ['profiles_viewed', 'Người này đã xem ai']
          ] as const
        ).map(([t, label]) => (
          <button
            key={t}
            type="button"
            onClick={() => setType(t)}
            className={cn(
              'h-8 rounded-[5px] px-3 text-xs font-medium transition-colors cursor-pointer',
              type === t ? 'bg-card text-foreground shadow-xs' : 'text-muted-foreground hover:text-foreground'
            )}
          >
            {label}
          </button>
        ))}
      </div>
      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Eye className="size-3.5" /> Gộp theo giờ, lưu 90 ngày, chỉ quản trị viên thấy. Lượt xem được ghi nhật ký. Ghi từ 17/10/2026.
      </p>
      <ActivityList userId={userId} type={type} onOpenUser={onOpenUser} />
    </div>
  )
}

/* ── Danh sách dùng chung (phân trang) ─────────────────── */

function ActivityList({ userId, type, onOpenUser }: { userId: string; type: AdminActivityType; onOpenUser: (id: string) => void }) {
  const [page, setPage] = useState(1)
  useEffect(() => setPage(1), [type, userId])
  const { data, isPending, isError, error, isPlaceholderData } = useUserActivity(userId, type, page)

  if (isPending) {
    return (
      <div className="space-y-2">
        {Array.from({ length: 5 }, (_, i) => (
          <Skeleton key={i} className="h-12" />
        ))}
      </div>
    )
  }
  if (isError || !data) return <ErrorState message={(error as Error)?.message || 'Không tải được dữ liệu'} />
  if (data.total === 0) return <p className="py-8 text-center text-sm text-muted-foreground">Không có dữ liệu</p>

  const pages = Math.ceil(data.total / data.pageSize)
  return (
    <div className={cn('space-y-2', isPlaceholderData && 'opacity-60')}>
      <p className="text-xs text-muted-foreground">{formatNumber(data.total)} mục</p>
      <ul className="divide-y divide-border rounded-lg border border-border">
        {data.items.map((it) => (
          <ActivityRow key={it.id} it={it} type={type} onOpenUser={onOpenUser} />
        ))}
      </ul>
      {pages > 1 && (
        <div className="flex items-center justify-end gap-1 text-xs text-muted-foreground">
          <span className="mr-2 tabular-nums">
            {page}/{pages}
          </span>
          <Button size="icon-sm" variant="ghost" disabled={page <= 1} onClick={() => setPage(page - 1)} aria-label="Trang trước">
            <ChevronLeft />
          </Button>
          <Button size="icon-sm" variant="ghost" disabled={page >= pages} onClick={() => setPage(page + 1)} aria-label="Trang sau">
            <ChevronRight />
          </Button>
        </div>
      )}
    </div>
  )
}

function ActivityRow({ it, type, onOpenUser }: { it: AdminActivityItem; type: AdminActivityType; onOpenUser: (id: string) => void }) {
  const title = type === 'events' ? (EVENT_LABEL[it.title] ?? it.title) : it.title
  const external = it.href ? (it.href.startsWith('http') ? it.href : `${WEB_PORTAL_URL}${it.href}`) : null
  // Hàng là 1 người (theo dõi, người xem hồ sơ) ⇒ bấm mở hồ sơ admin của người đó
  const isPerson = ['following', 'followers', 'profile_viewers', 'profiles_viewed'].includes(type)

  const body = (
    <>
      {it.user && <Avatar src={it.user.avatarUrl} name={it.user.displayName} className="size-8" />}
      <span className="min-w-0 flex-1">
        <span className="flex items-center gap-1.5">
          <span className="truncate text-sm text-foreground">{title}</span>
          {it.badge && <Badge className="shrink-0">{it.badge}</Badge>}
        </span>
        <span className="block truncate text-xs text-muted-foreground">
          {[it.subtitle, formatRelativeTime(it.at)].filter(Boolean).join(' · ')}
        </span>
      </span>
    </>
  )

  return (
    <li className="flex items-center gap-1">
      {isPerson && it.user ? (
        <button type="button" onClick={() => onOpenUser(it.user!.id)} className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2 text-left hover:bg-accent/60 cursor-pointer">
          {body}
        </button>
      ) : (
        <div className="flex min-w-0 flex-1 items-center gap-3 px-3 py-2">{body}</div>
      )}
      {external && (
        <a
          href={external}
          target="_blank"
          rel="noreferrer"
          title="Mở trên PU Connect"
          className="mr-2 inline-flex size-7 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-accent hover:text-foreground"
        >
          <ExternalLink className="size-3.5" />
        </a>
      )}
    </li>
  )
}

/* ── Phiên đăng nhập đang mở (ép đăng xuất từng phiên) ── */

export function SessionsPanel({ userId, canRevokeAll }: { userId: string; canRevokeAll: boolean }) {
  const { data, isPending } = useUserSessions(userId)
  const revoke = useRevokeUserSession(userId)
  const all = useUserActions()

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">Phiên đang mở {data ? `(${data.length})` : ''}</h3>
        {canRevokeAll && (data?.length ?? 0) > 0 && (
          <Button size="sm" variant="danger-soft" disabled={all.isPending} onClick={() => all.mutate({ ids: [userId], action: 'revoke_sessions' })}>
            <LogOut /> Đăng xuất tất cả
          </Button>
        )}
      </div>
      {isPending ? (
        <Skeleton className="h-14" />
      ) : !data?.length ? (
        <p className="text-sm text-muted-foreground">Không có phiên nào đang mở</p>
      ) : (
        <ul className="divide-y divide-border rounded-lg border border-border">
          {data.map((s) => {
            const Icon = /iPhone|Android|iPad/.test(s.device) ? Smartphone : Laptop
            return (
              <li key={s.id} className="flex items-center gap-3 px-3 py-2">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="min-w-0 flex-1">
                  <span className="block truncate text-sm text-foreground">{s.device}</span>
                  <span className="block truncate text-xs text-muted-foreground">
                    {[s.ip, s.method === 'google' ? 'Google' : s.method === 'password' ? 'Mật khẩu' : null, `đăng nhập ${formatRelativeTime(s.createdAt ?? s.lastActiveAt)}`]
                      .filter(Boolean)
                      .join(' · ')}
                  </span>
                </span>
                {canRevokeAll && (
                  <Button size="sm" variant="ghost" disabled={revoke.isPending} onClick={() => revoke.mutate(s.id)}>
                    Đăng xuất
                  </Button>
                )}
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
