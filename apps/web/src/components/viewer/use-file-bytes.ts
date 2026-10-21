'use client'

import { useQuery } from '@tanstack/react-query'
import { API_BASE_URL } from '@/lib/api-client'

const R2_HOST = (() => {
  try {
    return process.env.NEXT_PUBLIC_R2_URL ? new URL(process.env.NEXT_PUBLIC_R2_URL).host : ''
  } catch {
    return ''
  }
})()

// R2 public không bật CORS ⇒ tệp của mình đọc byte qua API (`/upload/read`); URL khác dùng nguyên
export function fileSourceUrl(url: string): string {
  try {
    const { host, pathname } = new URL(url)
    if (R2_HOST && host === R2_HOST) return `${API_BASE_URL}/upload/read?key=${encodeURIComponent(decodeURIComponent(pathname.slice(1)))}`
  } catch {
    // URL tương đối / không hợp lệ ⇒ dùng nguyên
  }
  return url
}

async function fetchBuffer(url: string): Promise<ArrayBuffer> {
  const res = await fetch(fileSourceUrl(url), { credentials: 'include' })
  if (!res.ok) throw new Error(res.status === 404 ? 'Tệp không còn tồn tại' : 'Không tải được tệp')
  return res.arrayBuffer()
}

// Byte của tệp, cache theo URL (mở lại cùng tệp không tải lại)
export function useFileBytes(url: string) {
  return useQuery({ queryKey: ['file-bytes', url], queryFn: () => fetchBuffer(url), staleTime: Infinity, gcTime: 5 * 60_000, retry: false })
}

const MAX_TEXT_BYTES = 1_000_000

// Nội dung chữ của tệp (cắt ở 1 MB để không treo trình duyệt)
export function useFileText(url: string) {
  return useQuery({
    queryKey: ['file-text', url],
    queryFn: async () => {
      const buffer = await fetchBuffer(url)
      const truncated = buffer.byteLength > MAX_TEXT_BYTES
      const text = new TextDecoder().decode(truncated ? buffer.slice(0, MAX_TEXT_BYTES) : buffer)
      return { text, truncated }
    },
    staleTime: Infinity,
    gcTime: 5 * 60_000,
    retry: false
  })
}
