import { z } from 'zod'

// Chỉ type từ @pu/schemas; id model khai báo lại ở đây (API không import runtime từ schemas)
const id = z.string().trim().regex(/^[A-Za-z0-9][A-Za-z0-9._:/-]{0,39}$/, 'Tên model chỉ gồm chữ, số và . _ : / - (tối đa 40 ký tự)')
const label = z.string().trim().min(1, 'Nhập tên hiển thị').max(40)
const hint = z.string().trim().max(160)
const cost = z.number().int().min(1).max(10)

export const AiModelCreateBodySchema = z.object({ id, label, hint: hint.optional(), cost: cost.optional(), visible: z.boolean().optional() })

export const AiModelPatchBodySchema = z
  .object({ label: label.optional(), hint: hint.optional(), cost: cost.optional(), visible: z.boolean().optional(), enabled: z.boolean().optional(), isDefault: z.literal(true).optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' })
