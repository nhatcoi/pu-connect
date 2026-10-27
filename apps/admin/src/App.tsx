import React, { useEffect, useState } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import {
  BookOpen,
  Bot,
  Cpu,
  ExternalLink,
  Flag,
  History,
  LayoutDashboard,
  Loader2,
  LogOut,
  Megaphone,
  Menu as MenuIcon,
  PanelLeftClose,
  PanelLeftOpen,
  Monitor,
  Moon,
  RefreshCw,
  Search,
  Sun,
  Users,
  X,
  ShieldCheck
} from 'lucide-react'
import { toast } from 'sonner'
import type { AdminPermission, AdminSessionInfo, AdminStats, UserProfile } from '@pu/schemas'
import { adminApi, cn, ROLE_SHORT, WEB_PORTAL_URL } from '@/lib/api'
import { useTheme, type ThemeMode } from '@/hooks/use-theme'
import { Avatar, Button, Menu, MenuItem, MenuLabel, MenuSeparator } from '@/components/ui'
import { LoginScreen } from '@/components/login-screen'
import { DashboardTab } from '@/tabs/dashboard-tab'
import { ModerationTab } from '@/tabs/moderation-tab'
import { UsersPage } from '@/features/users/users-page'
import { AiOpsTab } from '@/tabs/ai-ops-tab'
import { AcademicTab } from '@/tabs/academic-tab'
import { BotsPage } from '@/features/bots/bots-page'
import { AnnouncementsPage } from '@/features/announcements/announcements-page'
import { GroupsPage } from '@/features/groups/groups-page'
import { AuditLogsTab, SearchAnalyticsTab } from '@/tabs/system-ops-tab'

export type NavId = 'dashboard' | 'moderation' | 'users' | 'academic' | 'ai' | 'search' | 'broadcast' | 'bots' | 'audit' | 'roles'

interface NavItem {
  id: NavId
  label: string
  icon: React.ElementType
  perm: AdminPermission
  badge?: number
}

const NAV_IDS: NavId[] = ['dashboard', 'moderation', 'users', 'academic', 'ai', 'search', 'broadcast', 'bots', 'audit', 'roles']

