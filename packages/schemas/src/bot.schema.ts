// Bot — kiểu dùng chung giữa Admin web và API (chỉ type, không runtime)

export const BOT_ROLES = ['student', 'lecturer', 'ta'] as const
export type BotRole = (typeof BOT_ROLES)[number]

// Tài khoản bot + persona (AI bám theo khi bot trả lời bình luận)
export interface AdminBotAccount {
  id: string
  username: string
  displayName: string
  role: BotRole
  interestFieldId: string | null
  interestField: string | null
  bio: string
  tone: string
  soul: string
  jobsCount: number
  postsCount: number
}

// Tạo/sửa tài khoản bot (mật khẩu do hệ thống cấp, không nhập từ UI)
export type AdminBotAccountInput = { username: string; displayName: string; role: BotRole; interestFieldId?: string | null; bio?: string; tone?: string; soul?: string }
export type AdminBotAccountUpdate = Partial<Omit<AdminBotAccountInput, 'username'>>

export type BotJobStatus = 'active' | 'paused'
export type BotJobPostStatus = 'pending' | 'posting' | 'posted' | 'failed'

export interface AdminBotJob {
  id: string
  name: string
  botUsername: string
  botName: string
  autoReply: boolean
  autoReact: boolean
  status: BotJobStatus
  createdAt: string
  counts: Record<BotJobPostStatus, number>
  // Số bình luận bot đã trả lời / thả tim ở các bài của job
  replies: number
  reactions: number
  nextAt: string | null
}

export interface AdminBotOverview {
  bots: AdminBotAccount[]
  jobs: AdminBotJob[]
}

// Dòng bài của job (chi tiết)
export interface AdminBotJobPost {
  id: string
  title: string
  content: string
  postType: string
  tags: string[]
  mediaUrls: string[]
  scheduledAt: string
  status: BotJobPostStatus
  error: string | null
  postId: string | null
  postedAt: string | null
}

export interface AdminBotJobDetail extends AdminBotJob {
  posts: AdminBotJobPost[]
}

// ── Nhập bài từ Excel/JSON ──────────────────────────────────────────────

// Cột chuẩn của file. Chỉ content bắt buộc.
export const BOT_IMPORT_FIELDS = ['content', 'title', 'images', 'tags', 'postType', 'visibility', 'course', 'community', 'pollQuestion', 'pollOptions', 'scheduledAt'] as const
export type BotImportField = (typeof BOT_IMPORT_FIELDS)[number]
export type BotImportMapping = Partial<Record<BotImportField, string>>

export const BOT_POST_TYPES = ['general', 'qa', 'document', 'group_recruit', 'review'] as const

// Một dòng đã chuẩn hóa = một bài. Có giờ ⇒ đăng đúng giờ (quá khứ ⇒ đăng ngay); không giờ ⇒ giãn cách đều.
export interface BotImportRow {
  content: string
  title?: string
  images?: string[]
  tags?: string[]
  postType?: (typeof BOT_POST_TYPES)[number]
  visibility?: 'public' | 'followers' | 'private'
  // Mã hoặc id môn học
  course?: string
  // Slug cộng đồng
  community?: string
  pollQuestion?: string
  pollOptions?: string[]
  // ISO 8601
  scheduledAt?: string
}

export type BotImportRowStatus = 'ok' | 'duplicate' | 'invalid'

export interface BotImportRowResult {
  index: number
  status: BotImportRowStatus
  reason?: string
  // Cảnh báo không chặn (vd ảnh tải lỗi nên bỏ ảnh)
  warning?: string
}

export interface BotImportResult {
  dryRun: boolean
  jobId?: string
  summary: Record<BotImportRowStatus, number>
  rows: BotImportRowResult[]
}

export interface AdminBotJobInput {
  name: string
  bot: string
  autoReply: boolean
  autoReact: boolean
  rows: Record<string, unknown>[]
  dryRun: boolean
  // Phút giữa các bài không có giờ hẹn
  spacingMinutes?: number
}

export type AdminBotJobPatch = Partial<Pick<AdminBotJob, 'name' | 'autoReply' | 'autoReact' | 'status'>>
