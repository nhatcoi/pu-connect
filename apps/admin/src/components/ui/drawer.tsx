import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { X } from 'lucide-react'
import { cn } from '@/lib/api'
import { Button } from './button'

// Ngăn trượt bên phải (chi tiết bản ghi) — full màn hình trên mobile
export function Drawer({
  open,
  onClose,
  children,
  header,
  width = 'sm:max-w-xl'
}: {
  open: boolean
  onClose: () => void
  children: React.ReactNode
  header?: React.ReactNode
  width?: string
}) {
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      // Escape đóng drawer nếu không có dialog/menu nào đang mở phía trên
      if (e.key === 'Escape' && !document.querySelector('[role="dialog"][aria-modal="true"], [role="menu"]')) onClose()
    }
    document.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => {
      document.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
    }
  }, [open, onClose])

  if (!open) return null

  return createPortal(
    <div className="fixed inset-0 z-40" onMouseDown={onClose}>
      <div className="absolute inset-0 bg-black/30" />
      <aside
        role="complementary"
        onMouseDown={(e) => e.stopPropagation()}
        className={cn(
          'absolute inset-y-0 right-0 flex w-full flex-col border-l border-border bg-background shadow-2xl',
          'animate-[drawer-in_180ms_ease-out]',
          width
        )}
      >
        <div className="flex items-start gap-2 border-b border-border px-5 py-4">
          <div className="min-w-0 flex-1">{header}</div>
          <Button variant="ghost" size="icon-sm" onClick={onClose} aria-label="Đóng" className="-mr-2">
            <X />
          </Button>
        </div>
        <div className="min-h-0 flex-1 overflow-y-auto">{children}</div>
      </aside>
    </div>,
    document.body
  )
}
