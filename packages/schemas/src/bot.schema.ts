// Bot Simulator — kiểu dùng chung giữa Admin web và API (chỉ type, không runtime)

export const BOT_SPEEDS = ['slow', 'normal', 'fast'] as const
export type BotSpeed = (typeof BOT_SPEEDS)[number]

export type BotCommandType = 'post' | 'comment' | 'like'
export type BotCommandStatus = 'pending' | 'running' | 'done' | 'failed' | 'cancelled'
export type BotFeedStatus = 'new' | 'review' | 'approved' | 'rejected' | 'scheduled' | 'posted' | 'skipped'
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
  // Đăng bài từ dữ liệu crawl (thay phiên với bot khác cùng bật)
  feedPoster: boolean
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

export interface AdminBotFeedStats {
  byStatus: Record<BotFeedStatus, number>
  posted24h: number
  lastPostedAt: string | null
}

export interface AdminBotFeedItem {
  id: string
  status: BotFeedStatus
  topic: string | null
  content: string
  rawContent: string | null
  imageCount: number
  // Lý do/ghi chú của AI duyệt
  verdict: { reason?: string; model?: string } | null
  postedBy: string | null
  createdAt: string
  postedAt: string | null
}

// AI dùng để duyệt/viết lại dữ liệu crawl và sinh nội dung (key nằm ở env, không lưu DB)
export interface AdminBotAi {
  model: string
  baseUrl: string | null
}

export interface AdminBotOverview {
  enabled: boolean
  // Đăng bài từ dữ liệu crawl
  feedEnabled: boolean
  // Bài AI đã duyệt vẫn chờ admin bấm Duyệt trước khi đăng
  feedReview: boolean
  feed: AdminBotFeedStats
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
  feedEnabled?: boolean
  feedReview?: boolean
  speed?: BotSpeed
  aiModel?: string
  aiBaseUrl?: string | null
}

export type AdminBotProfileInput = Partial<BotProfile>

export type AdminBotTopicInput = { slug: string; label: string; keywords: string[]; enabled: boolean }

export type AdminBotFeedAction = 'approve' | 'reject'

// Tạo/sửa tài khoản bot (mật khẩu do hệ thống cấp, không nhập từ UI)
export type AdminBotAccountInput = { username: string; displayName: string; role: BotRole; faculty: string; bio?: string; tone?: string; major?: string }
export type AdminBotAccountUpdate = Partial<Omit<AdminBotAccountInput, 'username'>>

// Hành động giao cho bot. scheduledAt: ISO, bỏ trống/quá khứ ⇒ chạy ngay.
// post: content (viết tay) | feedItemId (từ kho crawl) | không có gì ⇒ AI tự sinh theo chủ đề của bot
export type AdminBotCommandInput =
  | { type: 'post'; bot?: string; topic?: string; title?: string; content?: string; feedItemId?: string; enhance?: BotEnhance; scheduledAt?: string }
  | { type: 'comment'; postId: string; bot?: string; content?: string; enhance?: BotEnhance; scheduledAt?: string }
  | { type: 'like'; postId: string; bot: string; scheduledAt?: string }

// ── Import Excel/CSV vào kho nội dung bot ─────────────────────────────

// Cột chuẩn của file import (tool crawl hoặc Excel tự soạn đều phải ra các cột này)
export const BOT_IMPORT_FIELDS = ['content', 'key', 'title', 'images', 'topic', 'bot', 'scheduledAt', 'enhance'] as const
export type BotImportField = (typeof BOT_IMPORT_FIELDS)[number]

// Một dòng đã chuẩn hóa. bot + scheduledAt ⇒ bot đó đăng đúng giờ; bot không giờ ⇒ giãn cách; không bot ⇒ vào kho (AI duyệt/xoay vòng).
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
  plan?: 'now' | 'scheduled' | 'pool'
}

export interface BotImportResult {
  dryRun: boolean
  summary: Record<BotImportRowStatus, number>
  rows: BotImportRowResult[]
}

export interface BotImportInput {
  rows: Record<string, unknown>[]
  dryRun: boolean
  // Phút giữa các bài của dòng có bot nhưng không có giờ
  spacingMinutes?: number
}

// AI đoán cột nào của file ứng với trường chuẩn (header lạ/khác ngôn ngữ)
export interface BotImportMapRequest {
  headers: string[]
  sample: string[][]
}
export type BotImportMapping = Partial<Record<BotImportField, string>>
