'use client'

import React from 'react'
import Link from 'next/link'
import { N7AiMark } from '@/components/brand/pu-logo'
import { N7AI_HOME } from '@/lib/n7ai-routes'

// Nút nổi góc phải dưới ⇒ không gian N7AI (mobile nằm trên thanh điều hướng đáy)
export function N7AiFab() {
  return (
    <Link
      href={N7AI_HOME}
      aria-label="Mở không gian N7AI"
      title="N7AI"
      className="fixed right-4 bottom-20 md:bottom-6 md:right-6 z-40 h-14 w-14 rounded-full bg-card shadow-lg ring-1 ring-border flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
    >
      <N7AiMark className="h-8 w-8" />
    </Link>
  )
}
