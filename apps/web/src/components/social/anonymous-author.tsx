import React from 'react'
import { VenetianMask } from 'lucide-react'
import { cn } from '@/lib/utils'

// Avatar + nhãn cho bài / bình luận ẩn danh (không link sang hồ sơ)
// Avatar & label for anonymous content (never links to a profile)
export function AnonymousAvatar({ className }: { className?: string }) {
  return (
    <span className={cn('flex shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground', className ?? 'h-9 w-9')} aria-hidden>
      <VenetianMask className="h-1/2 w-1/2" />
    </span>
  )
}

export function anonymousName(isMine?: boolean): string {
  return isMine ? 'Ẩn danh (bạn)' : 'Ẩn danh'
}
