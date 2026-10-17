import { useEffect, useState } from 'react'

// Debounce giá trị (ô tìm kiếm) — tránh gọi API mỗi phím gõ
export function useDebounced<T>(value: T, delay = 300): T {
  const [v, setV] = useState(value)
  useEffect(() => {
    const t = setTimeout(() => setV(value), delay)
    return () => clearTimeout(t)
  }, [value, delay])
  return v
}
