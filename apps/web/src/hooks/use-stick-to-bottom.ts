'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const NEAR_BOTTOM = 240
const GESTURES = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const

const toBottom = () => window.scrollTo({ top: document.documentElement.scrollHeight, behavior: 'instant' })
const isNearBottom = () => window.innerHeight + window.scrollY >= document.documentElement.scrollHeight - NEAR_BOTTOM

// Stick-to-bottom for window-scrolled chat threads
// Mở hội thoại ⇒ đứng ngay tin mới nhất từ frame đầu (không lộ cảnh cuộn từ trên xuống);
// nội dung cao dần (ảnh, markdown, AI đang trả lời, gợi ý) vẫn giữ ở đáy; người dùng tự cuộn lên ⇒ thả neo
export function useStickToBottom(contentRef: RefObject<HTMLElement | null>, resetKey: string | undefined) {
  const pinned = useRef(true)
  // Chưa có thao tác cuộn của người dùng ⇒ mọi cú cuộn rời đáy là do router / khôi phục cuộn ⇒ kéo về đáy
  const touched = useRef(false)

  // Trước khi vẽ: đặt ở đáy ngay lần đầu có tin (và khi đổi hội thoại)
  useLayoutEffect(() => {
    pinned.current = true
    touched.current = false
    toBottom()
  }, [resetKey])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onGesture = () => {
      touched.current = true
    }
    const onScroll = () => {
      if (touched.current) pinned.current = isNearBottom()
      else if (!isNearBottom()) toBottom()
    }
    // Cha gồm cả đầu trang / tin ghim / ô soạn ⇒ chúng đổi cao cũng giữ đáy
    const observer = new ResizeObserver(() => {
      if (pinned.current) toBottom()
    })
    observer.observe(el)
    if (el.parentElement) observer.observe(el.parentElement)
    window.addEventListener('scroll', onScroll, { passive: true })
    for (const g of GESTURES) window.addEventListener(g, onGesture, { passive: true })
    return () => {
      observer.disconnect()
      window.removeEventListener('scroll', onScroll)
      for (const g of GESTURES) window.removeEventListener(g, onGesture)
    }
  }, [contentRef, resetKey])

  // Neo lại đáy (vd. mình vừa gửi tin)
  const stick = useCallback(() => {
    pinned.current = true
    toBottom()
  }, [])
  // Chủ động rời đáy (nhảy tới tin cũ)
  const release = useCallback(() => {
    pinned.current = false
    touched.current = true
  }, [])

  return { stick, release }
}
