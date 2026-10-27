import { z } from 'zod'
import type { ClassifyDocumentInput, DocCategory } from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại hằng số runtime (kiểu được kiểm ở cuối file)
export const DOC_CATEGORIES = [
  'midterm_exam',
  'final_exam',
  'lecture_slide',
  'syllabus',
  'textbook',
  'exercise',
  'sample_project',
  'internship_report',
  'scientific_paper',
  'other'
] as const satisfies readonly DocCategory[]

export const MAX_POST_DOCUMENTS = 10

export const ClassifyDocumentSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
  courseId: z.string().uuid().nullable().optional(),
  docCategory: z.enum(DOC_CATEGORIES).nullable().optional(),
  academicYear: z
    .string()
    .trim()
    .regex(/^\d{4}-\d{4}$/, { message: 'Năm học dạng 2025-2026' })
    .nullable()
    .optional(),
  listed: z.boolean().optional()
}) satisfies z.ZodType<ClassifyDocumentInput>

// Tạo tài liệu trực tiếp (không qua bài viết): chỉ nhận tệp đã tải lên R2 của hệ thống
export const CreateDocumentBodySchema = z.object({
  title: z.string().trim().min(1, { message: 'Tiêu đề tài liệu không được để trống' }).max(200),
  description: z.string().trim().max(1000).optional(),
  courseId: z.string().uuid().optional(),
  docCategory: z.enum(DOC_CATEGORIES).optional(),
  fileUrl: z.string().url(),
  fileSize: z.number().int().nonnegative().max(50 * 1024 * 1024),
  mimeType: z.string().max(100),
  tags: z.array(z.string().trim().max(40)).max(10).default([]),
  visibility: z.enum(['public', 'private']).default('public')
})
export type CreateDocumentBody = z.infer<typeof CreateDocumentBodySchema>
