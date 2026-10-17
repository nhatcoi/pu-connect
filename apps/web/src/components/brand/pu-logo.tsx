import * as React from 'react'
import { cn } from '@/lib/utils'

// Logo dạng <img> (không inline SVG): gradient id không đụng nhau khi 1 bản bị ẩn (display:none)
function BrandMark({ src, label, className }: { src: string; label: string; className?: string }) {
  // eslint-disable-next-line @next/next/no-img-element -- SVG tĩnh, không cần tối ưu ảnh
  return <img src={src} alt={label} draggable={false} className={cn('h-9 w-9 shrink-0 object-contain select-none', className)} />
}

// Logo app: chữ P (người dùng) + U/i cam (kết nối)
export function PuMark({ className }: { className?: string }) {
  return <BrandMark src="/brand/pu-mark.svg" label="PU Connector" className={className} />
}

// Logo trợ lý AI (N7AI): kim cương xanh-cam + node mạch
export function N7AiMark({ className }: { className?: string }) {
  return <BrandMark src="/brand/n7ai-mark.svg" label="N7AI" className={className} />
}

// Lockup ngang: mark + tên
export function PuLogo({ className, markClassName, showTagline = false }: { className?: string; markClassName?: string; showTagline?: boolean }) {
  return (
    <span className={cn('inline-flex items-center gap-2.5', className)}>
      <PuMark className={markClassName} />
      <span className="flex flex-col">
        <span className="font-extrabold text-base tracking-tight leading-none text-foreground">PU Connector</span>
        {showTagline && <span className="text-[10px] font-medium text-muted-foreground tracking-wider uppercase mt-1">Phenikaa University</span>}
      </span>
    </span>
  )
}
