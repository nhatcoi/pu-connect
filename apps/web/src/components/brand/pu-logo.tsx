import * as React from 'react'
import { cn } from '@/lib/utils'

// Logo mark: chữ U (cộng đồng) + vòm cam (kết nối / cánh phượng)
export function PuMark({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 100 100" className={cn('h-9 w-9', className)} role="img" aria-label="PU Connector">
      <rect width="100" height="100" rx="24" fill="#0B3D91" />
      <path d="M32 34V56a18 18 0 0 0 36 0V34" fill="none" stroke="#fff" strokeWidth="10" strokeLinecap="round" />
      <path d="M32 34Q50 8 68 34" fill="none" stroke="#F7941D" strokeWidth="6" strokeLinecap="round" />
      <circle cx="32" cy="34" r="7" fill="#fff" />
      <circle cx="68" cy="34" r="7" fill="#fff" />
      <circle cx="50" cy="19" r="5.5" fill="#F7941D" />
    </svg>
  )
}

// Lockup ngang: mark + tên
export function PuLogo({
  className,
  markClassName,
  showTagline = false,
}: {
  className?: string
  markClassName?: string
  showTagline?: boolean
}) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <PuMark className={markClassName} />
      <span className="flex flex-col">
        <span className="font-extrabold text-base tracking-tight leading-none text-foreground">PU Connector</span>
        {showTagline && (
          <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mt-1">
            Phenikaa University
          </span>
        )}
      </span>
    </span>
  )
}
