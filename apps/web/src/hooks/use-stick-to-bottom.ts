'use client'

import { useCallback, useEffect, useLayoutEffect, useRef, type RefObject } from 'react'

const NEAR_BOTTOM = 160
const GESTURES = ['wheel', 'touchstart', 'keydown', 'mousedown'] as const

const toBottom = (el: HTMLElement) => {
  el.scrollTop = el.scrollHeight
}

const isNearBottom = (el: HTMLElement) => {
  return el.scrollHeight - el.scrollTop - el.clientHeight <= NEAR_BOTTOM
}

// Stick-to-bottom cho danh sách tin nhắn cuộn nội bộ
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
    const el = contentRef.current
    if (el) toBottom(el)
  }, [resetKey, contentRef])

  useEffect(() => {
    const el = contentRef.current
    if (!el) return
    const onGesture = () => {
      touched.current = true
    }
    const onScroll = () => {
      if (touched.current) pinned.current = isNearBottom(el)
      else if (!isNearBottom(el)) toBottom(el)
    }
    // Chiều cao danh sách tin nhắn thay đổi (ảnh load, AI stream text...) ⇒ nếu đang ở đáy thì giữ đáy
    const observer = new ResizeObserver(() => {
      if (pinned.current) toBottom(el)
    })
    observer.observe(el)
    el.addEventListener('scroll', onScroll, { passive: true })
    for (const g of GESTURES) el.addEventListener(g, onGesture, { passive: true })
    return () => {
      observer.disconnect()
      el.removeEventListener('scroll', onScroll)
      for (const g of GESTURES) el.removeEventListener(g, onGesture)
    }
  }, [contentRef, resetKey])

  // Neo lại đáy (vd. mình vừa gửi tin)
  const stick = useCallback(() => {
    pinned.current = true
    const el = contentRef.current
    if (el) toBottom(el)
  }, [contentRef])
  // Chủ động rời đáy (nhảy tới tin cũ)
  const release = useCallback(() => {
    pinned.current = false
    touched.current = true
  }, [])

  return { stick, release }
}
