import { z } from 'zod'

// Dòng nhập học phần từ Excel/JSON: cùng quy tắc với tạo tay (AdminCourseBodySchema)
export const CourseRowSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Mã môn tối thiểu 2 ký tự')
    .max(20, 'Mã môn tối đa 20 ký tự')
    .regex(/^[A-Z0-9_-]+$/, 'Mã môn chỉ gồm chữ in hoa, số, gạch ngang/dưới'),
  name: z.string().trim().min(3, 'Tên môn tối thiểu 3 ký tự').max(150),
  credits: z.coerce.number().int().min(1).max(15).default(3),
  facultyCode: z.string().trim().min(1, 'Thiếu mã khoa/viện').max(30),
  description: z.string().trim().max(2000).optional().nullable(),
  syllabusUrl: z.string().trim().max(500).optional().nullable()
})

export const CourseImportSchema = z
  .object({
    rows: z.array(z.record(z.string(), z.unknown())).min(1, 'File không có dòng nào').max(500, 'Tối đa 500 dòng mỗi lần'),
    dryRun: z.boolean().default(false)
  })
  .strict()

export const CourseMergeSchema = z.object({ intoId: z.string().uuid() }).strict()
export const CourseLecturersSchema = z.object({ userIds: z.array(z.string().uuid()).max(50) }).strict()
export const LecturerSearchSchema = z.object({ q: z.string().trim().max(60).optional() })

export type CourseImport = z.infer<typeof CourseImportSchema>
