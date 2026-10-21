import { z } from 'zod'

// Chỉ type từ @pu/schemas; id model khai báo lại ở đây (API không import runtime từ schemas)
const id = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,39}$/, 'Mã model chỉ gồm chữ, số và . _ : / - (tối đa 40 ký tự)')
const label = z.string().trim().min(1, 'Nhập tên hiển thị').max(40)
const hint = z.string().trim().max(160)
const cost = z.number().int().min(1).max(10)
const upstreamModel = z
  .string()
  .trim()
  .regex(/^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,119}$/, 'Tên model không hợp lệ')
  .nullable()
const effort = z.enum(['low', 'medium', 'high']).nullable()
const maxInput = z.number().int().min(1000).max(2_000_000).nullable()
const maxOutput = z.number().int().min(256).max(200_000).nullable()

const llm = {
  providerId: z.string().uuid().nullable().optional(),
  upstreamModel: upstreamModel.optional(),
  reasoningEffort: effort.optional(),
  maxInputTokens: maxInput.optional(),
  maxOutputTokens: maxOutput.optional()
}

export const AiModelCreateBodySchema = z.object({
  id: id.optional(),
  label,
  hint: hint.optional(),
  cost: cost.optional(),
  visible: z.boolean().optional(),
  ...llm
})

export const AiModelBulkBodySchema = z.object({ items: z.array(AiModelCreateBodySchema).min(1).max(50) })

export const AiModelPatchBodySchema = z
  .object({
    currentId: z.string().trim().optional(),
    id: id.optional(),
    label: label.optional(),
    hint: hint.optional(),
    cost: cost.optional(),
    visible: z.boolean().optional(),
    enabled: z.boolean().optional(),
    isDefault: z.literal(true).optional(),
    ...llm
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' })
