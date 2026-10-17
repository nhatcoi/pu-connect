'use client'

import React from 'react'
import Link from 'next/link'
import { N7AiMark } from '@/components/brand/pu-logo'
import { PUAI_HOME } from '@/lib/puai-routes'

// Nút nổi góc phải dưới ⇒ không gian PU AI; chỉ mobile (desktop đã có mục PU AI ở sidebar + thẻ cột phải)
export function PuaiFab() {
  return (
    <Link
      href={PUAI_HOME}
      aria-label="Mở không gian PU AI"
      title="PU AI"
      className="md:hidden fixed right-4 bottom-20 z-40 h-14 w-14 rounded-full bg-card shadow-lg ring-1 ring-border flex items-center justify-center transition-transform hover:scale-105 active:scale-95"
    >
      <N7AiMark className="h-8 w-8" />
    </Link>
  )
}
