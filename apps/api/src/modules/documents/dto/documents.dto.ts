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

// Nhãn tiếng Việt (prompt N7AI); bản web ở @pu/schemas
export const DOC_CATEGORY_LABELS: Record<DocCategory, string> = {
  midterm_exam: 'Đề giữa kỳ',
  final_exam: 'Đề cuối kỳ',
  lecture_slide: 'Slide bài giảng',
  syllabus: 'Đề cương',
  textbook: 'Giáo trình / Sách',
  exercise: 'Bài tập & lời giải',
  sample_project: 'Đồ án / Báo cáo mẫu',
  internship_report: 'Báo cáo thực tập',
  scientific_paper: 'Bài báo khoa học',
  other: 'Khác'
}

export const MAX_POST_DOCUMENTS = 10
export const MAX_COMMENT_DOCUMENTS = 3

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

// N7AI gợi ý phân loại cho tệp vừa tải lên R2 nhưng chưa thành tài liệu (hộp Chia sẻ tài liệu)
export const SuggestFileSchema = z.object({
  fileUrl: z.string().url(),
  fileName: z.string().trim().min(1).max(255),
  mimeType: z.string().max(100)
})
export type SuggestFileBody = z.infer<typeof SuggestFileSchema>

// "Viết giúp": N7AI viết bài giới thiệu tài liệu đang đính kèm
export const WriteDocumentPostSchema = z.object({
  documentIds: z.array(z.string().uuid()).min(1).max(MAX_POST_DOCUMENTS),
  content: z.string().max(5000).optional()
})

// Kho cá nhân
export const SaveToLibrarySchema = z.object({
  documentId: z.string().uuid(),
  folderId: z.string().uuid().nullable().optional()
})
export type SaveToLibraryBody = z.infer<typeof SaveToLibrarySchema>

export const MoveLibraryItemSchema = z.object({ folderId: z.string().uuid().nullable() })
export type MoveLibraryItemBody = z.infer<typeof MoveLibraryItemSchema>

export const LibraryFolderSchema = z.object({ name: z.string().trim().min(1, { message: 'Nhập tên thư mục' }).max(80) })
export type LibraryFolderBody = z.infer<typeof LibraryFolderSchema>

// GET /documents/browse
export const BrowseDocumentsSchema = z.object({
  course: z.string().trim().max(400).optional(),
  category: z.enum(DOC_CATEGORIES).optional(),
  q: z.string().trim().max(100).optional(),
  sort: z.enum(['popular', 'newest']).default('popular'),
  cursor: z.string().regex(/^\d{1,5}$/).optional()
})
export type BrowseDocumentsQuery = z.infer<typeof BrowseDocumentsSchema>

// POST /documents/:id/study-draft
export const DocumentStudyDraftSchema = z.object({ kind: z.enum(['flashcards', 'quiz']) })
export type DocumentStudyDraftBody = z.infer<typeof DocumentStudyDraftSchema>

// PUT /documents/:id/rating
export const RateDocumentSchema = z.object({ rating: z.number().int().min(1).max(5) })
export type RateDocumentBody = z.infer<typeof RateDocumentSchema>

// GET /documents/course-path?course=
export const CoursePathQuerySchema = z.object({ course: z.string().trim().min(1).max(40) })

// ── Bộ sưu tập ──
export const CollectionBodySchema = z.object({
  title: z.string().trim().min(1, { message: 'Tên bộ sưu tập không được để trống' }).max(120),
  description: z.string().trim().max(500).nullish(),
  visibility: z.enum(['public', 'private']).default('public')
})
export type CollectionBody = z.infer<typeof CollectionBodySchema>

export const CollectionListQuerySchema = z.object({
  scope: z.enum(['mine', 'public']).default('public'),
  cursor: z.string().regex(/^\d{1,5}$/).optional()
})
export const CollectionMembershipQuerySchema = z.object({ documentId: z.string().uuid() })
