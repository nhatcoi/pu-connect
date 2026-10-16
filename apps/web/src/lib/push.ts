import { apiClient } from '@/lib/api-client'

// Web Push phía trình duyệt: đăng ký service worker, xin quyền, gửi subscription lên API
export type PushStatus =
  | 'unsupported' // trình duyệt không hỗ trợ (hoặc iOS chưa "Thêm vào Màn hình chính")
  | 'server-disabled' // máy chủ chưa cấu hình VAPID
  | 'denied' // người dùng đã chặn quyền thông báo
  | 'enabled'
  | 'disabled'

const SW_URL = '/sw.js'

export function isPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

// iOS chỉ hỗ trợ Web Push khi web đã được thêm vào Màn hình chính (chạy standalone)
export function isIosNeedingInstall(): boolean {
  if (typeof window === 'undefined') return false
  const ios = /iPad|iPhone|iPod/.test(navigator.userAgent)
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches || (navigator as Navigator & { standalone?: boolean }).standalone
  return ios && !standalone
}

function urlBase64ToUint8Array(base64: string): Uint8Array {
  const padding = '='.repeat((4 - (base64.length % 4)) % 4)
  const raw = atob((base64 + padding).replace(/-/g, '+').replace(/_/g, '/'))
  return Uint8Array.from(raw, (c) => c.charCodeAt(0))
}

async function getConfig(): Promise<{ enabled: boolean; publicKey: string | null }> {
  const res = await apiClient<{ data: { enabled: boolean; publicKey: string | null } }>('/push/config')
  return res.data
}

async function getRegistration(): Promise<ServiceWorkerRegistration> {
  return (await navigator.serviceWorker.getRegistration(SW_URL)) || navigator.serviceWorker.register(SW_URL)
}

export async function getPushStatus(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'
  const config = await getConfig().catch(() => ({ enabled: false, publicKey: null }))
  if (!config.enabled) return 'server-disabled'
  if (Notification.permission === 'denied') return 'denied'
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = await reg?.pushManager.getSubscription()
  return sub && Notification.permission === 'granted' ? 'enabled' : 'disabled'
}

// Gọi từ thao tác của người dùng (bấm nút) — trình duyệt chặn xin quyền tự động
export async function enablePush(): Promise<PushStatus> {
  if (!isPushSupported()) return 'unsupported'
  const config = await getConfig()
  if (!config.enabled || !config.publicKey) return 'server-disabled'

  const permission = await Notification.requestPermission()
  if (permission !== 'granted') return permission === 'denied' ? 'denied' : 'disabled'

  const reg = await getRegistration()
  await navigator.serviceWorker.ready
  const existing = await reg.pushManager.getSubscription()
  const sub =
    existing ||
    (await reg.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(config.publicKey) as BufferSource
    }))

  await apiClient('/push/subscriptions', { method: 'POST', body: JSON.stringify(sub.toJSON()) })
  return 'enabled'
}

export async function disablePush(): Promise<void> {
  if (!isPushSupported()) return
  const reg = await navigator.serviceWorker.getRegistration(SW_URL)
  const sub = await reg?.pushManager.getSubscription()
  if (!sub) return
  await apiClient('/push/subscriptions', {
    method: 'DELETE',
    body: JSON.stringify({ endpoint: sub.endpoint })
  }).catch(() => undefined)
  await sub.unsubscribe().catch(() => undefined)
}

export async function sendTestPush(): Promise<{ sent: number; removed: number; failed: number }> {
  const res = await apiClient<{ data: { sent: number; removed: number; failed: number } }>('/push/test', {
    method: 'POST'
  })
  return res.data
}
