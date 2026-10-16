import { CONFIGURABLE_TYPES, PUSH_ONLY_CHANNELS, type NotificationType, type PushChannel } from './notification.types'

// Lưu trong users.notification_settings (JSONB), tương thích ngược với v1:
//   { "post_like": false,                       ← in-app (key phẳng, từ v1)
//     "push": { "post_like": true },            ← Web Push theo loại
//     "quiet_hours": { "enabled": true, "start": "23:00", "end": "07:00" } }
export interface QuietHours {
  enabled: boolean
  start: string // HH:mm, giờ Việt Nam
  end: string
}

export interface NotificationSettings {
  inApp: Record<string, boolean>
  push: Record<string, boolean>
  quietHours: QuietHours
}

// Mặc định push: chỉ những gì cần phản hồi (trả lời, nhắc tên, lời giải, bình luận)
export const PUSH_DEFAULTS: Record<PushChannel, boolean> = {
  chat_message: true,
  post_like: false,
  post_comment: true,
  comment_reply: true,
  user_mention: true,
  user_follow: false,
  accepted_solution: true,
  account_verified: true,
  ai_reply: true
}

// Kênh push người dùng bật/tắt được = loại thông báo cấu hình được + kênh chỉ push
const PUSH_CHANNELS: PushChannel[] = [...CONFIGURABLE_TYPES, ...PUSH_ONLY_CHANNELS]
const isPushOnly = (c: PushChannel) => (PUSH_ONLY_CHANNELS as readonly string[]).includes(c)

const DEFAULT_QUIET_HOURS: QuietHours = { enabled: true, start: '23:00', end: '07:00' }
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/

export function resolveSettings(stored: any): NotificationSettings {
  const raw = stored || {}
  const qh = raw.quiet_hours || {}
  return {
    inApp: Object.fromEntries(CONFIGURABLE_TYPES.map((t) => [t, raw[t] !== false])),
    push: Object.fromEntries(PUSH_CHANNELS.map((t) => [t, typeof raw.push?.[t] === 'boolean' ? raw.push[t] : PUSH_DEFAULTS[t]])),
    quietHours: {
      enabled: typeof qh.enabled === 'boolean' ? qh.enabled : DEFAULT_QUIET_HOURS.enabled,
      start: HHMM.test(qh.start) ? qh.start : DEFAULT_QUIET_HOURS.start,
      end: HHMM.test(qh.end) ? qh.end : DEFAULT_QUIET_HOURS.end
    }
  }
}

export function isInAppEnabled(stored: any, type: NotificationType): boolean {
  return stored?.[type] !== false
}

export function isPushEnabled(stored: any, type: PushChannel): boolean {
  if (!isPushOnly(type) && !isInAppEnabled(stored, type as NotificationType)) return false // tắt in-app ⇒ tắt luôn push
  const value = stored?.push?.[type]
  return typeof value === 'boolean' ? value : (PUSH_DEFAULTS[type] ?? false)
}

// Chuyển patch từ API ({ inApp, push, quietHours }) thành JSON lưu trữ; bỏ key/giá trị không hợp lệ
export function buildStoragePatch(patch: any): Record<string, unknown> {
  const out: Record<string, unknown> = {}
  const valid = (k: string) => (CONFIGURABLE_TYPES as string[]).includes(k)
  const validPush = (k: string) => (PUSH_CHANNELS as string[]).includes(k)
  for (const [k, v] of Object.entries(patch?.inApp || {})) if (valid(k) && typeof v === 'boolean') out[k] = v
  const push = Object.fromEntries(Object.entries(patch?.push || {}).filter(([k, v]) => validPush(k) && typeof v === 'boolean'))
  if (Object.keys(push).length) out.push = push
  const qh = patch?.quietHours
  if (qh && typeof qh === 'object') {
    const q: Partial<QuietHours> = {}
    if (typeof qh.enabled === 'boolean') q.enabled = qh.enabled
    if (HHMM.test(qh.start)) q.start = qh.start
    if (HHMM.test(qh.end)) q.end = qh.end
    if (Object.keys(q).length) out.quiet_hours = q
  }
  return out
}

const VN_OFFSET_MS = 7 * 60 * 60 * 1000 // Asia/Ho_Chi_Minh (UTC+7, không có giờ mùa hè)

// Nếu đang trong giờ yên tĩnh ⇒ trả về thời điểm (ms) kết thúc; ngược lại null
export function quietHoursEnd(quiet: QuietHours, now = Date.now()): number | null {
  if (!quiet.enabled || quiet.start === quiet.end) return null
  const toMin = (s: string) => Number(s.slice(0, 2)) * 60 + Number(s.slice(3, 5))
  const local = new Date(now + VN_OFFSET_MS)
  const minutes = local.getUTCHours() * 60 + local.getUTCMinutes()
  const start = toMin(quiet.start)
  const end = toMin(quiet.end)
  const inside = start < end ? minutes >= start && minutes < end : minutes >= start || minutes < end
  if (!inside) return null
  const minutesUntilEnd = (end - minutes + 1440) % 1440
  const endLocal = Math.floor((now + VN_OFFSET_MS) / 60000) * 60000 + minutesUntilEnd * 60000
  return endLocal - VN_OFFSET_MS
}
