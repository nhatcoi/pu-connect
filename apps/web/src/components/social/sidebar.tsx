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
  Compass
} from 'lucide-react'
import { Button } from '@/components/ui/button'
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
import { cn } from '@/lib/utils'

export type NavTabType = 'feed' | 'search' | 'communities' | 'profile' | 'documents' | 'courses' | 'groups' | 'campus' | 'bookmarks' | 'qa'

interface SidebarProps {
  currentTab?: NavTabType
  onTabChange?: (tab: NavTabType) => void
}

export function Sidebar({ currentTab, onTabChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  const { logout, isLoggingOut } = useLogout()

  const navItems = [
    { id: 'feed' as const, path: '/home', label: 'Bảng tin học thuật', icon: Home },
    { id: 'search' as const, path: '/search', label: 'Tìm kiếm & Khám phá', icon: Search, badge: 'Hot' },
    { id: 'communities' as const, path: '/communities', label: 'Cộng đồng & Diễn đàn', icon: Compass, badge: 'Mới' },
    ...(user?.username
      ? [{ id: 'profile' as const, path: `/${user.username}`, label: 'Hồ sơ cá nhân', icon: User }]
      : []),
    { id: 'courses' as const, path: '/search?type=courses', label: 'Học phần & Môn học', icon: GraduationCap },
    { id: 'documents' as const, path: '/search?type=documents', label: 'Kho tài liệu & Đề thi', icon: FileText },
    { id: 'qa' as const, path: '/search?type=qa', label: 'Hỏi đáp & Thảo luận', icon: HelpCircle }
  ]

  const facultyTags = [
    { name: 'CNTT', code: 'FIT' },
    { name: 'Khoa học Máy tính', code: 'FCS' },
    { name: 'Điện - Điện tử', code: 'FEE' },
    { name: 'Kinh tế & QTKD', code: 'FBA' },
    { name: 'Kỹ thuật Ô tô', code: 'FAE' },
    { name: 'Ngôn ngữ Anh', code: 'FEL' },
    { name: 'Y Dược', code: 'FMS' },
    { name: 'Vật liệu', code: 'FAS' }
  ]

  const hotCourses = [
    'IT101 - Cấu trúc dữ liệu',
    'MATH201 - Giải tích 2',
    'PHY102 - Vật lý đại cương',
    'AI302 - Học máy cơ bản'
  ]

  const userInitials = (user?.displayName || (user as any)?.display_name || user?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  return (
    <aside className="flex flex-col justify-between h-full min-h-[calc(100vh-5rem)] py-2 w-full">
      <div className="space-y-4">
        {/* 1. Main Navigation Links (Responsive icon-only on md, full width on xl) */}
        <div className="space-y-1.5 flex flex-col items-center xl:items-stretch">
          <p className="hidden xl:block px-3 pb-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Phân hệ chính
          </p>

          {navItems.map((item) => {
            const Icon = item.icon
            const isActive = currentTab ? currentTab === item.id : pathname === item.path

            return (
              <button
                key={item.id}
                type="button"
                onClick={() => {
                  if (onTabChange) {
                    onTabChange(item.id)
                  } else {
                    router.push(item.path)
                  }
                }}
                className={cn(
                  'group flex items-center rounded-full xl:rounded-xl transition-all cursor-pointer select-none',
                  // Narrow / Tablet: icon button (w-12 h-12 rounded-full)
                  'w-11 h-11 xl:w-full xl:h-10 justify-center xl:justify-between px-0 xl:px-3 text-xs font-semibold',
                  isActive
                    ? 'bg-primary/10 text-primary font-bold'
                    : 'text-foreground hover:bg-muted/70'
                )}
                title={item.label}
              >
                <div className="flex items-center gap-3">
                  <Icon
                    className={cn(
                      'h-5 w-5 shrink-0 transition-transform group-hover:scale-110',
                      isActive ? 'text-primary stroke-[2.5]' : 'text-muted-foreground group-hover:text-foreground'
                    )}
                  />
                  <span className="hidden xl:inline truncate text-sm">{item.label}</span>
                </div>

                {item.badge && (
                  <span
                    className={cn(
                      'hidden xl:inline-flex rounded-full px-2 py-0.5 text-[10px] font-bold shrink-0',
                      item.badge === 'Mới'
                        ? 'bg-accent/15 text-accent'
                        : 'bg-primary/15 text-primary'
                    )}
                  >
                    {item.badge}
                  </span>
                )}
              </button>
            )
          })}

          {/* Quick Compose Post Button in Sidebar (Like X Tweet Button) */}
          <div className="pt-2 w-full flex justify-center xl:block">
            {/* Tablet Icon Button */}
            <button
              type="button"
              onClick={() => setCreatePostOpen(true)}
              className="xl:hidden flex h-11 w-11 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-md hover:bg-primary/90 transition-all active:scale-95 cursor-pointer"
              title="Đăng bài viết mới"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </button>

            {/* Desktop Full Button */}
            <Button
              onClick={() => setCreatePostOpen(true)}
              className="hidden xl:flex w-full h-10 rounded-full font-bold text-xs gap-2 bg-primary text-primary-foreground hover:bg-primary/90 shadow-md transition-all active:scale-98 cursor-pointer"
            >
              <Plus className="h-4 w-4 stroke-[2.5]" />
              <span>Đăng bài / Chia sẻ</span>
            </Button>
          </div>
        </div>

        {/* 2. Faculty & Departments (Desktop xl: only) */}
        <div className="hidden xl:block space-y-2 border-t border-border pt-4">
          <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Khoa và Viện đào tạo
          </p>
          <div className="flex flex-wrap gap-1.5 px-2">
            {facultyTags.map((fac) => (
              <button
                key={fac.code}
                onClick={() => router.push(`/search?faculty=${fac.code}`)}
                className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary cursor-pointer"
              >
                <span className="font-semibold text-foreground">{fac.code}</span>
                <span className="text-[10px] opacity-70">({fac.name})</span>
              </button>
            ))}
          </div>
        </div>

        {/* 3. Hot Trending Courses (Desktop xl: only) */}
        <div className="hidden xl:block space-y-2 border-t border-border pt-4">
          <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
            Môn học sôi nổi
          </p>
          <div className="space-y-0.5 px-1">
            {hotCourses.map((course) => (
              <div
                key={course}
                onClick={() => router.push(`/home?tab=courses&course=${course.split(' ')[0]}`)}
                className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
              >
                <Hash className="h-3.5 w-3.5 text-accent shrink-0" />
                <span className="truncate">{course}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* 4. Bottom User Profile Card & Logout (Like X User Capsule) */}
      <div className="pt-4 border-t border-border/60">
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="w-full flex items-center justify-center xl:justify-between p-1.5 xl:p-2 rounded-full xl:rounded-2xl hover:bg-muted/70 transition-colors cursor-pointer group"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <Avatar className="h-9 w-9 border border-border shrink-0">
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
