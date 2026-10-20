import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs))
}

export const WEB_PORTAL_URL = (import.meta as { env?: Record<string, string> }).env?.VITE_WEB_URL || 'https://puc.vnhat.dev'
const API_BASE = (import.meta as { env?: Record<string, string> }).env?.VITE_API_URL || '/api'

// URL tuyệt đối tới API (link tải file, cookie đi kèm)
export const apiUrl = (path: string) => `${API_BASE}${path}`

type Envelope<T> = {
  success?: boolean
  data: T
  message?: string | string[]
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const headers = new Headers(init.headers)
  if (init.body && !headers.has('Content-Type')) {
    headers.set('Content-Type', 'application/json')
  }
  const res = await fetch(`${API_BASE}${path}`, {
    ...init,
    headers,
    credentials: 'include'
  })

  if (res.status === 204) return undefined as T
  const json = (await res.json().catch(() => ({}))) as Envelope<T> & { error?: string }

  if (!res.ok) {
    const msg = Array.isArray(json.message) ? json.message[0] : json.message || json.error || `Lỗi HTTP ${res.status}`
    const err = new Error(msg) as Error & { status?: number }
    err.status = res.status
    throw err
  }

  return (json && typeof json === 'object' && 'data' in json ? json.data : (json as unknown as T))
}

export const adminApi = {
  get: <T>(path: string) => request<T>(path, { method: 'GET' }),
  post: <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  patch: <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  put: <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'PUT', body: JSON.stringify(body) }),
  delete: <T>(path: string, body: unknown = {}) => request<T>(path, { method: 'DELETE', body: JSON.stringify(body) })
}

export function formatRelativeTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const diffSec = Math.floor((Date.now() - new Date(iso).getTime()) / 1000)
  if (diffSec < 60) return 'Vừa xong'
  const diffMin = Math.floor(diffSec / 60)
  if (diffMin < 60) return `${diffMin} phút trước`
  const diffHour = Math.floor(diffMin / 60)
  if (diffHour < 24) return `${diffHour} giờ trước`
  const diffDay = Math.floor(diffHour / 24)
  if (diffDay < 30) return `${diffDay} ngày trước`
  return new Date(iso).toLocaleDateString('vi-VN')
}

export function formatBytes(bytes: number | null | undefined): string {
  if (!bytes || bytes <= 0) return '0 B'
  const units = ['B', 'KB', 'MB', 'GB']
  const i = Math.min(units.length - 1, Math.floor(Math.log(bytes) / Math.log(1024)))
  return `${(bytes / Math.pow(1024, i)).toFixed(i === 0 ? 0 : 1)} ${units[i]}`
}

export function markdownToPlainText(md: string | null | undefined): string {
  if (!md) return ''
  return md
    .replace(/```[\s\S]*?```/g, ' [code] ')
    .replace(/\$\$([\s\S]*?)\$\$/g, '$1')
    .replace(/!\[([^\]]*)\]\([^)]*\)/g, '$1')
    .replace(/\[([^\]]+)\]\([^)]*\)/g, '$1')
    .replace(/<[^>]+>/g, '')
    .replace(/^\s{0,3}(#{1,6}|>+|[-*+]|\d+[.)])\s+/gm, '')
    .replace(/(\*\*|__|~~)(.+?)\1/g, '$2')
    .replace(/`([^`]+)`/g, '$1')
    .replace(/\$([^$\n]+)\$/g, '$1')
    .replace(/\s+/g, ' ')
    .trim()
}

// Nhãn vai trò ngắn gọn cho UI (nhãn đầy đủ nằm ở ADMIN_ROLE_LABELS)
export const ROLE_SHORT: Record<string, string> = {
  admin: 'Quản trị viên',
  lecturer: 'Giảng viên',
  ta: 'Trợ giảng',
  club_lead: 'Chủ nhiệm CLB',
  student: 'Sinh viên'
}

export function formatNumber(n: number | null | undefined): string {
  return (n ?? 0).toLocaleString('vi-VN')
}

// Số gọn: 12.400 → 12,4K
export function formatCompact(n: number | null | undefined): string {
  return new Intl.NumberFormat('vi-VN', { notation: 'compact', maximumFractionDigits: 1 }).format(n ?? 0)
}
