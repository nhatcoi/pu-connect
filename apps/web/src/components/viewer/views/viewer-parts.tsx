'use client'

import React from 'react'
import { AlertCircle, Loader2, Minus, Plus } from 'lucide-react'
import { cn } from '@/lib/utils'

// Trạng thái chung của mọi trình xem: đang tải / lỗi
export function ViewerLoading({ label = 'Đang mở tài liệu…' }: { label?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 text-muted-foreground">
      <Loader2 className="h-5 w-5 animate-spin text-primary" />
      <p className="text-xs">{label}</p>
    </div>
  )
}

export function ViewerError({ message = 'Không mở được tài liệu này' }: { message?: string }) {
  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-2 px-6 text-center text-muted-foreground">
      <AlertCircle className="h-6 w-6 opacity-50" />
      <p className="text-sm">{message}</p>
      <p className="text-xs">Bạn vẫn có thể tải về để mở bằng ứng dụng khác.</p>
    </div>
  )
}

// Vùng xem có nền "bàn học": nội dung cuộn bên trong, thanh công cụ nổi (bar) đứng yên ở đáy
export function Stage({
  scrollRef,
  bar,
  className,
  children
}: {
  scrollRef?: React.Ref<HTMLDivElement>
  bar?: React.ReactNode
  className?: string
  children: React.ReactNode
}) {
  return (
    <div className="relative h-full w-full bg-muted/50">
      <div ref={scrollRef} className={cn('h-full w-full overflow-auto', className)}>
        {children}
      </div>
      {bar}
    </div>
  )
}

// Thanh công cụ nổi cuối vùng xem (zoom, trang…)
export function FloatingBar({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <div className="pointer-events-none absolute inset-x-0 bottom-4 z-10 flex justify-center">
      <div className={cn('pointer-events-auto flex items-center gap-0.5 rounded-full bg-card/95 p-1 shadow-lg ring-1 ring-border backdrop-blur', className)}>
        {children}
      </div>
    </div>
  )
}

export const barButton =
  'flex h-8 w-8 cursor-pointer items-center justify-center rounded-full text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:pointer-events-none disabled:opacity-40'

export function ZoomControls({ zoom, min, max, step, onChange }: { zoom: number; min: number; max: number; step: number; onChange: (zoom: number) => void }) {
  return (
    <>
      <button type="button" className={barButton} disabled={zoom <= min} onClick={() => onChange(Math.max(min, zoom - step))} aria-label="Thu nhỏ">
        <Minus className="h-4 w-4" />
      </button>
      <button
        type="button"
        onClick={() => onChange(1)}
        title="Vừa chiều rộng"
        className="min-w-11 cursor-pointer rounded-full px-1 text-center text-xs font-medium tabular-nums text-muted-foreground hover:text-foreground"
      >
        {Math.round(zoom * 100)}%
      </button>
      <button type="button" className={barButton} disabled={zoom >= max} onClick={() => onChange(Math.min(max, zoom + step))} aria-label="Phóng to">
        <Plus className="h-4 w-4" />
      </button>
    </>
  )
}

// Chiều rộng khung chứa (ResizeObserver, gom lại để kéo panel không vẽ lại liên tục); trả [rộng, ref callback, phần tử]
// Dùng ref callback vì khung có thể xuất hiện muộn (sau khi tải xong tài liệu)
export function useElementWidth(delay = 120): [number, (el: HTMLElement | null) => void, HTMLElement | null] {
  const [el, setEl] = React.useState<HTMLElement | null>(null)
  const [width, setWidth] = React.useState(0)
  React.useEffect(() => {
    if (!el) return
    let timer: ReturnType<typeof setTimeout> | undefined
    let first = true
    const observer = new ResizeObserver(([entry]) => {
      clearTimeout(timer)
      const next = Math.floor(entry.contentRect.width)
      timer = setTimeout(() => setWidth(next), first ? 0 : delay)
      first = false
    })
    observer.observe(el)
    return () => {
      observer.disconnect()
      clearTimeout(timer)
    }
  }, [el, delay])
  return [width, setEl, el]
}

// Hệ số thu nhỏ để nội dung có bề rộng cố định (trang Word, slide…) vừa khung; đo 1 lần khi nội dung sẵn sàng
export function useFitToWidth(host: React.RefObject<HTMLElement | null>, stageWidth: number, ready: boolean, gutter = 32): number {
  const [natural, setNatural] = React.useState(0)
  React.useEffect(() => {
    const el = host.current
    if (!ready || !el) return
    const previous = el.style.zoom
    el.style.zoom = '1'
    setNatural(el.scrollWidth)
    el.style.zoom = previous
  }, [host, ready])
  return natural && stageWidth ? Math.min(1, (stageWidth - gutter) / natural) : 1
}
