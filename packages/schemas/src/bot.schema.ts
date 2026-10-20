// Bot Simulator — kiểu dùng chung giữa Admin web và API (chỉ type, không runtime)

export const BOT_SPEEDS = ['slow', 'normal', 'fast'] as const
export type BotSpeed = (typeof BOT_SPEEDS)[number]

export type BotCommandType = 'post' | 'chat' | 'group' | 'comment'
export type BotCommandStatus = 'pending' | 'running' | 'done' | 'failed'

export interface BotSessionStats {
  postsCount: number
  directChatsCount: number
  groupChatsCount: number
  commentsCount: number
  likesCount: number
}

export interface AdminBotAccount {
  id: string
  username: string
  displayName: string
  faculty: string | null
  actions24h: number
  lastActionAt: string | null
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
  pending: number
  posted24h: number
  lastPostedAt: string | null
}

export interface AdminBotOverview {
  enabled: boolean
  // Đăng bài từ dữ liệu crawl (Trần Ngọc & Trần Minh thay phiên)
  feedEnabled: boolean
  feed: AdminBotFeedStats
  speed: BotSpeed
  // Daemon có heartbeat trong 30 giây gần nhất
  online: boolean
  heartbeatAt: string | null
  startedAt: string | null
  stats: BotSessionStats | null
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

export type AdminBotControlInput = { enabled?: boolean; feedEnabled?: boolean; speed?: BotSpeed }

export type AdminBotCommandInput =
  | { type: 'post'; bot?: string; topic?: string }
  | { type: 'chat'; botA?: string; botB?: string; topic?: string }
  | { type: 'group'; topic?: string }
  | { type: 'comment'; postId: string; bot?: string }
