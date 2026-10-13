import { USER_EVENTS_MAX_BATCH, type UserEventInput } from '@pu/schemas'
import { useAppStore } from '@/store'
import { API_BASE_URL } from './api-client'

// Ghi hành vi để cá nhân hóa gợi ý: gom theo lô, gửi mỗi 10s hoặc khi rời trang (keepalive)
// Behaviour tracker: batched, flushed every 10s or on page hide; never blocks the UI

const FLUSH_DELAY_MS = 10_000
const FLUSH_SIZE = 20

let queue: UserEventInput[] = []
let timer: ReturnType<typeof setTimeout> | null = null
const seen = new Set<string>() // sự kiện chỉ tính 1 lần / phiên (vd. xem bài)

function enabled(): boolean {
  const user = useAppStore.getState().user
  return !!user && user.privacySettings?.personalization !== false
}

function flush() {
  if (timer) clearTimeout(timer)
  timer = null
  if (!queue.length) return
  const events = queue.slice(0, USER_EVENTS_MAX_BATCH)
  queue = queue.slice(USER_EVENTS_MAX_BATCH)
  // keepalive: vẫn gửi được khi đang đóng tab
  void fetch(`${API_BASE_URL}/events`, {
    method: 'POST',
    credentials: 'include',
    keepalive: true,
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ events })
  }).catch(() => {})
  if (queue.length) schedule()
}

function schedule() {
  if (!timer) timer = setTimeout(flush, FLUSH_DELAY_MS)
}

if (typeof window !== 'undefined') {
  window.addEventListener('pagehide', flush)
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') flush()
  })
}

export function track(event: UserEventInput) {
  if (!enabled()) return
  queue.push(event)
  if (queue.length >= FLUSH_SIZE) flush()
  else schedule()
}

// Chỉ ghi lần đầu trong phiên (theo loại + đối tượng)
export function trackOnce(event: UserEventInput) {
  const key = `${event.type}:${event.targetId ?? ''}`
  if (seen.has(key)) return
  seen.add(key)
  track(event)
}
