import { z } from 'zod'
import type { AiMode, UserEventType } from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại hằng runtime ở đây (satisfies giữ khớp kiểu)
const EVENT_TYPES = [
  'post_view',
  'post_open',
  'doc_open',
  'doc_download',
  'search',
  'search_click',
  'ai_suggestion_click'
] as const satisfies readonly UserEventType[]
const AI_MODES = ['ask', 'explain', 'quiz', 'flashcards', 'summarize', 'plan'] as const satisfies readonly AiMode[]

const EventSchema = z
  .object({
    type: z.enum(EVENT_TYPES),
    targetType: z.enum(['post', 'document']).optional(),
    targetId: z.string().uuid().optional(),
    // Chỉ chuỗi ngắn (từ khóa, nguồn gợi ý…) — không nhận dữ liệu tùy ý
    meta: z.record(z.string().max(40), z.string().max(120)).refine((m) => Object.keys(m).length <= 6).optional()
  })
  .strict()

// POST /events: client gửi theo lô (≤ 50 sự kiện / lần)
export const TrackEventsBodySchema = z.object({ events: z.array(EventSchema).min(1).max(50) }).strict()
export type TrackEventsBody = z.infer<typeof TrackEventsBodySchema>

export const SuggestionsQuerySchema = z.object({ mode: z.enum(AI_MODES).default('ask') })
export type SuggestionsQuery = z.infer<typeof SuggestionsQuerySchema>
