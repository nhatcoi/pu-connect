'use client'

import { usePresence } from '@/hooks/chat'
import { cn } from '@/lib/utils'

// Chấm xanh góc avatar khi người dùng đang hoạt động (đặt trong khối relative)
export function PresenceDot({ userId, className }: { userId: string | undefined; className?: string }) {
  const presence = usePresence(userId)
  if (!presence?.online) return null
  return (
    <span
      aria-label="Đang hoạt động"
      className={cn('absolute bottom-0 right-0 block h-3 w-3 rounded-full bg-emerald-500 ring-2 ring-card', className)}
    />
  )
}
