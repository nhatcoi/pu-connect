'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import {
  Search,
  Plus,
  Moon,
  Sun,
  Laptop,
  GraduationCap,
  Users,
  User,
  Sparkles,
  LogIn,
  LogOut
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLogout } from '@/hooks/use-logout'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
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
import { CommandPalette } from '@/components/navigation/command-palette'
import { AuthDialog } from '@/components/auth/auth-dialog'
import { AcademicSearchBar } from '@/components/search/academic-search-bar'
import { NotificationsPopover } from './notifications-popover'
import { apiClient } from '@/lib/api-client'
import type { UserProfile } from '@pu/schemas'
import { cn } from '@/lib/utils'

export function Header() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const { logout, isLoggingOut } = useLogout()
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  const { isHeaderVisible } = useScrollDirection(8)

  const [isCommandOpen, setIsCommandOpen] = useState(false)
  const [isAuthOpen, setIsAuthOpen] = useState(false)

  // Fetch current session profile on mount
  useEffect(() => {
    async function checkSession() {
      try {
        const res = await apiClient<{ success: boolean; data: UserProfile }>('/auth/me')
        if (res && res.data) {
          setUser(res.data)
        }
      } catch {
        setUser(null)
      }
    }
    checkSession()
  }, [setUser])

  const userInitials = (user?.displayName || (user as any)?.display_name || user?.username || 'PU')
    .slice(0, 2)
    .toUpperCase()

  return (
    <header
      className={cn(
        'sticky top-0 z-40 w-full border-b border-border/80 bg-background/95 backdrop-blur-md transition-transform duration-300 ease-in-out',
        !isHeaderVisible && '-translate-y-full md:translate-y-0'
      )}
    >
      <CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} onSelectTab={() => {}} />
      <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />

      {/* ── 1. Desktop & Tablet Header (md:flex) ── */}
      <div className="hidden md:flex mx-auto h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/home" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-base shadow-sm group-hover:scale-105 transition-transform">
              PU
            </div>
            <div className="flex flex-col">
              <span className="font-extrabold text-base tracking-tight leading-none text-foreground">
                PU Connector
              </span>
              <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase">
                Phenikaa University
              </span>
            </div>
          </Link>

          {/* Academic Smart Search Bar */}
          <div className="w-72 lg:w-96">
            <AcademicSearchBar />
          </div>
        </div>

        <div className="flex items-center gap-2">
          <Button
            size="sm"
            onClick={() => {
              if (!user) {
                setIsAuthOpen(true)
                return
              }
              setCreatePostOpen(true)
            }}
            className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm rounded-full cursor-pointer"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden lg:inline">Đăng bài / Chia sẻ</span>
          </Button>

          {/* Notifications Popover */}
          <NotificationsPopover />

          {/* Dark / Light Mode Switcher */}
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground rounded-full cursor-pointer">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" /> Sáng
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" /> Tối
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Laptop className="mr-2 h-4 w-4" /> Hệ thống
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>

          {/* Dynamic User Profile or Login Button */}
          {user ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 border border-border cursor-pointer">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64 p-1.5 rounded-2xl shadow-xl border border-border">
                <div className="flex items-center justify-start gap-2.5 p-2">
                  <Avatar className="h-9 w-9 border border-border">
                    <AvatarImage src={user.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {userInitials}
                    </AvatarFallback>
                  </Avatar>
                  <div className="flex flex-col space-y-0.5 leading-tight min-w-0">
                    <p className="font-bold text-xs text-foreground truncate">
                      {user.displayName || (user as any).display_name || user.username}
                    </p>
                    <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push(`/${user.username}`)}
                  className="cursor-pointer font-medium text-xs rounded-xl"
                >
                  <User className="mr-2 h-4 w-4 text-primary" /> Trang cá nhân của tôi
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs rounded-xl">
                  <GraduationCap className="mr-2 h-4 w-4 text-muted-foreground" /> Mã SV: {user.studentId || (user as any).student_id || 'N/A'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/home?tab=groups')} className="text-xs rounded-xl cursor-pointer">
                  <Users className="mr-2 h-4 w-4 text-muted-foreground" /> Nhóm đồ án của tôi
                </DropdownMenuItem>
                <DropdownMenuItem className="text-xs rounded-xl">
                  <Sparkles className="mr-2 h-4 w-4 text-accent" /> Điểm danh vọng: {user.reputationPoints ?? (user as any).reputation_points ?? 100} pts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={logout} disabled={isLoggingOut} className="text-destructive cursor-pointer text-xs rounded-xl hover:bg-destructive/10">
                  <LogOut className="mr-2 h-4 w-4" /> {isLoggingOut ? 'Đang đăng xuất...' : 'Đăng xuất'}
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAuthOpen(true)}
              className="gap-1.5 text-xs rounded-full border-primary/40 text-primary hover:bg-primary/5 cursor-pointer"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập</span>
            </Button>
          )}
        </div>
      </div>

      {/* ── 2. Mobile Responsive Top Header (X Twitter Style) (md:hidden) ── */}
      <div className="flex md:hidden h-13 items-center justify-between px-3">
        {/* Left: User Avatar (Tap to open quick menu / profile) */}
        {user ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                type="button"
                className="relative h-8 w-8 rounded-full p-0 border border-border cursor-pointer select-none overflow-hidden"
              >
                <Avatar className="h-8 w-8">
                  <AvatarImage src={user.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="start" className="w-64 p-2 rounded-2xl shadow-2xl border border-border">
              <div className="flex items-center gap-2.5 p-1.5">
                <Avatar className="h-10 w-10 border border-border">
                  <AvatarImage src={user.avatarUrl || ''} />
                  <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                    {userInitials}
                  </AvatarFallback>
                </Avatar>
                <div className="flex flex-col min-w-0">
                  <p className="font-bold text-xs text-foreground truncate">
                    {user.displayName || (user as any).display_name || user.username}
                  </p>
                  <p className="text-[11px] text-muted-foreground truncate">@{user.username}</p>
                </div>
              </div>
              <DropdownMenuSeparator />
              <DropdownMenuItem
                onClick={() => router.push(`/${user.username}`)}
                className="cursor-pointer font-medium text-xs rounded-xl"
              >
                <User className="mr-2 h-4 w-4 text-primary" /> Hồ sơ cá nhân
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => router.push('/home?tab=bookmarks')} className="text-xs rounded-xl cursor-pointer">
                <Sparkles className="mr-2 h-4 w-4 text-accent" /> Bài viết đã lưu
              </DropdownMenuItem>
              <DropdownMenuSeparator />
              <DropdownMenuItem onClick={logout} disabled={isLoggingOut} className="text-destructive cursor-pointer text-xs rounded-xl">
                <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        ) : (
          <Button
            size="sm"
            variant="ghost"
            onClick={() => setIsAuthOpen(true)}
            className="h-8 px-2 text-xs font-semibold"
          >
            <LogIn className="h-4 w-4" />
          </Button>
        )}

        {/* Center: Stylized Brand Logo (Like X icon centered at top) */}
        <Link href="/home" className="flex items-center gap-1.5 cursor-pointer">
          <div className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary text-primary-foreground font-black text-xs shadow-xs">
            PU
          </div>
          <span className="font-black text-sm tracking-tight text-foreground">
            PU Connector
          </span>
        </Link>

        {/* Right: Search, Notifications & Theme */}
        <div className="flex items-center gap-1">
          <Button
            variant="ghost"
            size="icon"
            onClick={() => setIsCommandOpen(true)}
            className="h-8 w-8 text-muted-foreground hover:text-foreground cursor-pointer rounded-full"
            title="Tìm kiếm"
          >
            <Search className="h-4 w-4" />
          </Button>

          <NotificationsPopover />

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-8 w-8 text-muted-foreground rounded-full cursor-pointer">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" className="rounded-xl">
              <DropdownMenuItem onClick={() => setTheme('light')}>
                <Sun className="mr-2 h-4 w-4" /> Sáng
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('dark')}>
                <Moon className="mr-2 h-4 w-4" /> Tối
              </DropdownMenuItem>
              <DropdownMenuItem onClick={() => setTheme('system')}>
                <Laptop className="mr-2 h-4 w-4" /> Hệ thống
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </div>
    </header>
  )
}
