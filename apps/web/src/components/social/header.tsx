'use client'

import React, { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import {
  Search,
  Bell,
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
import { apiClient } from '@/lib/api-client'
import type { UserProfile } from '@pu/schemas'
import { toast } from 'sonner'

export function Header() {
  const router = useRouter()
  const { theme, setTheme } = useTheme()
  const user = useAppStore((state) => state.user)
  const setUser = useAppStore((state) => state.setUser)
  const logout = useAppStore((state) => state.logout)
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

  const handleLogout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' })
      logout()
      toast.success('Đã đăng xuất phiên làm việc')
    } catch {
      logout()
    }
  }

  return (
    <header className="sticky top-0 z-40 w-full border-b border-border bg-background/95 backdrop-blur-md">
      <CommandPalette open={isCommandOpen} onOpenChange={setIsCommandOpen} onSelectTab={() => {}} />
      <AuthDialog open={isAuthOpen} onOpenChange={setIsAuthOpen} />

      <div className="mx-auto flex h-16 max-w-7xl items-center justify-between px-4 sm:px-6">
        <div className="flex items-center gap-6">
          <a href="/" className="flex items-center gap-2.5 group">
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
          </a>

          {/* Quick Search & Command Palette Trigger */}
          <button
            onClick={() => setIsCommandOpen(true)}
            className="relative hidden md:flex items-center justify-between w-80 rounded-lg border border-input bg-muted/40 px-3 py-1.5 text-xs text-muted-foreground hover:border-border hover:bg-muted/70 transition-colors cursor-pointer"
          >
            <div className="flex items-center gap-2">
              <Search className="h-4 w-4 text-muted-foreground" />
              <span>Tìm kiếm nhanh...</span>
            </div>
            <kbd className="pointer-events-none inline-flex h-5 select-none items-center gap-1 rounded border bg-muted px-1.5 font-mono text-[10px] font-medium text-muted-foreground">
              <span className="text-xs">⌘</span>K
            </kbd>
          </button>
        </div>

        <div className="flex items-center gap-2.5">
          <Button
            size="sm"
            onClick={() => {
              if (!user) {
                setIsAuthOpen(true)
                return
              }
              setCreatePostOpen(true)
            }}
            className="gap-1.5 text-xs font-semibold bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm"
          >
            <Plus className="h-4 w-4" />
            <span className="hidden sm:inline">Đăng bài / Chia sẻ</span>
          </Button>

          <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground relative">
            <Bell className="h-4 w-4" />
            <span className="absolute top-2 right-2 h-2 w-2 rounded-full bg-accent animate-pulse" />
          </Button>

          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" className="h-9 w-9 text-muted-foreground">
                <Sun className="h-4 w-4 rotate-0 scale-100 transition-all dark:-rotate-90 dark:scale-0" />
                <Moon className="absolute h-4 w-4 rotate-90 scale-0 transition-all dark:rotate-0 dark:scale-100" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
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
                <Button variant="ghost" className="relative h-9 w-9 rounded-full p-0 border border-border">
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={user.avatarUrl || ''} />
                    <AvatarFallback className="bg-primary/10 text-primary font-bold text-xs">
                      {(user.displayName || (user as any).display_name || user.username || 'PU')
                        .slice(0, 2)
                        .toUpperCase()}
                    </AvatarFallback>
                  </Avatar>
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-64">
                <div className="flex items-center justify-start gap-2 p-2.5">
                  <div className="flex flex-col space-y-1 leading-none">
                    <div className="flex items-center gap-1.5">
                      <p className="font-semibold text-sm">
                        {user.displayName || (user as any).display_name || user.username || 'Sinh viên Phenikaa'}
                      </p>
                      {user.faculty && (
                        <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium text-primary">
                          {user.faculty}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{user.email}</p>
                  </div>
                </div>
                <DropdownMenuSeparator />
                <DropdownMenuItem
                  onClick={() => router.push(`/${user.username}`)}
                  className="cursor-pointer font-medium text-primary"
                >
                  <User className="mr-2 h-4 w-4" /> Trang cá nhân của tôi
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <GraduationCap className="mr-2 h-4 w-4" /> Mã SV: {user.studentId || (user as any).student_id || 'N/A'}
                </DropdownMenuItem>
                <DropdownMenuItem onClick={() => router.push('/groups')}>
                  <Users className="mr-2 h-4 w-4" /> Nhóm đồ án của tôi
                </DropdownMenuItem>
                <DropdownMenuItem>
                  <Sparkles className="mr-2 h-4 w-4 text-accent" /> Điểm danh vọng: {user.reputationPoints ?? (user as any).reputation_points ?? 100} pts
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem onClick={handleLogout} className="text-destructive cursor-pointer">
                  <LogOut className="mr-2 h-4 w-4" /> Đăng xuất
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          ) : (
            <Button
              size="sm"
              variant="outline"
              onClick={() => setIsAuthOpen(true)}
              className="gap-1.5 text-xs border-primary/40 text-primary hover:bg-primary/5"
            >
              <LogIn className="h-4 w-4" />
              <span>Đăng nhập</span>
            </Button>
          )}
        </div>
      </div>
    </header>
  )
}
