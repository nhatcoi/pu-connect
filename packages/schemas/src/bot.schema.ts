// Bot Simulator — kiểu dùng chung giữa Admin web và API (chỉ type, không runtime)

export const BOT_SPEEDS = ['slow', 'normal', 'fast'] as const
export type BotSpeed = (typeof BOT_SPEEDS)[number]

export type BotCommandType = 'post' | 'comment'
export type BotCommandStatus = 'pending' | 'running' | 'done' | 'failed'
export type BotFeedStatus = 'new' | 'review' | 'approved' | 'rejected' | 'posted' | 'skipped'

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
  faculty: string | null
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

export type AdminBotCommandInput = { type: 'post'; bot?: string; topic?: string } | { type: 'comment'; postId: string; bot?: string }
