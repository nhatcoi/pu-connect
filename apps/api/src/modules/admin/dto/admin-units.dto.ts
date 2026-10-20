import { z } from 'zod'

// Chỉ type từ @pu/schemas; hằng runtime khai báo lại ở đây (xem admin.dto.ts)
export const ACADEMIC_UNIT_TYPES_RUNTIME = ['school', 'faculty', 'major', 'institute', 'center'] as const

const name = z.string().trim().min(2, 'Tên quá ngắn').max(200)
const shortName = z.preprocess((v) => (v === '' ? null : v), z.string().trim().max(40).nullable().optional())
const parentId = z.string().uuid().nullable().optional()

export const UnitCreateBodySchema = z.object({
  type: z.enum(ACADEMIC_UNIT_TYPES_RUNTIME),
  name,
  shortName,
  parentId
})

export const UnitPatchBodySchema = z
  .object({
    type: z.enum(ACADEMIC_UNIT_TYPES_RUNTIME).optional(),
    name: name.optional(),
    shortName,
    parentId,
    isActive: z.boolean().optional()
  })
  .refine((v) => Object.keys(v).length > 0, { message: 'Không có gì để cập nhật' })

export const UnitReorderBodySchema = z.object({ direction: z.enum(['up', 'down']) })
export const UnitMergeBodySchema = z.object({ targetId: z.string().uuid() })
