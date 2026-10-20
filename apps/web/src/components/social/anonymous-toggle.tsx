'use client'

import React from 'react'
import { VenetianMask } from 'lucide-react'
import { Switch } from '@/components/ui/switch'
import { cn } from '@/lib/utils'

interface AnonymousToggleProps {
  checked: boolean
  onChange: (checked: boolean) => void
  // post: dòng giải thích đầy đủ; comment: gọn trong thanh công cụ
  variant?: 'post' | 'comment'
  className?: string
}

// Công tắc "Đăng ẩn danh": người khác thấy "Ẩn danh", admin vẫn truy vết khi có báo cáo
// Anonymous toggle shared by the post & comment composers
export function AnonymousToggle({ checked, onChange, variant = 'post', className }: AnonymousToggleProps) {
  const label = variant === 'post' ? 'Đăng ẩn danh' : 'Ẩn danh'
  return (
    <label
      className={cn(
        'flex cursor-pointer items-center gap-2 rounded-xl text-xs',
        variant === 'post' ? 'border border-border bg-muted/30 px-3 py-2' : 'px-1 py-1',
        checked && 'text-primary',
        className
      )}
    >
      <VenetianMask className={cn('h-4 w-4 shrink-0', checked ? 'text-primary' : 'text-muted-foreground')} />
      <span className="min-w-0 flex-1">
        <span className="font-semibold">{label}</span>
        {variant === 'post' && (
          <span className="block text-[11px] font-normal text-muted-foreground">
            Người khác không thấy tên bạn. Quản trị viên vẫn xử lý được khi có báo cáo.
          </span>
        )}
      </span>
      <Switch checked={checked} onCheckedChange={onChange} aria-label={label} />
    </label>
  )
}
