// Bot Simulator — kiểu dùng chung giữa Admin web và API (chỉ type, không runtime)

export const BOT_SPEEDS = ['slow', 'normal', 'fast'] as const
export type BotSpeed = (typeof BOT_SPEEDS)[number]

export type BotCommandType = 'post' | 'comment' | 'like'
export type BotCommandStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
// AI viết lại nội dung trước khi bot đăng (none = giữ nguyên)
export type BotEnhance = 'none' | 'ai'
export const BOT_ROLES = ['student', 'lecturer', 'ta'] as const
export type BotRole = (typeof BOT_ROLES)[number]

export interface BotSessionStats {
  postsCount: number
  commentsCount: number
  likesCount: number
}

// Quyền & hạn mức riêng từng bot (mặc định mọi quyền tắt)
export interface BotProfile {
  enabled: boolean
  topics: string[]
  canPost: boolean
  canComment: boolean
  canLike: boolean
  // Được tương tác bài của người thật (mặc định chỉ giữa các bot)
  interactHumans: boolean
  maxPostsPerDay: number
  maxCommentsPerDay: number
  maxLikesPerDay: number
}

export interface AdminBotAccount {
  id: string
  username: string
  displayName: string
  role: BotRole
  faculty: string | null
  bio: string
  tone: string
  major: string
  // Linh hồn: tính cách, sở thích, cách viết — AI bám theo khi tự đăng/bình luận
  soul: string
  profile: BotProfile
  usedToday: { post: number; comment: number; like: number }
  lastActionAt: string | null
}

export interface AdminBotTopic {
  slug: string
  label: string
  keywords: string[]
  enabled: boolean
}

export interface AdminBotCommand {
  id: string
  type: BotCommandType
  payload: Record<string, unknown>
  status: BotCommandStatus
  scheduledAt: string
  result: string | null
  createdBy: string | null
  createdAt: string
  finishedAt: string | null
}

// AI dùng để sinh/viết lại nội dung (key nằm ở env, không lưu DB)
export interface AdminBotAi {
  model: string
  baseUrl: string | null
}

export interface AdminBotOverview {
  enabled: boolean
  ai: AdminBotAi
  speed: BotSpeed
  // Daemon có heartbeat trong 30 giây gần nhất
  online: boolean
  heartbeatAt: string | null
  startedAt: string | null
  stats: BotSessionStats | null
  topics: AdminBotTopic[]
  bots: AdminBotAccount[]
  commands: AdminBotCommand[]
}

export interface AdminBotActivity {
  id: string
  botUsername: string | null
  action: string
  details: string
  level: 'info' | 'warn' | 'error'
  createdAt: string
}

export type AdminBotControlInput = {
  enabled?: boolean
  speed?: BotSpeed
  aiModel?: string
  aiBaseUrl?: string | null
}

export type AdminBotProfileInput = Partial<BotProfile>

export type AdminBotTopicInput = { slug: string; label: string; keywords: string[]; enabled: boolean }

// Tạo/sửa tài khoản bot (mật khẩu do hệ thống cấp, không nhập từ UI)
export type AdminBotAccountInput = { username: string; displayName: string; role: BotRole; faculty: string; bio?: string; tone?: string; major?: string; soul?: string }
export type AdminBotAccountUpdate = Partial<Omit<AdminBotAccountInput, 'username'>>

// Hành động giao cho bot. scheduledAt: ISO, bỏ trống/quá khứ ⇒ chạy ngay.
// post: content (viết tay/Excel) | không có gì ⇒ AI tự sinh theo soul + chủ đề của bot
export type AdminBotCommandInput =
  | { type: 'post'; bot?: string; topic?: string; title?: string; content?: string; enhance?: BotEnhance; scheduledAt?: string }
  | { type: 'comment'; postId: string; bot?: string; content?: string; enhance?: BotEnhance; scheduledAt?: string }
  | { type: 'like'; postId: string; bot: string; scheduledAt?: string }

export interface BotRecentPost {
  id: string
  title: string
  snippet: string
  likesCount: number
  commentsCount: number
  createdAt: string
  authorName: string
  authorUsername: string
  authorIsBot: boolean
}

export interface BotGenerateContentInput {
  bot: string
  type: 'post' | 'comment'
  prompt?: string
  postId?: string
}

export interface BotGenerateContentResult {
  title?: string
  content: string
  tags?: string[]
}

// ── Import Excel/CSV thành lịch đăng của bot ─────────────────────────────

// Cột chuẩn của file import (tool crawl hoặc Excel tự soạn đều phải ra các cột này)
export const BOT_IMPORT_FIELDS = ['content', 'key', 'title', 'images', 'topic', 'bot', 'scheduledAt', 'enhance'] as const
export type BotImportField = (typeof BOT_IMPORT_FIELDS)[number]

// Một dòng đã chuẩn hóa = một bài hẹn giờ. Có giờ ⇒ đăng đúng giờ; không giờ ⇒ giãn cách. Không bot ⇒ hệ thống chia đều cho bot được phép đăng (đúng chủ đề nếu có).
export interface BotImportRow {
  content: string
  key?: string
  title?: string
  images?: string[]
  topic?: string
  bot?: string
  // ISO 8601; quá khứ ⇒ đăng ngay
  scheduledAt?: string
  enhance?: BotEnhance
}

export type BotImportRowStatus = 'ok' | 'duplicate' | 'invalid'

export interface BotImportRowResult {
  index: number
  status: BotImportRowStatus
  reason?: string
  // Cảnh báo không chặn (vd ảnh tải lỗi nên bỏ ảnh)
  warning?: string
  // Dòng sẽ được xử lý thế nào nếu hợp lệ
  plan?: 'now' | 'scheduled'
  // Bot được giao (tự chia khi dòng không ghi bot)
  bot?: string
}

export interface BotImportResult {
  dryRun: boolean
  summary: Record<BotImportRowStatus, number>
  rows: BotImportRowResult[]
}

export interface BotImportInput {
  rows: Record<string, unknown>[]
  dryRun: boolean
  // Phút giữa các bài không có giờ hẹn
  spacingMinutes?: number
}

// AI đoán cột nào của file ứng với trường chuẩn (header lạ/khác ngôn ngữ)
export interface BotImportMapRequest {
  headers: string[]
  sample: string[][]
}
export type BotImportMapping = Partial<Record<BotImportField, string>>
