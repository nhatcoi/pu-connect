'use client'

import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Home,
  Search,
  GraduationCap,
  FileText,
  Bookmark,
  Plus
} from 'lucide-react'
import { useAppStore } from '@/store'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const currentTabParam = searchParams.get('tab')
  const setCreatePostOpen = useAppStore((state) => state.setCreatePostOpen)
  
  // High-performance scroll state for fade/dimming on scroll
  const { isHeaderVisible, isScrolling, isAtTop } = useScrollDirection(8)
  const isDimmed = !isAtTop && (!isHeaderVisible || isScrolling)

  // Don't show bottom nav on landing / auth / onboarding pages
  if (pathname === '/' || pathname === '/get-started') {
    return null
  }

  const navItems = [
    {
      id: 'feed',
      label: 'Bảng tin',
      icon: Home,
      path: '/home',
      isActive: pathname === '/home' && (!currentTabParam || currentTabParam === 'for_you')
    },
    {
      id: 'search',
      label: 'Khám phá',
      icon: Search,
      path: '/search',
      isActive: pathname === '/search'
    },
    {
      id: 'courses',
      label: 'Môn học',
      icon: GraduationCap,
      path: '/home?tab=courses',
      isActive: pathname === '/home' && currentTabParam === 'courses'
    },
    {
      id: 'documents',
      label: 'Tài liệu',
      icon: FileText,
      path: '/home?tab=documents',
      isActive: pathname === '/home' && currentTabParam === 'documents'
    },
    {
      id: 'bookmarks',
      label: 'Đã lưu',
      icon: Bookmark,
      path: '/home?tab=bookmarks',
      isActive: pathname === '/home' && currentTabParam === 'bookmarks'
    }
  ]

  return (
    <>
      {/* Floating Action Button (FAB) — Smoothly dims & scales down when scrolling */}
      <button
        type="button"
        onClick={() => setCreatePostOpen(true)}
        aria-label="Tạo bài viết mới"
        className={cn(
          'fixed bottom-18 right-4 z-40 flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground shadow-2xl shadow-primary/30 transition-all duration-300 ease-in-out active:scale-95 md:hidden cursor-pointer',
          isDimmed
            ? 'opacity-25 scale-90 translate-y-2 pointer-events-none'
            : 'opacity-100 scale-100 translate-y-0 pointer-events-auto hover:scale-105'
        )}
      >
        <Plus className="h-6 w-6 stroke-[2.5]" />
      </button>

      {/* Sticky Bottom Navigation Bar — Smoothly fades and dims when scrolling */}
      <nav
        aria-label="Mobile Navigation"
        className={cn(
          'fixed bottom-0 left-0 right-0 z-40 flex h-14 items-center justify-around border-t border-border bg-background/90 px-2 backdrop-blur-md md:hidden transition-all duration-300 ease-in-out',
          isDimmed
            ? 'opacity-25 blur-[0.5px] translate-y-1 pointer-events-none hover:opacity-100 hover:pointer-events-auto'
            : 'opacity-100 blur-none translate-y-0 pointer-events-auto'
        )}
      >
        {navItems.map((item) => {
          const Icon = item.icon
          const isActive = item.isActive

          return (
            <button
              key={item.id}
              type="button"
              onClick={() => router.push(item.path)}
              className={cn(
                'relative flex flex-1 flex-col items-center justify-center py-1 text-[10px] font-medium transition-colors cursor-pointer',
                isActive
                  ? 'text-foreground font-bold'
                  : 'text-muted-foreground hover:text-foreground'
              )}
            >
              <div className="relative flex items-center justify-center">
                <Icon
                  className={cn(
                    'h-5 w-5 transition-transform duration-150',
                    isActive ? 'scale-110 stroke-[2.5] text-primary' : 'stroke-[1.75]'
                  )}
                />
                {isActive && (
                  <span className="absolute -top-1 right-[-4px] h-1.5 w-1.5 rounded-full bg-primary" />
                )}
              </div>
              <span className="mt-0.5 tracking-tight truncate max-w-[64px]">{item.label}</span>
            </button>
          )
        })}
      </nav>
    </>
  )
}
