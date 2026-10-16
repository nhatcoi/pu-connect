import * as React from 'react'
import { cn } from '@/lib/utils'

// Khối giữ chỗ (Skeleton): cùng kích thước nội dung thật ⇒ không xô lệch bố cục (CLS)
export function Skeleton({ className, ...props }: React.ComponentProps<'div'>) {
  return <div aria-hidden data-slot="skeleton" className={cn('animate-pulse rounded-md bg-muted', className)} {...props} />
}

// Vùng đang tải: báo trình đọc màn hình; chỉ hiện sau 150ms ⇒ mạng nhanh không bị nháy
export function LoadingRegion({ label = 'Đang tải', className, children }: { label?: string; className?: string; children: React.ReactNode }) {
  return (
    <div role="status" aria-busy className={cn('skeleton-reveal', className)}>
      <span className="sr-only">{label}</span>
      {children}
    </div>
  )
}

// Lặp n khối giữ chỗ (danh sách)
export function SkeletonRepeat({ count, children }: { count: number; children: (index: number) => React.ReactNode }) {
  return (
    <>
      {Array.from({ length: count }, (_, i) => (
        <React.Fragment key={i}>{children(i)}</React.Fragment>
      ))}
    </>
  )
}
