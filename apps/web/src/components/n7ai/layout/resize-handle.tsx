'use client'

import React from 'react'
import { cn } from '@/lib/utils'
import { useN7AiLayout } from './n7ai-layout-store'

const STEP = 16 // px mỗi lần bấm ← / →

// Tay kéo giãn giữa 2 cột (nằm đè lên đường viền): kéo chuột / cảm ứng, phím ← →, nhấp đúp ⇒ mặc định
export function ResizeHandle({
  label,
  onResize,
  onNudge,
  onReset,
  className
}: {
  label: string
  onResize: (clientX: number) => void
  onNudge: (delta: number) => void
  onReset: () => void
  className?: string
}) {
  const setResizing = useN7AiLayout((s) => s.setResizing)
  const end = (e: React.PointerEvent<HTMLDivElement>) => {
    if (e.currentTarget.hasPointerCapture(e.pointerId)) e.currentTarget.releasePointerCapture(e.pointerId)
    setResizing(false)
  }
  return (
    <div className={cn('sticky top-0 z-20 h-dvh w-0 shrink-0', className)}>
      <div
        role="separator"
        aria-orientation="vertical"
        aria-label={label}
        tabIndex={0}
        title="Kéo để đổi độ rộng · nhấp đúp để về mặc định"
        onPointerDown={(e) => {
          e.preventDefault()
          e.currentTarget.setPointerCapture(e.pointerId)
          setResizing(true)
        }}
        onPointerMove={(e) => e.currentTarget.hasPointerCapture(e.pointerId) && onResize(e.clientX)}
        onPointerUp={end}
        onPointerCancel={end}
        onDoubleClick={onReset}
        onKeyDown={(e) => {
          if (e.key === 'ArrowLeft') onNudge(-STEP)
          else if (e.key === 'ArrowRight') onNudge(STEP)
          else return
          e.preventDefault()
        }}
        className="group absolute inset-y-0 -left-1.5 w-3 cursor-col-resize touch-none outline-none"
      >
        <span className="absolute inset-y-0 left-1/2 w-0.5 -translate-x-1/2 bg-primary/0 transition-colors group-hover:bg-primary/40 group-focus-visible:bg-primary group-active:bg-primary" />
      </div>
    </div>
  )
}
