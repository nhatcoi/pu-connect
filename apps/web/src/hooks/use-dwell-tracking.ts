'use client'

import { useEffect, type RefObject } from 'react'
import type { UserEventInput } from '@pu/schemas'
import { trackOnce } from '@/lib/track'

const DWELL_MS = 2000

// Phần tử hiện ≥ 50% (bài dài: chiếm ≥ 40% màn hình) liên tục ≥ 2s ⇒ ghi sự kiện (1 lần / phiên)
// Fires once per session when the element stays mostly visible for 2s
export function useDwellTracking(ref: RefObject<Element | null>, event: UserEventInput | null) {
  const type = event?.type
  const targetType = event?.targetType
  const targetId = event?.targetId
  useEffect(() => {
    const el = ref.current
    if (!el || !type) return
    let timer: ReturnType<typeof setTimeout> | null = null
    const observer = new IntersectionObserver(
      ([entry]) => {
        const visible = entry.intersectionRatio >= 0.5 || entry.intersectionRect.height >= window.innerHeight * 0.4
        if (visible) {
          timer ??= setTimeout(() => {
            trackOnce({ type, targetType, targetId })
            observer.disconnect()
          }, DWELL_MS)
        } else if (timer) {
          clearTimeout(timer)
          timer = null
        }
      },
      { threshold: [0, 0.25, 0.5, 0.75] }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (timer) clearTimeout(timer)
    }
  }, [ref, type, targetType, targetId])
}
