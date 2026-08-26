'use client'

import React, { useEffect, useState } from 'react'
import { useRouter, usePathname } from 'next/navigation'
import Link from 'next/link'
import {
  Plus,
  Moon,
  Sun,
  Laptop,
  GraduationCap,
  Users,
  User,
  Sparkles,
  LogIn,
  LogOut,
  Bookmark
} from 'lucide-react'
import { useTheme } from 'next-themes'
import { useLogout } from '@/hooks/use-logout'
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

export function Header() {
  const router = useRouter()
  const pathname = usePathname()
  const { theme, setTheme } = useTheme()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const { logout, isLoggingOut } = useLogout()
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)

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

  // On mobile /search and /[username], dedicated X-style top headers are rendered
  const isSearchPage = pathname === '/search'
  const isProfilePage = pathname?.startsWith('/@') || (pathname?.length > 1 && !['/home', '/get-started', '/search'].includes(pathname))

  return (
    <header className="w-full relative md:sticky md:top-0 z-40 border-b border-border/80 bg-background/95 backdrop-blur-md">
      <CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} onSelectTab={() => {}} />
      <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />

      {/* ── 1. Desktop & Tablet Header (md:flex) ── */}
      <div className="hidden md:flex mx-auto h-14 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <Link href="/home" className="flex items-center gap-2.5 group cursor-pointer">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary text-primary-foreground font-black text-base shadow-xs group-hover:scale-105 transition-transform">
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
            className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs rounded-full cursor-pointer"
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

      {/* ── 2. Signature Mobile Responsive Top Header (X Twitter Exact Architecture) (md:hidden) ── */}
      {/* Automatically hidden on /search and /[username] since they render dedicated top navigation bars */}
      {!isSearchPage && !isProfilePage && (
        <div className="flex md:hidden h-13 items-center justify-between px-4 relative w-full">
          {/* Left: User Avatar (Tap to open quick menu / profile) */}
          <div className="shrink-0">
            {user ? (
              <DropdownMenu>
                <DropdownMenuTrigger asChild>
                  <button
                    type="button"
                    className="relative h-8 w-8 rounded-full p-0 border border-border cursor-pointer select-none overflow-hidden hover:opacity-80 transition-opacity"
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
                    <Bookmark className="mr-2 h-4 w-4 text-amber-500" /> Bài viết đã lưu
                  </DropdownMenuItem>
                  <DropdownMenuItem onClick={() => router.push('/home?tab=courses')} className="text-xs rounded-xl cursor-pointer">
                    <GraduationCap className="mr-2 h-4 w-4 text-primary" /> Môn học & Đề thi
                  </DropdownMenuItem>
                  <DropdownMenuSeparator />
                  <DropdownMenuItem onClick={logout} disabled={isLoggingOut} className="text-destructive cursor-pointer text-xs rounded-xl">
                    <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                  </DropdownMenuItem>
                </DropdownMenuContent>
              </DropdownMenu>
            ) : (
              <button
                type="button"
                onClick={() => setIsAuthOpen(true)}
                className="h-8 w-8 rounded-full border border-dashed border-border flex items-center justify-center text-muted-foreground hover:text-foreground cursor-pointer"
              >
                <User className="h-4 w-4" />
              </button>
            )}
          </div>

          {/* Center: Stylized Minimalist Emblem Logo (Perfect Center Alignment like X) */}
          <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-auto">
            <Link href="/home" className="flex items-center justify-center cursor-pointer group">
              <div className="flex h-8 w-8 items-center justify-center rounded-xl bg-foreground text-background font-black text-sm shadow-xs group-hover:scale-105 transition-transform tracking-tighter">
                PU
              </div>
            </Link>
          </div>

          {/* Right: Signature Pill Action Button (Matches X "Subscribe / Action" Pill Style) */}
          <div className="shrink-0 flex items-center gap-1.5">
            {user ? (
              <Button
                size="sm"
                onClick={() => setCreatePostOpen(true)}
                className="h-8 px-3.5 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer gap-1"
              >
                <Plus className="h-3.5 w-3.5" />
                <span>Đăng bài</span>
              </Button>
            ) : (
              <Button
                size="sm"
                onClick={() => setIsAuthOpen(true)}
                className="h-8 px-3.5 rounded-full text-xs font-bold bg-primary text-primary-foreground hover:bg-primary/90 shadow-xs cursor-pointer"
              >
                <span>Đăng nhập</span>
              </Button>
            )}
          </div>
        </div>
      )}
    </header>
  )
}
