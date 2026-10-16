import { z } from 'zod'
import type { AiFeedbackInput, AiMemoryInput, AiSkillStateInput, AiSupportInput, AiTaskInput } from '@pu/schemas'
import { AI_CONNECTORS } from './chat.dto'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema runtime (giữ khớp bằng kiểm tra kiểu ở cuối file)
export const AI_MEMORY_LIMIT = 100
export const AI_TASK_LIMIT = 5

export const AiSettingsBodySchema = z
  .object({
    memoryEnabled: z.boolean(),
    retentionDays: z.union([z.literal(30), z.literal(365)]).nullable(),
    defaultConnectors: z.array(z.enum(AI_CONNECTORS)).min(1, { message: 'Chọn ít nhất 1 nguồn' }).max(AI_CONNECTORS.length)
  })
  .partial()
  .strict()
export type AiSettingsBody = z.infer<typeof AiSettingsBodySchema>

export const AiMemoryBodySchema = z.object({
  content: z.string().trim().min(3, { message: 'Nội dung quá ngắn' }).max(300, { message: 'Tối đa 300 ký tự' })
})

export const AiTaskBodySchema = z
  .object({
    title: z.string().trim().min(1, { message: 'Nhập tên tác vụ' }).max(80),
    prompt: z.string().trim().min(5, { message: 'Nội dung tối thiểu 5 ký tự' }).max(2000),
    skillId: z.string().uuid().nullable().optional(),
    connectors: z.array(z.enum(AI_CONNECTORS)).max(AI_CONNECTORS.length).default(['library']),
    frequency: z.enum(['daily', 'weekly']),
    runTime: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, { message: 'Giờ dạng HH:MM' }),
    weekday: z.number().int().min(0).max(6).nullable().optional(),
    enabled: z.boolean().default(true)
  })
  .refine((v) => v.frequency === 'daily' || v.weekday != null, { message: 'Chọn thứ trong tuần', path: ['weekday'] })

export const AiSkillStateBodySchema = z
  .object({ enabled: z.boolean().optional(), pinned: z.boolean().optional() })
  .refine((v) => v.enabled !== undefined || v.pinned !== undefined, { message: 'Không có thay đổi' })

export const AiFeedbackBodySchema = z.object({
  rating: z.union([z.literal(1), z.literal(-1)]),
  reason: z.enum(['wrong', 'unhelpful', 'unsafe', 'too_long', 'other']).nullable().optional(),
  comment: z.string().trim().max(500).nullable().optional()
})

export const AiSupportBodySchema = z.object({
  category: z.enum(['bug', 'wrong_answer', 'idea', 'other']),
  message: z.string().trim().min(10, { message: 'Mô tả tối thiểu 10 ký tự' }).max(2000),
  conversationId: z.string().uuid().nullable().optional(),
  includeContext: z.boolean().default(false)
})

// Id tin nhắn (BIGSERIAL dạng chuỗi)
export const MessageIdParamSchema = z.string().regex(/^\d{1,18}$/, { message: 'Tin nhắn không hợp lệ' })

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _memory: AiMemoryInput = {} as z.infer<typeof AiMemoryBodySchema>
const _task: AiTaskInput = {} as z.infer<typeof AiTaskBodySchema>
const _state: AiSkillStateInput = {} as z.infer<typeof AiSkillStateBodySchema>
const _feedback: AiFeedbackInput = {} as z.infer<typeof AiFeedbackBodySchema>
const _support: AiSupportInput = {} as z.infer<typeof AiSupportBodySchema>
void [_memory, _task, _state, _feedback, _support]
