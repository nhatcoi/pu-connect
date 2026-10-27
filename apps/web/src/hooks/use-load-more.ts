'use client'

import { useEffect, useRef } from 'react'

// Tải thêm khi phần tử mốc (cuối danh sách) sắp vào khung nhìn
export function useLoadMore(enabled: boolean, load: () => void) {
  const ref = useRef<HTMLDivElement>(null)
  useEffect(() => {
    const el = ref.current
    if (!el || !enabled) return
    const observer = new IntersectionObserver((e) => e[0].isIntersecting && load(), { rootMargin: '300px' })
    observer.observe(el)
    return () => observer.disconnect()
  }, [enabled, load])
  return ref
}
