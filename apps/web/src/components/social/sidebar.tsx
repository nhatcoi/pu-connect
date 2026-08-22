'use client'

import React from 'react'
import {
  Flame,
  FileText,
  Bookmark,
  Hash,
  Users,
  Compass,
  Settings,
  HelpCircle
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { cn } from '@/lib/utils'

interface SidebarProps {
  currentTab: 'feed' | 'documents' | 'explore' | 'bookmarks'
  onTabChange: (tab: 'feed' | 'documents' | 'explore' | 'bookmarks') => void
}

export function Sidebar({ currentTab, onTabChange }: SidebarProps) {
  const navItems = [
    { id: 'feed' as const, label: 'Bảng tin nổi bật', icon: Flame },
    { id: 'documents' as const, label: 'Kho tài liệu & Mã nguồn', icon: FileText },
    { id: 'explore' as const, label: 'Khám phá cộng đồng', icon: Compass },
    { id: 'bookmarks' as const, label: 'Đã lưu / Yêu thích', icon: Bookmark }
  ]

  const popularTags = ['nextjs', 'react-native', 'shadcn', 'nestjs', 'golang', 'ai-agent', 'typescript']

  return (
    <aside className="w-64 shrink-0 space-y-6 hidden lg:block">
      <div className="space-y-1">
        <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Điều hướng
        </p>
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = currentTab === item.id
          return (
            <Button
              key={item.id}
              variant={isActive ? 'secondary' : 'ghost'}
              onClick={() => onTabChange(item.id)}
              className={cn(
                'w-full justify-start gap-3 text-sm font-normal',
                isActive && 'font-semibold bg-accent text-accent-foreground'
              )}
            >
              <Icon className="h-4 w-4" />
              {item.label}
            </Button>
          )
        })}
      </div>

      <div className="space-y-2 border-t pt-4">
        <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Chủ đề thịnh hành
        </p>
        <div className="flex flex-wrap gap-1.5 px-3">
          {popularTags.map((tag) => (
            <button
              key={tag}
              className="flex items-center gap-1 rounded-md border bg-muted/30 px-2.5 py-1 text-xs text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
            >
              <Hash className="h-3 w-3 text-primary" />
              {tag}
            </button>
          ))}
        </div>
      </div>

      <div className="space-y-1 border-t pt-4">
        <p className="px-3 text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
          Hệ thống
        </p>
        <Button variant="ghost" className="w-full justify-start gap-3 text-xs text-muted-foreground">
          <Settings className="h-4 w-4" /> Cài đặt không gian
        </Button>
        <Button variant="ghost" className="w-full justify-start gap-3 text-xs text-muted-foreground">
          <HelpCircle className="h-4 w-4" /> Hướng dẫn & Trợ giúp
        </Button>
      </div>
    </aside>
  )
}
