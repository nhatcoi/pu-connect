'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  Search,
  FileText,
  Hash,
  User,
  Settings,
  GraduationCap,
  HelpCircle,
  LogOut,
  MoreHorizontal,
  Compass,
  Bell,
  MessageCircle,
  Sparkles,
  Wrench,
  PenSquare
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { useLogout } from '@/hooks/use-logout'
import { FEATURES } from '@/lib/features'
import { useNotificationsStore } from '@/hooks/use-notifications'
import { useUnreadMessages } from '@/hooks/chat'
import { N7AI_HOME } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'

export type NavTabType =
  | 'feed'
  | 'search'
  | 'communities'
  | 'notifications'
  | 'profile'
  | 'documents'
  | 'courses'
  | 'groups'
  | 'campus'
  | 'bookmarks'
  | 'qa'
  | 'messages'
  | 'n7ai'
  | 'tools'

interface SidebarProps {
  currentTab?: NavTabType
  onTabChange?: (tab: NavTabType) => void
  compact?: boolean
}

export function Sidebar({ currentTab, onTabChange, compact = false }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  const { logout, isLoggingOut } = useLogout()
  const unreadCount = useNotificationsStore((s) => s.unreadCount)
  const unreadMessages = useUnreadMessages()

  const navItems = [
    { id: 'feed' as const, path: '/', label: 'Bảng tin', icon: Home },
    { id: 'search' as const, path: '/search', label: 'Khám phá', icon: Search },
    { id: 'communities' as const, path: '/communities', label: 'Cộng đồng', icon: Compass },
    { id: 'courses' as const, path: '/courses', label: 'Học phần', icon: GraduationCap },
    { id: 'tools' as const, path: '/tools', label: 'Công cụ', icon: Wrench },
    {
      id: 'messages' as const,
      path: '/messages',
      label: 'Tin nhắn',
      icon: MessageCircle,
      badge: unreadMessages > 0 ? (unreadMessages > 99 ? '99+' : String(unreadMessages)) : undefined
    },
    { id: 'n7ai' as const, path: N7AI_HOME, label: 'N7AI', icon: Sparkles },
    {
      id: 'notifications' as const,
      path: '/notifications',
      label: 'Thông báo',
      icon: Bell,
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined
    },
    ...(user?.username ? [{ id: 'profile' as const, path: `/${user.username}`, label: 'Hồ sơ', icon: User }] : []),
    // Lối tắt danh mục: ẩn tới khi /search hỗ trợ lọc theo type không cần từ khóa
    ...(FEATURES.categoryShortcuts
      ? [
          { id: 'documents' as const, path: '/search?type=documents', label: 'Tài liệu & Đề thi', icon: FileText },
          { id: 'qa' as const, path: '/search?type=qa', label: 'Hỏi đáp', icon: HelpCircle }
        ]
      : [])
  ] as { id: NavTabType; path: string; label: string; icon: React.ElementType; badge?: string }[]

  const hotCourses = ['IT101 - Cấu trúc dữ liệu', 'MATH201 - Giải tích 2', 'PHY102 - Vật lý đại cương']

  const userInitials = (user?.displayName || user?.username || 'PU').slice(0, 2).toUpperCase()

  return (
    <aside className="flex flex-col justify-between h-full min-h-[calc(100vh-5rem)] py-2 w-full overflow-hidden select-none">
      <div className="space-y-4">
        {/* 1. Điều hướng chính: các icon luôn cố định tâm ở 32px (left: 8px + slot 48px / 2 = 32px) */}
        <div className="space-y-1 flex flex-col w-full px-2">
          {navItems.map((item) => {
            const Icon = item.icon
            // Trang con (/courses/IT101, /messages/abc) vẫn sáng mục cha
            const isActive = currentTab
              ? currentTab === item.id
              : pathname === item.path || (item.path !== '/' && item.path.length > 1 && pathname.startsWith(`${item.path}/`))

            const buttonClass = cn(
              'group flex items-center h-11 rounded-full transition-colors cursor-pointer select-none overflow-hidden',
              compact ? 'w-12 justify-center' : 'w-12 xl:w-full xl:justify-start',
              isActive
                ? 'bg-primary/10 text-primary font-semibold'
                : 'text-muted-foreground hover:text-foreground hover:bg-muted/70'
            )

            const itemContent = (
              <>
                {/* Khung icon cố định 48x44px — tâm đúng 32px tính từ lề thanh bên */}
                <div className="w-12 h-11 flex items-center justify-center shrink-0 relative">
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-transform group-hover:scale-110',
                      isActive ? 'text-primary stroke-[2.25]' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  {item.badge && (
                    <span
                      className={cn(
                        'absolute top-1.5 right-2 flex h-4 min-w-4 items-center justify-center rounded-full bg-brand-orange px-1 text-[9px] font-bold text-white shadow-xs',
                        !compact && 'xl:hidden'
                      )}
                    >
                      {item.badge}
                    </span>
                  )}
                </div>

                {/* Nhãn chữ: tự động ẩn khi compact hoặc dưới xl */}
                {!compact && (
                  <div className="hidden xl:flex items-center justify-between min-w-0 flex-1 pr-3.5">
                    <span className="truncate text-[13px] font-medium">{item.label}</span>
                    {item.badge && (
                      <span className="rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 bg-brand-orange/15 text-brand-orange">
                        {item.badge}
                      </span>
                    )}
                  </div>
                )}
              </>
            )

            return onTabChange ? (
              <button key={item.id} type="button" onClick={() => onTabChange(item.id)} className={buttonClass} title={item.label}>
                {itemContent}
              </button>
            ) : (
              <Link key={item.id} href={item.path} prefetch className={buttonClass} title={item.label}>
                {itemContent}
              </Link>
            )
          })}

          {/* Nút Đăng bài chuẩn X: icon PenSquare nằm chính xác ở tâm 32px */}
          <div className="pt-2 w-full">
            <Button
              type="button"
              onClick={() => setCreatePostOpen(true)}
              className={cn(
                'h-11 rounded-full bg-primary hover:bg-primary/90 text-primary-foreground font-bold shadow-xs flex items-center cursor-pointer transition-all hover:scale-[1.02] active:scale-[0.98] overflow-hidden p-0',
                compact ? 'w-12 justify-center' : 'w-12 xl:w-full xl:justify-start'
              )}
              title="Đăng bài mới"
            >
              <div className="w-12 h-11 flex items-center justify-center shrink-0">
                <PenSquare className="h-5 w-5" />
              </div>
              {!compact && (
                <span className="hidden xl:inline text-xs font-bold tracking-tight pr-4">
                  Đăng bài
                </span>
              )}
            </Button>
          </div>
        </div>

        {/* 2. Môn học sôi nổi (Desktop xl: only, ẩn hoàn toàn khi compact) */}
        {FEATURES.hotCourses && !compact && (
          <div className="hidden xl:block space-y-1 px-3 pt-2">
            <p className="px-2 pb-1 text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">Môn học sôi nổi</p>
            <div className="space-y-0.5">
              {hotCourses.map((course) => (
                <div
                  key={course}
                  onClick={() => router.push(`/courses/${course.split(' ')[0]}`)}
                  className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
                >
                  <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                  <span className="truncate">{course}</span>
                </div>
              ))}
              <Link href="/search?type=courses" className="block px-3 py-1.5 text-xs font-medium text-primary hover:underline">
                Xem tất cả ›
              </Link>
            </div>
          </div>
        )}
      </div>

      {/* 3. Bottom User Profile Card & Logout: Avatar nằm chính xác ở tâm 32px */}
      <div className="pt-4 px-2 w-full">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className={cn(
                  'flex items-center h-11 transition-colors cursor-pointer group rounded-full overflow-hidden p-0 hover:bg-muted/70',
                  compact ? 'w-12 justify-center' : 'w-12 xl:w-full xl:justify-between'
                )}
                title={compact ? `${user.displayName || user.username} (@${user.username})` : undefined}
              >
                <div className="flex items-center min-w-0">
                  <div className="w-12 h-11 flex items-center justify-center shrink-0">
                    <Avatar className="h-8 w-8 shrink-0 transition-transform group-hover:scale-105">
                      <AvatarImage src={user.avatarUrl || ''} />
                      <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">{userInitials}</AvatarFallback>
                    </Avatar>
                  </div>
                  {!compact && (
                    <div className="hidden xl:flex flex-col text-left min-w-0 pr-2">
                      <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                        {user.displayName || user.username}
                      </span>
                      <span className="text-[11px] text-muted-foreground truncate">@{user.username}</span>
                    </div>
                  )}
                </div>
                {!compact && <MoreHorizontal className="hidden xl:block h-4 w-4 text-muted-foreground shrink-0 mr-3" />}
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align={compact ? 'center' : 'end'} className="w-56 p-1.5 rounded-2xl shadow-xl border border-border bg-popover">
              <DropdownMenuItem
                onClick={() => router.push(`/${user.username}`)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer rounded-xl"
              >
                <User className="h-4 w-4 text-primary" />
                <span>Trang cá nhân @{user.username}</span>
              </DropdownMenuItem>
              <DropdownMenuItem
                onClick={() => router.push('/settings')}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer rounded-xl"
              >
                <Settings className="h-4 w-4 text-muted-foreground" />
                <span>Cài đặt</span>
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={logout}
                disabled={isLoggingOut}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer rounded-xl text-destructive hover:bg-destructive/10"
              >
                <LogOut className="h-4 w-4" />
                <span>{isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}</span>
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <div className={cn(compact ? 'w-12 flex justify-center' : 'w-12 xl:w-full')}>
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/')}
              className={cn('rounded-full text-xs font-semibold h-11 p-0 flex items-center', compact ? 'w-12 justify-center' : 'w-12 xl:w-full xl:justify-start')}
            >
              <div className="w-12 h-11 flex items-center justify-center shrink-0">
                <User className="h-4 w-4" />
              </div>
              {!compact && <span className="hidden xl:inline pr-3">Đăng nhập</span>}
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
