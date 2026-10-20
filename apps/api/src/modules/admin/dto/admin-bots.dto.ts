import { z } from 'zod'

// Chỉ type từ @pu/schemas; hằng runtime khai báo lại ở đây (xem admin.dto.ts)
export const BOT_SPEEDS_RUNTIME = ['slow', 'normal', 'fast'] as const

const username = z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._]+$/)
const topicHint = z.string().trim().max(200).optional()
const slug = z.string().trim().regex(/^[a-z0-9-]{2,40}$/, 'slug: chữ thường, số, gạch ngang (2–40 ký tự)')

export const BotControlBodySchema = z
  .object({
    enabled: z.boolean().optional(),
    feedEnabled: z.boolean().optional(),
    feedReview: z.boolean().optional(),
    speed: z.enum(BOT_SPEEDS_RUNTIME).optional(),
    aiModel: z.string().trim().min(1).max(80).optional(),
    aiBaseUrl: z.string().trim().url().max(200).nullable().optional()
  })
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Cần ít nhất một trường' })

export const BotProfileBodySchema = z
  .object({
    enabled: z.boolean(),
    topics: z.array(slug).max(20),
    canPost: z.boolean(),
    canComment: z.boolean(),
    canLike: z.boolean(),
    interactHumans: z.boolean(),
    feedPoster: z.boolean(),
    maxPostsPerDay: z.number().int().min(0).max(50),
    maxCommentsPerDay: z.number().int().min(0).max(100),
    maxLikesPerDay: z.number().int().min(0).max(200)
  })
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Cần ít nhất một trường' })

export const BotTopicBodySchema = z.object({
  slug,
  label: z.string().trim().min(2).max(80),
  keywords: z.array(z.string().trim().min(1).max(40)).max(40),
  enabled: z.boolean()
})

export const BotCommandBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('post'), bot: username.optional(), topic: topicHint }),
  z.object({ type: z.literal('comment'), postId: z.string().uuid(), bot: username.optional() })
])

export const BotFeedActionBodySchema = z.object({ action: z.enum(['approve', 'reject']) })

export const BotFeedQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(20),
  status: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['new', 'review', 'approved', 'rejected', 'posted', 'skipped']).optional())
})
export type BotFeedQuery = z.infer<typeof BotFeedQuerySchema>

export const BotActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
  bot: z.preprocess((v) => (v === '' ? undefined : v), username.optional()),
  level: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['info', 'warn', 'error']).optional())
})
export type BotActivityQuery = z.infer<typeof BotActivityQuerySchema>
