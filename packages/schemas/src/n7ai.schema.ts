import { z } from 'zod'
import type { AiConnectorId, AiMode, ChatCitation } from './chat.schema'

// Cài đặt N7AI: bộ nhớ, tác vụ tự động, phản hồi, quyền riêng tư (docs/core/10-n7ai-settings.md)

export const AI_RETENTION_DAYS = [30, 365] as const
export interface AiSettings {
  memoryEnabled: boolean
  retentionDays: (typeof AI_RETENTION_DAYS)[number] | null // null = giữ vô hạn
  defaultConnectors: AiConnectorId[]
  profile: AiLearnerProfile
}

// Hồ sơ học do người dùng tự viết ⇒ luôn có trong system prompt thread riêng (kèm ngành / trường / khóa từ hồ sơ PU)
export const AI_PROFILE_LIMITS = { goal: 300, about: 600, style: 300 } as const
export interface AiLearnerProfile {
  goal: string | null // mục tiêu học (vd. IELTS 6.5, qua môn Giải tích 2)
  about: string | null // N7AI nên biết gì về bạn (trình độ, môn đang học, cách học)
  style: string | null // N7AI nên trả lời thế nào (ngắn gọn, nhiều ví dụ, tiếng Anh…)
}
export const AiLearnerProfileSchema = z
  .object({
    goal: z.string().trim().max(AI_PROFILE_LIMITS.goal, { message: `Tối đa ${AI_PROFILE_LIMITS.goal} ký tự` }).nullable(),
    about: z.string().trim().max(AI_PROFILE_LIMITS.about, { message: `Tối đa ${AI_PROFILE_LIMITS.about} ký tự` }).nullable(),
    style: z.string().trim().max(AI_PROFILE_LIMITS.style, { message: `Tối đa ${AI_PROFILE_LIMITS.style} ký tự` }).nullable()
  })
  .partial()

export const AI_MEMORY_LIMIT = 100
export const AiMemoryInputSchema = z.object({
  content: z.string().trim().min(3, { message: 'Nội dung quá ngắn' }).max(300, { message: 'Tối đa 300 ký tự' })
})
export type AiMemoryInput = z.infer<typeof AiMemoryInputSchema>
export interface AiMemory {
  id: string
  content: string
  source: 'auto' | 'manual'
  pinned: boolean // ghim ⇒ luôn có trong ngữ cảnh, không bị mục tự động mới đẩy ra
  createdAt: string
}

export const AI_TASK_LIMIT = 5
export const AiTaskInputSchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Nhập tên tác vụ' }).max(80),
    prompt: z.string().trim().min(5, { message: 'Nội dung tối thiểu 5 ký tự' }).max(2000),
    skillId: z.string().uuid().nullable().optional(),
    connectors: z.array(z.string()).max(8).default(['library']),
    frequency: z.enum(['daily', 'weekly']),
    runTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ dạng HH:MM' }),
    weekday: z.number().int().min(0).max(6).nullable().optional(),
    enabled: z.boolean().default(true)
  })
  .refine((v) => v.frequency === 'daily' || v.weekday != null, { message: 'Chọn thứ trong tuần', path: ['weekday'] })
export type AiTaskInput = z.infer<typeof AiTaskInputSchema>
export interface AiTask {
  id: string
  title: string
  prompt: string
  skillId: string | null
  connectors: string[]
  frequency: 'daily' | 'weekly'
  runTime: string
  weekday: number | null
  enabled: boolean
  conversationId: string | null
  nextRunAt: string
  lastRunAt: string | null
  lastStatus: 'done' | 'error' | 'skipped' | null
}

export const AI_FEEDBACK_REASONS = ['wrong', 'unhelpful', 'unsafe', 'too_long', 'other'] as const
export const AiFeedbackInputSchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  reason: z.enum(AI_FEEDBACK_REASONS).nullable().optional(),
  comment: z.string().trim().max(500).nullable().optional()
})
export type AiFeedbackInput = z.infer<typeof AiFeedbackInputSchema>

export const AI_SUPPORT_CATEGORIES = ['bug', 'wrong_answer', 'idea', 'other'] as const
export const AiSupportInputSchema = z.object({
  category: z.enum(AI_SUPPORT_CATEGORIES),
  message: z.string().trim().min(10, { message: 'Mô tả tối thiểu 10 ký tự' }).max(2000),
  conversationId: z.string().uuid().nullable().optional(),
  includeContext: z.boolean().default(false)
})
export type AiSupportInput = z.infer<typeof AiSupportInputSchema>

export interface AiUsage {
  used: number
  limit: number
  days: { date: string; count: number }[] // 7 ngày gần nhất (giờ VN)
}

export interface AiFeedbackStats {
  up: number
  down: number
  byReason: Record<string, number>
  tickets: { id: string; category: string; message: string; status: string; createdAt: string; user: string | null }[]
}

// Chia sẻ công khai 1 hội thoại N7AI qua link (docs/core/11-n7ai-space.md §Chia sẻ)
// Ảnh chụp tới tin cuối lúc tạo / cập nhật link; tin sau đó không lộ
export interface AiThreadShare {
  token: string
  sharedAt: string // lần tạo / cập nhật ảnh chụp gần nhất
  messageCount: number
  hasNewer: boolean // có tin mới sau ảnh chụp ⇒ gợi ý "Cập nhật link"
}

export interface SharedAiMessage {
  id: string
  role: 'user' | 'ai'
  content: string
  aiMode: AiMode | null
  citations: ChatCitation[] // chỉ nguồn công khai (bài PU, trang web)
  attachmentCount: number // tệp của người hỏi không công khai, chỉ báo số lượng
  createdAt: string
}

export interface SharedAiThread {
  title: string | null
  sharedAt: string
  messages: SharedAiMessage[]
}