// Điều hướng theo hash (#/users) — giữ trang khi F5
function readHash(): NavId {
  const h = window.location.hash.replace(/^#\/?/, '').split('?')[0] as NavId
  return NAV_IDS.includes(h) ? h : 'dashboard'
}

export function App() {
  const [active, setActive] = useState<NavId>(readHash)
  const [drawer, setDrawer] = useState(false)
  // Sidebar thu gọn (chỉ icon) — nhớ theo trình duyệt
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem('puc-admin-sidebar') === 'collapsed'
    } catch {
      return false
    }
  })
  const toggleCollapsed = () =>
    setCollapsed((v) => {
      try {
        localStorage.setItem('puc-admin-sidebar', v ? 'expanded' : 'collapsed')
      } catch {
        // ignore
      }
      return !v
    })
  const qc = useQueryClient()
  const theme = useTheme()

  useEffect(() => {
    const onHash = () => setActive(readHash())
    window.addEventListener('hashchange', onHash)
    return () => window.removeEventListener('hashchange', onHash)
  }, [])

  const navigate = (id: NavId) => {
    window.location.hash = `/${id}`
    setActive(id)
    setDrawer(false)
    window.scrollTo({ top: 0 })
  }

  // Phiên đăng nhập → quyền RBAC → số liệu tổng quan
  const authMe = useQuery({
    queryKey: ['auth', 'me'],
    queryFn: () => adminApi.get<UserProfile>('/auth/me'),
    retry: false
  })
  const adminMe = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: () => adminApi.get<AdminSessionInfo>('/admin/me'),
    enabled: !!authMe.data,
    retry: false
  })
  const stats = useQuery({
    queryKey: ['admin', 'stats'],
    queryFn: () => adminApi.get<AdminStats>('/admin/stats'),
    enabled: !!adminMe.data
  })

  const handleLogout = async () => {
    try {
      await adminApi.post('/auth/logout')
    } catch {
      // ignore
    }
    qc.clear()
    void authMe.refetch()
    toast.success('Đã đăng xuất')
  }

  if (authMe.isPending || (!!authMe.data && adminMe.isPending)) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-surface">
        <Loader2 className="size-5 animate-spin text-primary" />
      </div>
    )
  }
  if (authMe.isError || !authMe.data) {
    return <LoginScreen onSuccess={() => void authMe.refetch()} />
  }
  if (!adminMe.data) {
    return <LoginScreen forbiddenRole={authMe.data.role} onSuccess={() => void authMe.refetch()} onLogout={handleLogout} />
  }

  const session = adminMe.data
  const perms = session.permissions
  const can = (p: AdminPermission) => perms.includes(p)

  const navGroups: { label?: string; items: NavItem[] }[] = [
    {
      items: [
        { id: 'dashboard', label: 'Tổng quan', icon: LayoutDashboard, perm: 'dashboard:view' },
        { id: 'moderation', label: 'Kiểm duyệt', icon: Flag, perm: 'moderation:read', badge: stats.data?.pendingReports },
        { id: 'users', label: 'Người dùng', icon: Users, perm: 'users:read' }
      ]
    },
    {
      label: 'Nội dung',
      items: [
        { id: 'academic', label: 'Học thuật', icon: BookOpen, perm: 'academic:read' },
        { id: 'ai', label: 'N7AI', icon: Bot, perm: 'ai:read', badge: stats.data?.openSupportTickets }
      ]
    },
    {
      label: 'Hệ thống',
      items: [
        { id: 'search', label: 'Tìm kiếm', icon: Search, perm: 'search:read' },
        { id: 'broadcast', label: 'Thông báo', icon: Megaphone, perm: 'system:broadcast' },
        { id: 'bots', label: 'Bot', icon: Cpu, perm: 'bots:manage' },
        { id: 'roles', label: 'Nhóm quyền', icon: ShieldCheck, perm: 'roles:manage' },
        { id: 'audit', label: 'Nhật ký', icon: History, perm: 'audit:read' }
      ]
    }
  ]
  const groups = navGroups.map((g) => ({ ...g, items: g.items.filter((i) => can(i.perm)) })).filter((g) => g.items.length > 0)

  const allowed = groups.flatMap((g) => g.items.map((i) => i.id))
  const current = allowed.includes(active) ? active : allowed[0]

  // mini = sidebar thu gọn (chỉ icon + tooltip)
  const renderNav = (mini: boolean) => (
    <nav className={cn('flex flex-col gap-5', mini ? 'p-2' : 'p-3')}>
      {groups.map((g, gi) => (
        <div key={gi} className="space-y-0.5">
          {g.label &&
            (mini ? (
              gi > 0 && <div className="mx-2 mb-2 h-px bg-border" />
            ) : (
              <p className="px-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground/70">{g.label}</p>
            ))}
          {g.items.map((item) => {
            const Icon = item.icon
            const on = current === item.id
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => navigate(item.id)}
                title={mini ? item.label : undefined}
                className={cn(
                  'relative flex h-9 w-full items-center gap-3 rounded-md text-sm transition-colors cursor-pointer',
                  mini ? 'justify-center px-0' : 'px-3',
                  on ? 'bg-primary/10 font-semibold text-primary' : 'text-muted-foreground hover:bg-accent hover:text-foreground'
                )}
              >
                <Icon className="size-[18px] shrink-0" />
                {!mini && <span className="flex-1 text-left">{item.label}</span>}
                {item.badge && mini ? (
                  <span className="absolute right-1.5 top-1.5 size-2 rounded-full bg-brand-orange" />
                ) : item.badge ? (
                  <span className="min-w-5 rounded-full bg-brand-orange px-1.5 text-center text-[11px] font-semibold leading-5 text-white tabular-nums">
                    {item.badge > 99 ? '99+' : item.badge}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      ))}
    </nav>
  )

  const themeIcon = theme.mode === 'system' ? Monitor : theme.dark ? Moon : Sun

  return (
    <div className="min-h-screen bg-surface">
      {/* Thanh trên cùng */}
      <header className="sticky top-0 z-40 flex h-14 items-center gap-2 border-b border-border bg-background/90 px-3 backdrop-blur-md sm:px-4">
        <Button variant="ghost" size="icon" className="md:hidden" onClick={() => setDrawer(true)} aria-label="Menu">
          <MenuIcon />
        </Button>
        <Button variant="ghost" size="icon" className="hidden md:inline-flex" onClick={toggleCollapsed} aria-label="Thu gọn menu" title="Thu gọn menu">
          {collapsed ? <PanelLeftOpen /> : <PanelLeftClose />}
        </Button>
        <a href="#/dashboard" onClick={() => navigate('dashboard')} className="flex items-center gap-2.5">
          <img src="/brand/pu-mark.svg" alt="" className="size-8" />
          <span className="text-base font-extrabold tracking-tight text-foreground">
            PU Connector <span className="font-semibold text-muted-foreground">Admin</span>
          </span>
        </a>

        <div className="ml-auto flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            title="Làm mới dữ liệu"
            onClick={() => void qc.invalidateQueries({ queryKey: ['admin'] })}
          >
            <RefreshCw className={cn(stats.isFetching && 'animate-spin')} />
          </Button>
          <Menu
            width={180}
            trigger={(p) => (
              <Button variant="ghost" size="icon" title="Giao diện" {...p}>
                {React.createElement(themeIcon)}
              </Button>
            )}
          >
            {(
              [
                ['light', 'Sáng', Sun],
                ['dark', 'Tối', Moon],
                ['system', 'Theo hệ thống', Monitor]
              ] as [ThemeMode, string, React.ElementType][]
            ).map(([m, label, Icon]) => (
              <MenuItem key={m} icon={Icon} checked={theme.mode === m} onSelect={() => theme.setMode(m)}>
                {label}
              </MenuItem>
            ))}
          </Menu>
          <Menu
            width={240}
            trigger={(p) => (
              <button type="button" {...p} className="ml-1 rounded-full outline-none focus-visible:ring-2 focus-visible:ring-ring/50 cursor-pointer">
                <Avatar src={session.user.avatarUrl} name={session.user.displayName} className="size-8" />
              </button>
            )}
          >
            <div className="px-2.5 py-2">
              <p className="truncate text-sm font-semibold text-foreground">{session.user.displayName}</p>
              <p className="truncate text-xs text-muted-foreground">
                @{session.user.username} · {ROLE_SHORT[session.user.role] ?? session.user.role}
              </p>
            </div>
            <MenuSeparator />
            <MenuLabel>{perms.length} quyền được cấp</MenuLabel>
            <MenuItem icon={ExternalLink} onSelect={() => window.open(WEB_PORTAL_URL, '_blank', 'noopener')}>
              Mở PU Connector
            </MenuItem>
            <MenuItem icon={LogOut} danger onSelect={handleLogout}>
              Đăng xuất
            </MenuItem>
          </Menu>
        </div>
      </header>

      <div className="flex">
        {/* Sidebar desktop */}
        <aside
          className={cn(
            'sticky top-14 hidden h-[calc(100vh-3.5rem)] shrink-0 overflow-y-auto border-r border-border bg-background transition-[width] duration-200 md:block',
            collapsed ? 'w-16' : 'w-60'
          )}
        >
          {renderNav(collapsed)}
        </aside>

        {/* Sidebar mobile (drawer) */}
        {drawer && (
          <div className="fixed inset-0 z-50 md:hidden" onClick={() => setDrawer(false)}>
            <div className="absolute inset-0 bg-black/40" />
            <aside className="absolute inset-y-0 left-0 w-72 bg-background shadow-xl" onClick={(e) => e.stopPropagation()}>
              <div className="flex h-14 items-center justify-between border-b border-border px-4">
                <span className="flex items-center gap-2.5 text-base font-extrabold">
                  <img src="/brand/pu-mark.svg" alt="" className="size-8" /> Admin
                </span>
                <Button variant="ghost" size="icon" onClick={() => setDrawer(false)} aria-label="Đóng">
                  <X />
                </Button>
              </div>
              {renderNav(false)}
            </aside>
          </div>
        )}

        <main className="min-w-0 flex-1">
          <div className="mx-auto w-full max-w-[1600px] px-4 py-6 sm:px-6 lg:px-8 lg:py-7">
            {current === 'dashboard' && (
              <DashboardTab stats={stats.data} isLoading={stats.isPending} permissions={perms} userName={session.user.displayName} onNavigate={navigate} />
            )}
            {current === 'moderation' && <ModerationTab permissions={perms} pendingCount={stats.data?.pendingReports} />}
            {current === 'users' && <UsersPage currentUserId={session.user.id} />}
            {current === 'academic' && <AcademicTab permissions={perms} />}
            {current === 'ai' && <AiOpsTab permissions={perms} openTickets={stats.data?.openSupportTickets} />}
            {current === 'search' && <SearchAnalyticsTab />}
            {current === 'broadcast' && <AnnouncementsPage />}
            {current === 'roles' && <GroupsPage />}
            {current === 'bots' && <BotsPage />}
            {current === 'audit' && <AuditLogsTab />}
          </div>
        </main>
      </div>
    </div>
  )
}
