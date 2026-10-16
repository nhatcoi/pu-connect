'use client'

import React from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import {
  Home,
  Search,
  GraduationCap,
  FileText,
  Compass,
  MessageCircle
} from 'lucide-react'
import { useScrollDirection } from '@/hooks/use-scroll-direction'
import { useUnreadMessages } from '@/hooks/chat'
import { FEATURES } from '@/lib/features'
import { cn } from '@/lib/utils'

export function MobileBottomNav() {
  const pathname = usePathname()
  const router = useRouter()
  const searchParams = useSearchParams()
  const unreadMessages = useUnreadMessages()
  
  // High-performance scroll state for fade/dimming on scroll
  const { isHeaderVisible, isScrolling, isAtTop } = useScrollDirection(8)
  const isDimmed = !isAtTop && (!isHeaderVisible || isScrolling)

  const navItems = [
    {
      id: 'feed',
      label: 'Bảng tin',
      icon: Home,
      path: '/',
      isActive: pathname === '/'
    },
    {
      id: 'search',
      label: 'Khám phá',
      icon: Search,
      path: '/search',
      isActive: pathname === '/search' && (!searchParams.get('type') || searchParams.get('type') === 'all')
    },
    {
      id: 'courses',
      label: 'Học phần',
      icon: GraduationCap,
      path: '/courses',
      isActive: pathname === '/courses' || pathname.startsWith('/courses/')
    },
    {
      id: 'messages',
      label: 'Tin nhắn',
      icon: MessageCircle,
      path: '/messages',
      isActive: pathname === '/messages' || pathname.startsWith('/messages/'),
      unread: unreadMessages
    },
    ...(FEATURES.categoryShortcuts ? [{
      id: 'documents',
      label: 'Tài liệu',
      icon: FileText,
      path: '/search?type=documents',
      isActive: pathname === '/search' && searchParams.get('type') === 'documents'
    }] : []),
    {
      id: 'communities',
      label: 'Cộng đồng',
      icon: Compass,
      path: '/communities',
      isActive: pathname.startsWith('/c/') || pathname === '/communities'
    }
  ]

  return (
    <>
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
                {'unread' in item && !!item.unread ? (
                  <span className="absolute -top-1.5 -right-2.5 min-w-4 h-4 px-1 rounded-full bg-brand-orange text-[9px] font-bold text-white flex items-center justify-center">
                    {item.unread > 9 ? '9+' : item.unread}
                  </span>
                ) : (
                  isActive && <span className="absolute -top-1 right-[-4px] h-1.5 w-1.5 rounded-full bg-primary" />
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
