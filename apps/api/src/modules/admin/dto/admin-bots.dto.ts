import { z } from 'zod'

// Chỉ type từ @pu/schemas; hằng runtime khai báo lại ở đây (xem admin.dto.ts)
export const BOT_SPEEDS_RUNTIME = ['slow', 'normal', 'fast'] as const
export const BOT_ROLES_RUNTIME = ['student', 'lecturer', 'ta'] as const

const username = z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._]+$/)
const topicHint = z.string().trim().max(200).optional()
const slug = z.string().trim().regex(/^[a-z0-9-]{2,40}$/, 'slug: chữ thường, số, gạch ngang (2–40 ký tự)')

export const BotControlBodySchema = z
  .object({
    enabled: z.boolean().optional(),
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

const scheduledAt = z.string().datetime({ offset: true }).optional()
const enhance = z.enum(['none', 'ai']).optional()

export const BotCommandBodySchema = z.discriminatedUnion('type', [
  z.object({
    type: z.literal('post'),
    bot: username.optional(),
    topic: topicHint,
    title: z.string().trim().max(200).optional(),
    content: z.string().trim().max(5000).optional(),
    enhance,
    scheduledAt
  }),
  z.object({ type: z.literal('comment'), postId: z.string().uuid(), bot: username.optional(), content: z.string().trim().max(1000).optional(), enhance, scheduledAt }),
  z.object({ type: z.literal('like'), postId: z.string().uuid(), bot: username, scheduledAt })
])

export const BotGenerateContentSchema = z.object({
  bot: username,
  type: z.enum(['post', 'comment']),
  prompt: z.string().trim().max(1000).optional(),
  postId: z.string().uuid().optional()
})
export type BotGenerateContentDto = z.infer<typeof BotGenerateContentSchema>

const accountFields = {
  displayName: z.string().trim().min(2).max(60),
  role: z.enum(BOT_ROLES_RUNTIME),
  faculty: z.string().trim().min(1).max(50),
  bio: z.string().trim().max(300),
  tone: z.string().trim().max(300),
  major: z.string().trim().max(80),
  soul: z.string().trim().max(2000)
}
export const BotAccountCreateSchema = z.object({
  username: z.string().trim().min(3).max(30).regex(/^[a-z0-9._]+$/, 'username: chữ thường, số, dấu chấm/gạch dưới'),
  ...accountFields,
  bio: accountFields.bio.optional(),
  tone: accountFields.tone.optional(),
  major: accountFields.major.optional(),
  soul: accountFields.soul.optional()
})
export const BotAccountUpdateSchema = z
  .object(accountFields)
  .partial()
  .refine((v) => Object.values(v).some((x) => x !== undefined), { message: 'Cần ít nhất một trường' })

export const BotActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
  bot: z.preprocess((v) => (v === '' ? undefined : v), username.optional()),
  level: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['info', 'warn', 'error']).optional())
})
export type BotActivityQuery = z.infer<typeof BotActivityQuerySchema>

export const BotImportBodySchema = z.object({
  rows: z.array(z.record(z.unknown())).min(1, 'File không có dòng nào').max(200, 'Tối đa 200 dòng mỗi lần'),
  dryRun: z.boolean().default(false),
  spacingMinutes: z.number().int().min(1).max(1440).optional()
})

export const BotImportMapBodySchema = z.object({
  headers: z.array(z.string().max(120)).min(1).max(60),
  sample: z.array(z.array(z.string().max(300)).max(60)).max(5)
})
