'use client'

import { useCallback, useEffect, useRef } from 'react'

const PREFIX = 'pu:draft:'
const SAVE_DELAY_MS = 400

const read = (key: string) => {
  try {
    return localStorage.getItem(PREFIX + key)
  } catch {
    return null
  }
}

const write = (key: string, value: string) => {
  try {
    if (value.trim()) localStorage.setItem(PREFIX + key, value)
    else localStorage.removeItem(PREFIX + key)
  } catch {
    // Trình duyệt chặn storage ⇒ bỏ qua (nháp chỉ là tiện ích)
  }
}

// Lưu nháp trên trình duyệt: khôi phục sau mount (tránh lệch SSR), ghi trễ, xoá khi gửi
export function useDraft(key: string | undefined, value: string, restore: (draft: string) => void) {
  const restored = useRef(false)
  const latest = useRef(value)
  const discarded = useRef(false)
  latest.current = value
  if (value.trim()) discarded.current = false

  useEffect(() => {
    if (!key || restored.current) return
    restored.current = true
    const draft = read(key)
    if (draft) restore(draft)
  }, [key, restore])

  useEffect(() => {
    if (!key || !restored.current) return
    const t = setTimeout(() => write(key, value), SAVE_DELAY_MS)
    return () => clearTimeout(t)
  }, [key, value])

  // Đóng ô nhập trước khi kịp ghi ⇒ lưu nốt
  useEffect(() => {
    if (!key) return
    return () => {
      if (restored.current && !discarded.current) write(key, latest.current)
    }
  }, [key])

  // Xoá nháp (đã gửi / huỷ)
  return useCallback(() => {
    discarded.current = true
    if (key) write(key, '')
  }, [key])
}
