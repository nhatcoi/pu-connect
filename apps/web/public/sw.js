/* PU Connector — Service Worker cho Web Push
 * Nhận push (kể cả khi đã đóng tab) → hiện thông báo hệ điều hành → bấm để mở đúng trang.
 * Payload từ API: { title, body, url, tag, notificationId, type, unreadCount }
 */

self.addEventListener('install', () => self.skipWaiting())
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()))

self.addEventListener('push', (event) => {
  let data = {}
  try {
    data = event.data ? event.data.json() : {}
  } catch {
    data = { title: 'PU Connector', body: event.data ? event.data.text() : '' }
  }

  const title = data.title || 'PU Connector'
  const options = {
    body: data.body || '',
    icon: '/apple-icon',
    badge: '/icon',
    tag: data.tag || data.notificationId || 'pu-connector',
    renotify: Boolean(data.tag), // thông báo gộp cùng tag: thay thế nhưng vẫn rung/báo lại
    data: { url: data.url || '/notifications', notificationId: data.notificationId },
    timestamp: Date.now()
  }

  event.waitUntil(
    Promise.all([
      self.registration.showNotification(title, options),
      // Badge số chưa đọc trên icon app (PWA, nếu trình duyệt hỗ trợ)
      typeof data.unreadCount === 'number' && 'setAppBadge' in self.navigator
        ? self.navigator.setAppBadge(data.unreadCount).catch(() => undefined)
        : Promise.resolve()
    ])
  )
})

// Bấm thông báo: focus tab PU Connector đang mở rồi điều hướng, không có thì mở tab mới
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL(event.notification.data?.url || '/notifications', self.location.origin).href

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clients) => {
      const sameOrigin = clients.find((c) => new URL(c.url).origin === self.location.origin)
      if (sameOrigin) {
        return sameOrigin.focus().then((client) => (client.navigate ? client.navigate(target) : undefined))
      }
      return self.clients.openWindow(target)
    })
  )
})

// Trình duyệt tự đổi subscription (hết hạn) ⇒ đăng ký lại và báo server
self.addEventListener('pushsubscriptionchange', (event) => {
  event.waitUntil(
    (async () => {
      const res = await fetch('/api/push/config', { credentials: 'include' })
      const { data } = await res.json()
      if (!data?.enabled || !data.publicKey) return
      const padding = '='.repeat((4 - (data.publicKey.length % 4)) % 4)
      const raw = atob((data.publicKey + padding).replace(/-/g, '+').replace(/_/g, '/'))
      const key = Uint8Array.from(raw, (c) => c.charCodeAt(0))
      const sub = await self.registration.pushManager.subscribe({ userVisibleOnly: true, applicationServerKey: key })
      await fetch('/api/push/subscriptions', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sub.toJSON())
      })
    })().catch(() => undefined)
  )
})
