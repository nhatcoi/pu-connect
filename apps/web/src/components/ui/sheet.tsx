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
  const panel = React.useRef<HTMLDivElement>(null)
  const drag = React.useRef({ x: 0, y: 0, dx: 0, mode: 'idle' as 'idle' | 'track' | 'h' | 'v' })
  const paint = (x: number, animate: boolean) => {
    const el = panel.current
    if (!el) return
    el.style.transition = animate ? 'transform 200ms cubic-bezier(0.2,0.8,0.2,1)' : 'none'
    el.style.transform = x ? `translate3d(${x}px,0,0)` : ''
  }
  // Vuốt sang trái để đóng: ngăn kéo đi theo ngón tay, thả quá 1/3 chiều rộng thì đóng
  const onTouchStart = (e: React.TouchEvent) => {
    drag.current = { x: e.touches[0].clientX, y: e.touches[0].clientY, dx: 0, mode: 'track' }
  }
  const onTouchMove = (e: React.TouchEvent) => {
    const d = drag.current
    if (d.mode === 'idle' || d.mode === 'v') return
    const mx = e.touches[0].clientX - d.x
    const my = e.touches[0].clientY - d.y
    if (d.mode === 'track') {
      if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
      d.mode = mx < 0 && Math.abs(mx) > Math.abs(my) * 1.4 ? 'h' : 'v'
      if (d.mode === 'v') return
    }
    d.dx = Math.min(0, mx)
    paint(d.dx, false)
  }
  const onTouchEnd = () => {
    const d = drag.current
    if (d.mode === 'h') {
      const width = panel.current?.offsetWidth ?? 300
      if (-d.dx > width / 3) onOpenChange(false)
      paint(0, true)
    }
    d.mode = 'idle'
  }

  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/50" />
        <DialogPrimitive.Content
          ref={panel}
          aria-describedby={undefined}
          onTouchStart={onTouchStart}
          onTouchMove={onTouchMove}
          onTouchEnd={onTouchEnd}
          onTouchCancel={onTouchEnd}
          className={cn('fixed inset-y-0 left-0 z-50 flex w-[85%] max-w-xs touch-pan-y flex-col bg-surface shadow-2xl outline-none', className)}
        >
          <DialogPrimitive.Title className="sr-only">{title}</DialogPrimitive.Title>
          {children}
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  )
}
