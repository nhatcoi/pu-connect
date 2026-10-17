import React from 'react'
import { cn } from '@/lib/api'

// Bảng dữ liệu gọn: header mờ, hàng hover, cuộn ngang trên mobile
export function Table({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className={cn('overflow-x-auto rounded-xl border border-border bg-card', className)}>
      <table className="w-full border-collapse text-sm">{children}</table>
    </div>
  )
}

export function THead({ children }: { children: React.ReactNode }) {
  return (
    <thead>
      <tr className="border-b border-border bg-muted/40 text-left text-xs font-medium text-muted-foreground">{children}</tr>
    </thead>
  )
}

export function Th({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <th className={cn('h-10 px-4 font-medium whitespace-nowrap', className)}>{children}</th>
}

export function TBody({ children }: { children: React.ReactNode }) {
  return <tbody className="divide-y divide-border">{children}</tbody>
}

export function Tr({ children, className, onClick }: { children: React.ReactNode; className?: string; onClick?: () => void }) {
  return (
    <tr onClick={onClick} className={cn('transition-colors hover:bg-accent/60', onClick && 'cursor-pointer', className)}>
      {children}
    </tr>
  )
}

export function Td({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <td className={cn('px-4 py-3 align-middle', className)}>{children}</td>
}

// Danh sách dạng hàng (khi nội dung dài, không hợp bảng)
export function List({ children, className }: { children: React.ReactNode; className?: string }) {
  return <div className={cn('divide-y divide-border rounded-xl border border-border bg-card', className)}>{children}</div>
}
