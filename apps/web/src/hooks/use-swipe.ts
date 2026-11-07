'use client'

import { useEffect, useRef } from 'react'

const IGNORE = 'a[href],input,textarea,select,video,audio,pre,table,[data-no-swipe],.overflow-x-auto'
const haptic = () => {
  try {
    navigator.vibrate?.(8)
  } catch {
    /* thiết bị không hỗ trợ rung */
  }
}

/**
 * Vuốt tin nhắn sang phải để trả lời (cảm ứng): hàng trượt theo ngón tay có lực cản, icon trả lời hiện dần,
 * thả khi đủ ngưỡng thì gọi onReply (kèm rung nhẹ). Cuộn dọc và cuộn ngang trong tin (bảng, code) không bị cản.
 * Phần tử cần `position: relative`, bên trong có `[data-swipe-icon]` đặt tuyệt đối ở mép trái.
 */
export function useSwipeToReply<T extends HTMLElement>(onReply: () => void, enabled: boolean) {
  const ref = useRef<T>(null)
  const cb = useRef(onReply)
  cb.current = onReply

  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const icon = el.querySelector<HTMLElement>('[data-swipe-icon]')
    const THRESHOLD = 64
    let x0 = 0
    let y0 = 0
    let dx = 0
    let mode: 'idle' | 'track' | 'h' | 'v' = 'idle'
    let armed = false

    const paint = (x: number, animate: boolean) => {
      el.style.transition = animate ? 'transform 180ms cubic-bezier(0.2,0.8,0.2,1)' : 'none'
      el.style.transform = x ? `translate3d(${x}px,0,0)` : ''
      if (icon) {
        const p = Math.min(1, x / THRESHOLD)
        icon.style.opacity = String(p)
        icon.style.transform = `translateY(-50%) scale(${0.6 + 0.4 * p})`
      }
    }

    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      if (e.touches.length !== 1 || t.clientX < 28) return // mép trái: dành cho cử chỉ quay lại của hệ thống
      if ((e.target as Element | null)?.closest(IGNORE)) return
      x0 = t.clientX
      y0 = t.clientY
      dx = 0
      armed = false
      mode = 'track'
    }
    const move = (e: TouchEvent) => {
      if (mode === 'idle' || mode === 'v') return
      const t = e.touches[0]
      const mx = t.clientX - x0
      const my = t.clientY - y0
      if (mode === 'track') {
        if (Math.abs(mx) < 8 && Math.abs(my) < 8) return
        mode = mx > 0 && Math.abs(mx) > Math.abs(my) * 1.6 ? 'h' : 'v'
        if (mode === 'v') return
      }
      if (e.cancelable) e.preventDefault()
      dx = Math.max(0, mx)
      const shown = dx < THRESHOLD ? dx : THRESHOLD + (dx - THRESHOLD) * 0.2 // lực cản sau ngưỡng
      paint(Math.min(shown, 96), false)
      if (!armed && dx >= THRESHOLD) {
        armed = true
        haptic()
      } else if (armed && dx < THRESHOLD) armed = false
    }
    const end = () => {
      if (mode === 'h') {
        paint(0, true)
        if (armed) cb.current()
      }
      mode = 'idle'
      armed = false
    }

    el.addEventListener('touchstart', start, { passive: true })
    el.addEventListener('touchmove', move, { passive: false })
    el.addEventListener('touchend', end, { passive: true })
    el.addEventListener('touchcancel', end, { passive: true })
    return () => {
      el.removeEventListener('touchstart', start)
      el.removeEventListener('touchmove', move)
      el.removeEventListener('touchend', end)
      el.removeEventListener('touchcancel', end)
      el.style.transform = ''
    }
  }, [enabled])

  return ref
}

/** Vuốt từ mép trái màn hình sang phải ⇒ onOpen (mở ngăn kéo). Chỉ cảm ứng, màn nhỏ. */
export function useEdgeSwipeOpen(onOpen: () => void, enabled: boolean) {
  const cb = useRef(onOpen)
  cb.current = onOpen
  useEffect(() => {
    if (!enabled) return
    let x0 = 0
    let y0 = 0
    let live = false
    const start = (e: TouchEvent) => {
      const t = e.touches[0]
      live = e.touches.length === 1 && t.clientX <= 48 && window.innerWidth < 768 && !(e.target as Element | null)?.closest('[data-no-swipe],[role=dialog]')
      x0 = t.clientX
      y0 = t.clientY
    }
    const move = (e: TouchEvent) => {
      if (!live) return
      const t = e.touches[0]
      const dx = t.clientX - x0
      const dy = Math.abs(t.clientY - y0)
      if (dx > 56 && dx > dy * 1.6) {
        live = false
        haptic()
        cb.current()
      } else if (dy > 24 && dy > dx) live = false
    }
    const stop = () => {
      live = false
    }
    document.addEventListener('touchstart', start, { passive: true })
    document.addEventListener('touchmove', move, { passive: true })
    document.addEventListener('touchend', stop, { passive: true })
    document.addEventListener('touchcancel', stop, { passive: true })
    return () => {
      document.removeEventListener('touchstart', start)
      document.removeEventListener('touchmove', move)
      document.removeEventListener('touchend', stop)
      document.removeEventListener('touchcancel', stop)
    }
  }, [enabled])
}
