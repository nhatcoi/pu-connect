import { z } from 'zod'
import { AI_CONNECTORS, AI_MODES } from './chat.dto'

// @pu/schemas là mã TS nguồn ⇒ khai báo lại schema runtime ở API (như chat.dto.ts)
const TURN_MAX_CHARS = 8000
const MAX_TURNS = 30

export const AiTemporaryBodySchema = z.object({
  messages: z
    .array(z.object({ role: z.enum(['user', 'assistant']), content: z.string().trim().min(1).max(TURN_MAX_CHARS) }))
    .min(1)
    .max(MAX_TURNS)
    .refine((m) => m.at(-1)?.role === 'user', 'Tin cuối phải là câu hỏi của bạn'),
  aiMode: z.enum(AI_MODES).optional(),
  research: z.boolean().optional(),
  connectors: z.array(z.enum(AI_CONNECTORS)).max(AI_CONNECTORS.length).optional()
})
