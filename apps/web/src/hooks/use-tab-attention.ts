'use client'

import { useEffect, useRef } from 'react'

const FLASH_MS = 1200
const FLASH_TEXT = '💬 Có tin mới'
const BADGE_RE = /^\((\d+\+?)\)\s+/

const badgeText = (n: number) => (n > 99 ? '99+' : String(n))

function iconLink(): HTMLLinkElement | null {
  return document.querySelector<HTMLLinkElement>('link[rel~="icon"]')
}

// Vẽ favicon hiện tại kèm chấm đỏ góc phải trên; lỗi (tải ảnh / canvas) ⇒ null
async function badgedFavicon(href: string): Promise<string | null> {
  try {
    const img = new Image()
    img.src = href
    await img.decode()
    const size = 64
    const canvas = document.createElement('canvas')
    canvas.width = canvas.height = size
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    ctx.drawImage(img, 0, 0, size, size)
    ctx.beginPath()
    ctx.arc(size - 17, 17, 16, 0, Math.PI * 2)
    ctx.fillStyle = '#ef4444'
    ctx.fill()
    ctx.lineWidth = 4
    ctx.strokeStyle = '#ffffff'
    ctx.stroke()
    return canvas.toDataURL('image/png')
  } catch {
    return null
  }
}

// Tab trình duyệt báo có tin: tiêu đề "(3) PU Connector…", favicon có chấm đỏ, nhấp nháy "💬 Có tin mới" khi tab ẩn mà có tin mới
// Tiêu đề do Next đổi theo trang ⇒ theo dõi <title> để giữ tiền tố; hết chưa đọc ⇒ trả lại nguyên trạng
export function useTabAttention(unread: number) {
  const base = useRef<string>('')
  const applying = useRef(false)
  const prevUnread = useRef(0)
  const flashTimer = useRef<ReturnType<typeof setInterval> | null>(null)
  const original = useRef<{ link: HTMLLinkElement; href: string } | null>(null)
  const unreadRef = useRef(unread)
  unreadRef.current = unread

  const setTitle = (title: string) => {
    applying.current = true
    document.title = title
    // MutationObserver chạy bất đồng bộ ⇒ hạ cờ sau microtask
    queueMicrotask(() => setTimeout(() => (applying.current = false), 0))
  }
  const labelled = () => (unreadRef.current > 0 ? `(${badgeText(unreadRef.current)}) ${base.current}` : base.current)

  // Giữ tiêu đề gốc theo trang
  useEffect(() => {
    base.current = document.title.replace(BADGE_RE, '')
    const el = document.querySelector('title')
    if (!el) return
    const observer = new MutationObserver(() => {
      if (applying.current) return
      base.current = document.title.replace(BADGE_RE, '')
      if (!flashTimer.current && unreadRef.current > 0) setTitle(labelled())
    })
    observer.observe(el, { childList: true, characterData: true, subtree: true })
    return () => {
      observer.disconnect()
      setTitle(base.current)
    }
  }, [])

  // Số chưa đọc đổi ⇒ cập nhật tiêu đề + favicon; tăng khi tab ẩn ⇒ nhấp nháy
  useEffect(() => {
    if (!base.current) base.current = document.title.replace(BADGE_RE, '')
    if (!flashTimer.current) setTitle(labelled())

    const link = iconLink()
    if (link && !original.current) original.current = { link, href: link.href }
    if (original.current) {
      const { link: l, href } = original.current
      if (unread > 0) void badgedFavicon(href).then((url) => url && unreadRef.current > 0 && (l.href = url))
      else l.href = href
    }

    const stopFlash = () => {
      if (flashTimer.current) clearInterval(flashTimer.current)
      flashTimer.current = null
      setTitle(labelled())
    }
    if (unread > prevUnread.current && document.visibilityState === 'hidden' && !flashTimer.current) {
      let alt = true
      flashTimer.current = setInterval(() => {
        setTitle(alt ? FLASH_TEXT : labelled())
        alt = !alt
      }, FLASH_MS)
    }
    if (unread === 0) stopFlash()
    prevUnread.current = unread

    const onVisible = () => document.visibilityState === 'visible' && stopFlash()
    document.addEventListener('visibilitychange', onVisible)
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [unread])

  useEffect(
    () => () => {
      if (flashTimer.current) clearInterval(flashTimer.current)
      if (original.current) original.current.link.href = original.current.href
    },
    []
  )
}
