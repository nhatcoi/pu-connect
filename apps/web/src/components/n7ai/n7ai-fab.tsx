'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { BookOpen } from 'lucide-react'
import { N7AiMark } from '@/components/brand/pu-logo'
import { N7AI_HOME, isN7AiPath } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'

export const DOCS_URL = 'https://docs-puc.vnhat.dev'

// Cụm nút nổi (Floating Action Buttons): Tài liệu (Documentation) & Trợ lý N7AI (Chat)
// Vị trí: dịch sang trái một chút (right-6 md:right-10, bottom-20 md:bottom-8) để không che mép cuộn
// Desktop: luôn hiển thị (trừ không gian N7AI); mobile: danh sách Tin nhắn (tránh che thanh đáy)
export function N7AiFab() {
  const pathname = usePathname()
  if (isN7AiPath(pathname) || pathname.startsWith('/messages/')) return null

  const isVisibleMobile = pathname === '/messages'

  return (
    <div
      className={cn(
        'fixed right-6 md:right-10 bottom-20 md:bottom-8 z-40 flex flex-col items-center gap-3 select-none',
        isVisibleMobile ? 'flex' : 'hidden md:flex'
      )}
    >
      {/* Nút FAB Tài liệu (Documentation -> docs-puc.vnhat.dev) nằm trên Chat */}
      <a
        href={DOCS_URL}
        target="_blank"
        rel="noopener noreferrer"
        aria-label="Tài liệu dự án PU Connector (docs-puc.vnhat.dev)"
        title="Tài liệu dự án (docs-puc.vnhat.dev)"
        className="group relative flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-card text-foreground shadow-lg ring-1 ring-border transition-all duration-200 hover:scale-105 hover:ring-primary/50 hover:text-primary active:scale-95"
      >
        <BookOpen className="h-5 w-5 md:h-6 md:w-6 transition-transform duration-200 group-hover:scale-110" />
        {/* Tooltip khi rê chuột trên Desktop */}
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-border opacity-0 transition-opacity duration-150 group-hover:opacity-100 hidden md:inline-block">
          Tài liệu dự án (docs-puc)
        </span>
      </a>

      {/* Nút FAB Chat (N7AI) */}
      <Link
        href={N7AI_HOME}
        aria-label="Mở không gian N7AI"
        title="N7AI - Trợ lý sinh viên"
        className="group relative flex h-12 w-12 md:h-14 md:w-14 items-center justify-center rounded-full bg-card shadow-lg ring-1 ring-border transition-all duration-200 hover:scale-105 hover:ring-primary/50 active:scale-95"
      >
        <N7AiMark className="h-7 w-7 md:h-8 md:w-8 transition-transform duration-200 group-hover:scale-110" />
        {/* Tooltip khi rê chuột trên Desktop */}
        <span className="pointer-events-none absolute right-full mr-3 whitespace-nowrap rounded-lg bg-popover px-2.5 py-1 text-xs font-medium text-popover-foreground shadow-md ring-1 ring-border opacity-0 transition-opacity duration-150 group-hover:opacity-100 hidden md:inline-block">
          Trợ lý N7AI
        </span>
      </Link>
    </div>
  )
}

export const FloatingActionButtons = N7AiFab

