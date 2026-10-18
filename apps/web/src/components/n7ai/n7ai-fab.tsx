'use client'

import React from 'react'
import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { N7AiMark } from '@/components/brand/pu-logo'
import { N7AI_HOME, isN7AiPath } from '@/lib/n7ai-routes'
import { cn } from '@/lib/utils'

// Nút nổi góc phải dưới ⇒ không gian N7AI (gắn 1 lần trong AppLayout)
// Desktop: mọi trang; mobile: chỉ danh sách Tin nhắn (nằm trên thanh điều hướng đáy)
// Ẩn trong không gian N7AI và trong hội thoại (ô soạn tin ở đáy)
export function N7AiFab() {
  const pathname = usePathname()
  if (isN7AiPath(pathname) || pathname.startsWith('/messages/')) return null
  return (
    <Link
      href={N7AI_HOME}
      aria-label="Mở không gian N7AI"
      title="N7AI"
      className={cn(
        'fixed right-4 bottom-20 md:bottom-6 md:right-6 z-40 h-14 w-14 rounded-full bg-card shadow-lg ring-1 ring-border items-center justify-center transition-transform hover:scale-105 active:scale-95',
        pathname === '/messages' ? 'flex' : 'hidden md:flex'
      )}
    >
      <N7AiMark className="h-8 w-8" />
    </Link>
  )
}
