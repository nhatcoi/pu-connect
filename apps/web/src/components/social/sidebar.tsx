'use client'

import React from 'react'
import { usePathname, useRouter } from 'next/navigation'
import {
  Home,
  Flame,
  FileText,
  Bookmark,
  Hash,
  Users,
  User,
  GraduationCap,
  Building2,
  HelpCircle,
  LogOut,
  Sparkles
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAppStore } from '@/store'
import { apiClient } from '@/lib/api-client'
import { toast } from 'sonner'
import { cn } from '@/lib/utils'

export type NavTabType = 'feed' | 'profile' | 'documents' | 'courses' | 'groups' | 'campus' | 'bookmarks'

interface SidebarProps {
  currentTab?: NavTabType
  onTabChange?: (tab: NavTabType) => void
}

export function Sidebar({ currentTab, onTabChange }: SidebarProps) {
  const pathname = usePathname()
  const router = useRouter()
  const user = useAppStore((state) => state.user)
  const logout = useAppStore((state) => state.logout)

  const navItems = [
    { id: 'feed' as const, path: '/home', label: 'Bảng tin học thuật', icon: Home, badge: 'Mới' },
    ...(user?.username
      ? [{ id: 'profile' as const, path: `/${user.username}`, label: 'Hồ sơ cá nhân', icon: User }]
      : []),
    { id: 'courses' as const, path: '/home?tab=courses', label: 'Học phần và môn học', icon: GraduationCap },
    { id: 'documents' as const, path: '/home?tab=documents', label: 'Kho tài liệu & đề thi', icon: FileText },
    { id: 'groups' as const, path: '/home?tab=groups', label: 'Ghép nhóm đồ án PBL', icon: Users, badge: 'Tuyển' },
    { id: 'campus' as const, path: '/home?tab=campus', label: 'Nhịp sống & CLB Phenikaa', icon: Building2 },
    { id: 'bookmarks' as const, path: '/home?tab=bookmarks', label: 'Đã lưu và yêu thích', icon: Bookmark }
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

  const handleLogout = async () => {
    try {
      await apiClient('/auth/logout', { method: 'POST' })
      logout()
      toast.success('Đã đăng xuất tài khoản')
      router.replace('/')
    } catch {
      logout()
      router.replace('/')
    }
  }

  return (
    <aside className="w-full space-y-5">
      {/* 1. Main Navigation Links (X-style rounded) */}
      <div className="space-y-1">
        <p className="px-3 pb-1 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Phân hệ chính
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab ? currentTab === item.id : pathname === item.path
          return (
            <Button
              key={item.id}
              variant={isActive ? 'secondary' : 'ghost'}
              onClick={() => {
                if (onTabChange) {
                  onTabChange(item.id)
                } else {
                  router.push(item.path)
                }
              }}
              className={cn(
                'w-full justify-between text-xs font-semibold h-10 rounded-xl px-3 transition-colors',
                isActive && 'bg-primary/10 text-primary hover:bg-primary/15'
              )}
            >
              <div className="flex items-center gap-3">
                <Icon className={cn('h-4 w-4', isActive ? 'text-primary' : 'text-muted-foreground')} />
                <span>{item.label}</span>
              </div>
              {item.badge && (
                <span
                  className={cn(
                    'rounded-full px-2 py-0.5 text-[10px] font-bold',
                    item.badge === 'Mới'
                      ? 'bg-accent/15 text-accent'
                      : 'bg-primary/15 text-primary'
                  )}
                >
                  {item.badge}
                </span>
              )}
            </Button>
          )
        })}
      </div>

      {/* 2. Faculty & Departments */}
      <div className="space-y-2 border-t border-border pt-4">
        <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Khoa và Viện đào tạo
        </p>
        <div className="flex flex-wrap gap-1.5 px-3">
          {facultyTags.map((fac) => (
            <button
              key={fac.code}
              className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 px-2 py-1 text-[11px] text-muted-foreground transition-all hover:border-primary/50 hover:bg-primary/5 hover:text-primary cursor-pointer"
            >
              <span className="font-semibold text-foreground">{fac.code}</span>
              <span className="text-[10px] opacity-70">({fac.name})</span>
            </button>
          ))}
        </div>
      </div>

      {/* 3. Hot Trending Courses */}
      <div className="space-y-2 border-t border-border pt-4">
        <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Môn học sôi nổi
        </p>
        <div className="space-y-1 px-1">
          {hotCourses.map((course) => (
            <div
              key={course}
              className="flex items-center gap-2 px-2 py-1.5 rounded-lg hover:bg-muted/50 cursor-pointer text-xs text-muted-foreground hover:text-foreground transition-colors"
            >
              <Hash className="h-3.5 w-3.5 text-accent" />
              <span className="truncate">{course}</span>
            </div>
          ))}
        </div>
      </div>

      {/* 4. Student Support & Logout */}
      <div className="space-y-1 border-t border-border pt-4">
        <p className="px-3 text-[11px] font-bold text-muted-foreground uppercase tracking-wider">
          Hỗ trợ sinh viên
        </p>
        <Button variant="ghost" className="w-full justify-start gap-3 text-xs text-muted-foreground rounded-xl">
          <Building2 className="h-4 w-4" /> Cổng Portal & Lịch học
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-xs text-muted-foreground rounded-xl">
          <HelpCircle className="h-4 w-4" /> Hướng dẫn & Quy chế
        </Button>
        {user && (
          <Button
            variant="ghost"
            onClick={handleLogout}
            className="w-full justify-start gap-3 text-xs text-destructive hover:bg-destructive/10 rounded-xl mt-2"
          >
            <LogOut className="h-4 w-4" /> Đăng xuất phiên làm việc
          </Button>
        )}
      </div>
    </aside>
  )
}
