import React from 'react'
import { BadgeCheck } from 'lucide-react'
import { cn } from '@/lib/api'

export function Avatar({ src, name, className }: { src?: string | null; name: string; className?: string }) {
  return (
    <span
      className={cn(
        'inline-flex size-9 shrink-0 items-center justify-center overflow-hidden rounded-full bg-muted text-xs font-semibold text-muted-foreground',
        className
      )}
    >
      {src ? <img src={src} alt="" className="size-full object-cover" loading="lazy" /> : name.slice(0, 1).toUpperCase()}
    </span>
  )
}

// Avatar + tên + phụ đề (dùng trong bảng)
export function UserCell({
  name,
  sub,
  avatarUrl,
  verified,
  className
}: {
  name: string
  sub?: React.ReactNode
  avatarUrl?: string | null
  verified?: boolean
  className?: string
}) {
  return (
    <div className={cn('flex min-w-0 items-center gap-3', className)}>
      <Avatar src={avatarUrl} name={name} />
      <div className="min-w-0">
        <div className="flex items-center gap-1">
          <span className="truncate text-sm font-semibold text-foreground">{name}</span>
          {verified && <BadgeCheck className="size-4 shrink-0 fill-primary text-card" aria-label="Đã xác thực" />}
        </div>
        {sub && <div className="truncate text-xs text-muted-foreground">{sub}</div>}
      </div>
    </div>
  )
}
