import { z } from 'zod'

// Chỉ type từ @pu/schemas; hằng runtime khai báo lại ở đây (xem admin.dto.ts)
export const BOT_SPEEDS_RUNTIME = ['slow', 'normal', 'fast'] as const

const username = z.string().trim().min(1).max(40).regex(/^[a-zA-Z0-9._]+$/)
const topic = z.string().trim().max(200).optional()

export const BotControlBodySchema = z
  .object({ enabled: z.boolean().optional(), speed: z.enum(BOT_SPEEDS_RUNTIME).optional() })
  .refine((v) => v.enabled !== undefined || v.speed !== undefined, { message: 'Cần enabled hoặc speed' })

export const BotCommandBodySchema = z.discriminatedUnion('type', [
  z.object({ type: z.literal('post'), bot: username.optional(), topic }),
  z.object({ type: z.literal('chat'), botA: username.optional(), botB: username.optional(), topic }),
  z.object({ type: z.literal('group'), topic }),
  z.object({ type: z.literal('comment'), postId: z.string().uuid(), bot: username.optional() })
])

export const BotActivityQuerySchema = z.object({
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(30),
  bot: z.preprocess((v) => (v === '' ? undefined : v), username.optional()),
  level: z.preprocess((v) => (v === '' ? undefined : v), z.enum(['info', 'warn', 'error']).optional())
})
export type BotActivityQuery = z.infer<typeof BotActivityQuerySchema>
