'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Home,
  Search,
  FileText,
  Bookmark,
  Hash,
  Users,
  User,
  GraduationCap,
  Building2,
  HelpCircle,
  LogOut,
  Plus,
  MoreHorizontal,
  Sparkles,
  Compass,
  Bell
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Highlight, HighlightItem } from '@/components/animate-ui/primitives/effects/highlight'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger
} from '@/components/ui/dropdown-menu'
import { useAppStore } from '@/store'
import { useLogout } from '@/hooks/use-logout'
import { FEATURES } from '@/lib/features'
import { useNotificationsStore } from '@/hooks/use-notifications'
import { cn } from '@/lib/utils'

export type NavTabType = 'feed' | 'search' | 'communities' | 'notifications' | 'profile' | 'documents' | 'courses' | 'groups' | 'campus' | 'bookmarks' | 'qa'

interface SidebarProps {
  currentTab?: NavTabType
  onTabChange?: (tab: NavTabType) => void
}

export function Sidebar({ currentTab, onTabChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const { logout, isLoggingOut } = useLogout()
  const unreadCount = useNotificationsStore((s) => s.unreadCount)

  const navItems = [
    { id: 'feed' as const, path: '/home', label: 'Bảng tin', icon: Home },
    { id: 'search' as const, path: '/search', label: 'Khám phá', icon: Search },
    { id: 'communities' as const, path: '/communities', label: 'Cộng đồng', icon: Compass },
    {
      id: 'notifications' as const,
      path: '/notifications',
      label: 'Thông báo',
      icon: Bell,
      badge: unreadCount > 0 ? (unreadCount > 99 ? '99+' : String(unreadCount)) : undefined
    },
    ...(user?.username
      ? [{ id: 'profile' as const, path: `/${user.username}`, label: 'Hồ sơ', icon: User }]
      : []),
    // Lối tắt danh mục: ẩn tới khi /search hỗ trợ lọc theo type không cần từ khóa
    ...(FEATURES.categoryShortcuts
      ? [
          { id: 'courses' as const, path: '/search?type=courses', label: 'Học phần', icon: GraduationCap },
          { id: 'documents' as const, path: '/search?type=documents', label: 'Tài liệu & Đề thi', icon: FileText },
          { id: 'qa' as const, path: '/search?type=qa', label: 'Hỏi đáp', icon: HelpCircle }
        ]
      : [])
  ] as { id: NavTabType; path: string; label: string; icon: React.ElementType; badge?: string }[]

  const hotCourses = [
    'IT101 - Cấu trúc dữ liệu',
    'MATH201 - Giải tích 2',
    'PHY102 - Vật lý đại cương'
  ]

  const userInitials = (user?.displayName || (user as any)?.display_name || user?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="flex flex-col justify-between h-full min-h-[calc(100vh-5rem)] py-2 w-full">
      <div className="space-y-6">
        {/* 1. Điều hướng chính (icon-only on md, full on xl) */}
        <div className="space-y-0.5 flex flex-col items-center xl:items-stretch">

          {/* Highlight trượt theo chuột (animate-ui, giống menu dropdown) */}
          <Highlight
            hover
            controlledItems
            className="inset-0 rounded-full xl:rounded-xl bg-muted/80"
            transition={{ type: 'spring', stiffness: 500, damping: 38 }}
          >
          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentTab ? currentTab === item.id : pathname === item.path

            return (
              <HighlightItem key={item.id} value={item.id} disabled={isActive} className="xl:w-full">
              <button
                type="button"
                onClick={() => {
                  if (onTabChange) {
                    onTabChange(item.id)
                  } else {
                    router.push(item.path)
                  }
                }}
                className={cn(
                  'group flex items-center rounded-full xl:rounded-xl transition-colors cursor-pointer select-none',
                  'w-10 h-10 xl:w-full xl:h-9 justify-center xl:justify-between px-0 xl:px-3 text-[13px] font-medium',
                  isActive
                    ? 'bg-primary/10 text-primary font-semibold'
                    : 'text-muted-foreground hover:text-foreground'
                )}
                title={item.label}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'h-[18px] w-[18px] shrink-0',
                      isActive ? 'text-primary stroke-[2.25]' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span className="hidden xl:inline truncate">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={cn(
                      'hidden xl:inline-flex rounded-full px-1.5 py-0.5 text-[10px] font-semibold shrink-0 bg-brand-orange/15 text-brand-orange'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
              </HighlightItem>
            )
          })}
          </Highlight>

        </div>

        {/* 2. Môn học sôi nổi (Desktop xl: only) — ẩn: dữ liệu cứng */}
        {FEATURES.hotCourses && (
        <div className="hidden xl:block space-y-1">
          <p className="px-3 pb-1 text-[11px] font-medium text-muted-foreground/80 uppercase tracking-wider">
            Môn học sôi nổi
          </p>
          <div className="space-y-0.5">
            {hotCourses.map((course) => (
              <div
                key={course}
                onClick={() => router.push(`/home?tab=courses&course=${course.split(' ')[0]}`)}
                className="flex items-center gap-2 px-3 py-1.5 rounded-lg hover:bg-muted/60 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Hash className="h-3.5 w-3.5 shrink-0 opacity-60" />
                <span className="truncate">{course}</span>
              </div>
            ))}
            <Link
              href="/search?type=courses"
              className="block px-3 py-1.5 text-xs font-medium text-primary hover:underline"
            >
              Xem tất cả ›
            </Link>
          </div>
        </div>
        )}
      </div>

      {/* 3. Bottom User Profile Card & Logout (Like X User Capsule) */}
      <div className="pt-4">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-center xl:justify-between p-1.5 xl:p-2 rounded-full xl:rounded-2xl hover:bg-muted/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-8 w-8 shrink-0">
                    <AvatarImage src={user.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="hidden xl:flex flex-col text-left min-w-0">
                    <span className="text-xs font-bold text-foreground truncate group-hover:text-primary transition-colors">
                      {user.displayName || (user as any).display_name || user.username}
                    </span>
                    <span className="text-[11px] text-muted-foreground truncate">
                      @{user.username}
                    </span>
                  </div>
                </div>
                <MoreHorizontal className="hidden xl:block h-4 w-4 text-muted-foreground shrink-0" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="w-56 p-1.5 rounded-2xl shadow-xl border border-border bg-popover">
              <DropdownMenuItem
                onClick={() => router.push(`/${user.username}`)}
                className="flex items-center gap-2 px-3 py-2 text-xs font-semibold cursor-pointer rounded-xl"
              >
                <User className="h-4 w-4 text-primary" />
                <span>Trang cá nhân @{user.username}</span>
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
          <div className="flex justify-center xl:block">
            <Button
              size="sm"
              variant="outline"
              onClick={() => router.push('/')}
              className="w-10 h-10 xl:w-full xl:h-9 rounded-full text-xs font-semibold"
            >
              <User className="h-4 w-4 xl:mr-1.5" />
              <span className="hidden xl:inline">Đăng nhập</span>
            </Button>
          </div>
        )}
      </div>
    </aside>
  )
}
