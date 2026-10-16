'use client'

import * as React from 'react'
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { cn } from '@/lib/utils'

// Ngăn kéo trượt từ cạnh trái (mobile): Radix Dialog ⇒ khóa cuộn, bẫy focus, Esc / chạm nền để đóng
export function Sheet({
  open,
  onOpenChange,
  title,
  className,
  children
}: {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  className?: string
  children: React.ReactNode
}) {
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          aria-describedby={undefined}
          className={cn('fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-xs flex-col bg-surface shadow-2xl outline-none', className)}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
