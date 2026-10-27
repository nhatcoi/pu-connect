import { z } from 'zod'

// Người dùng gợi ý môn còn thiếu: chỉ cần tên; mã, khoa, tín chỉ để admin chốt khi duyệt
export const CourseSuggestionSchema = z
  .object({
    name: z.string().trim().min(3, 'Tên môn tối thiểu 3 ký tự').max(150),
    code: z
      .string()
      .trim()
      .toUpperCase()
      .max(20)
      .regex(/^[A-Z0-9_-]*$/, 'Mã môn chỉ gồm chữ in hoa, số, gạch ngang/dưới')
      .optional(),
    facultyCode: z.string().trim().max(30).optional(),
    credits: z.number().int().min(1).max(15).optional(),
    note: z.string().trim().max(500).optional()
  })
  .strict()

export type CourseSuggestionBody = z.infer<typeof CourseSuggestionSchema>

export const MAX_PENDING_SUGGESTIONS = 5
