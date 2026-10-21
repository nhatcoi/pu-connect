'use client'

import React from 'react'
import { ArrowUpRight } from 'lucide-react'
import { N7AiMark } from '@/components/brand/pu-logo'
import { cn } from '@/lib/utils'
import { n7aiChatUrl } from '@/lib/n7ai'

const linkProps = { href: n7aiChatUrl(), target: '_blank', rel: 'noopener noreferrer' } as const

// Nút gọn ở đầu hội thoại N7AI (header là @container: cột hẹp ⇒ chỉ icon)
export function OpenInN7AiButton({ className }: { className?: string }) {
  return (
    <a
      {...linkProps}
      title="Mở N7AI — tra lịch học, lịch thi, Canvas"
      className={cn(
        'inline-flex h-8 items-center gap-1.5 rounded-full px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors',
        className
      )}
    >
      <N7AiMark className="h-4 w-4" />
      <span className="hidden @xl:inline">Mở trong N7AI</span>
      <ArrowUpRight className="h-3 w-3" />
    </a>
  )
}

// Thẻ giới thiệu ở màn chào N7AI: N7AI làm được việc N7AI không làm (dữ liệu trường)
export function OpenInN7AiCard() {
  return (
    <a
      {...linkProps}
      className="group mx-auto flex max-w-lg items-center gap-3 rounded-xl border border-border bg-card p-3 text-left hover:border-primary/30 hover:bg-primary/5 transition-colors"
    >
      <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-muted">
        <N7AiMark className="h-6 w-6" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block text-[13px] font-semibold">Mở trong N7AI</span>
        <span className="block text-[11px] text-muted-foreground">Tra lịch học, lịch thi, bài tập Canvas — cần extension N7AI</span>
      </span>
      <ArrowUpRight className="h-4 w-4 shrink-0 text-muted-foreground group-hover:text-primary" />
    </a>
  )
}
