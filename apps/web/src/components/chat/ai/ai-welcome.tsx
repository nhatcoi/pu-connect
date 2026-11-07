'use client'

import React from 'react'
import { N7AiMark } from '@/components/brand/pu-logo'

// Màn hình chào N7AI-style: Logo tinh gọn + Tiêu đề Serif editorial trang nhã
export function AiWelcome() {
  return (
    <div className="@container flex w-full flex-1 min-h-0 items-end justify-center overflow-hidden pb-8 sm:pb-12 animate-fade-in px-4">
      <div className="w-full max-w-[768px] flex flex-col @lg:flex-row items-center justify-center gap-2 @lg:gap-4 select-none text-center">
        <N7AiMark className="h-8 w-8 @lg:h-10 @lg:w-10 shrink-0" />
        <h1 className="font-serif text-2xl @lg:text-[40px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">
          Hôm nay bạn muốn học gì?
        </h1>
      </div>
    </div>
  )
}
