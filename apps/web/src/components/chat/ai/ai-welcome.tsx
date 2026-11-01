'use client'

import React from 'react'
import { N7AiMark } from '@/components/brand/pu-logo'

// Màn hình chào DeepTutor-style: Logo tinh gọn + Tiêu đề Serif editorial trang nhã
export function AiWelcome() {
  return (
    <div className="flex w-full flex-1 min-h-0 items-end justify-center overflow-hidden pb-8 sm:pb-12 animate-fade-in px-4">
      <div className="w-full max-w-[768px] flex items-center justify-center gap-3.5 sm:gap-4 select-none">
        <N7AiMark className="h-9 w-9 sm:h-10 sm:w-10 shrink-0" />
        <h1 className="font-serif text-3xl sm:text-[40px] font-medium leading-[1.15] tracking-[-0.015em] text-foreground">
          Hôm nay bạn muốn học gì?
        </h1>
      </div>
    </div>
  )
}
