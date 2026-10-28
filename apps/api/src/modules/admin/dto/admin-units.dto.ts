import { z } from 'zod'

// Chỉ type từ @pu/schemas; hằng runtime khai báo lại ở đây (xem admin.dto.ts)
export const UNIT_KINDS_RUNTIME = ['university', 'field'] as const

const name = z.string().trim().min(2, 'Tên quá ngắn').max(200)

export const UnitKindParamSchema = z.enum(UNIT_KINDS_RUNTIME)

export const UnitCreateBodySchema = z.object({ kind: z.enum(UNIT_KINDS_RUNTIME), name })

export const UnitPatchBodySchema = z
  .object({ name: name.optional(), isActive: z.boolean().optional() })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' })

export const UnitMergeBodySchema = z.object({ targetId: z.string().uuid() })

export const UnitRequestStatusSchema = z.enum(['pending', 'approved', 'rejected']).default('pending')

export const UnitRequestApproveBodySchema = z
  .object({ name: name.optional(), existingId: z.string().uuid().optional() })
  .refine((v) => !(v.name && v.existingId), { message: 'Chọn một: tên mới hoặc gộp vào mục có sẵn' })

export const UnitRequestRejectBodySchema = z.object({ reason: z.string().trim().max(300).optional() })
