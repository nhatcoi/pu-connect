import { z } from 'zod'

export const DocumentTypeSchema = z.enum(['pdf', 'markdown', 'code', 'doc', 'sheet', 'slides', 'other'])

export const CreateDocumentSchema = z.object({
  title: z.string().min(1, { message: 'Tiêu đề tài liệu không được để trống' }).max(200),
  description: z.string().max(1000).optional(),
  type: DocumentTypeSchema,
  courseId: z.string().optional(),
  fileUrl: z.string().url({ message: 'URL tệp không hợp lệ' }),
  fileSize: z.number().nonnegative(),
  mimeType: z.string(),
  tags: z.array(z.string()).default([]),
  folderId: z.string().optional(),
  visibility: z.enum(['public', 'shared', 'private']).default('public'),
  metadata: z.record(z.any()).optional()
})

export const DocumentItemSchema = z.object({
  id: z.string(),
  ownerId: z.string(),
  owner: z.object({
    id: z.string(),
    username: z.string(),
    displayName: z.string(),
    avatarUrl: z.string().nullable().optional()
  }),
  courseId: z.string().nullable().optional(),
  courseCode: z.string().nullable().optional(),
  title: z.string(),
  description: z.string().nullable().optional(),
  type: DocumentTypeSchema,
  fileUrl: z.string(),
  fileSize: z.number(),
  mimeType: z.string(),
  tags: z.array(z.string()),
  downloadCount: z.number().default(0),
  viewCount: z.number().default(0),
  visibility: z.enum(['public', 'shared', 'private']),
  createdAt: z.string(),
  updatedAt: z.string()
})

export type DocumentType = z.infer<typeof DocumentTypeSchema>
export type CreateDocumentInput = z.infer<typeof CreateDocumentSchema>
export type DocumentItem = z.infer<typeof DocumentItemSchema>

// ── Kho tài liệu (đính kèm bài viết → phân loại → kho môn học) ──
// Phân loại nội dung (khác `type` = định dạng tệp). Khớp doc_type_enum trong DB
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
] as const
export type DocCategory = (typeof DOC_CATEGORIES)[number]
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

// Tài liệu gắn với bài viết / bình luận (thẻ hiển thị gọn, không kèm chủ sở hữu)
export interface AttachedDocument {
  id: string
  title: string
  fileUrl: string
  fileSize: number
  mimeType: string
  docCategory: DocCategory | null
  courseId: string | null
  courseCode: string | null
  courseName: string | null
  academicYear: string | null
  // Đã vào kho môn học (đủ môn + loại); false = chỉ là tệp đính kèm của bài
  listed: boolean
  status: 'draft' | 'published'
  visibility: 'public' | 'private'
  downloadCount: number
}

// POST /documents/upload: bản nháp vừa tạo + tài liệu trùng nội dung đã có trong kho (nếu có)
export interface DocumentUploadResult {
  document: AttachedDocument
  duplicateOf: { id: string; title: string; courseCode: string | null } | null
}

// PATCH /documents/:id: phân loại (chủ tài liệu). listed = true cần courseId + docCategory
export interface ClassifyDocumentInput {
  title?: string
  courseId?: string | null
  docCategory?: DocCategory | null
  academicYear?: string | null
  listed?: boolean
}

// POST /documents/:id/suggest: N7AI đọc nội dung tệp, gợi ý phân loại (người đăng xem rồi mới lưu)
export interface DocumentSuggestion {
  title: string | null
  courseId: string | null
  courseCode: string | null
  docCategory: DocCategory | null
  academicYear: string | null
}

// POST /documents/write-post: N7AI viết nội dung bài đăng giới thiệu tài liệu ("Viết giúp")
export interface WriteDocumentPostInput {
  documentIds: string[]
  content?: string
}
export interface WriteDocumentPostResult {
  content: string
}

// ── Kho cá nhân: tham chiếu tới tài liệu (gốc bị xóa / chuyển riêng tư ⇒ tự biến mất) ──
export interface LibraryFolder {
  id: string
  name: string
  itemCount: number
  createdAt: string
}

export interface LibraryItem {
  document: AttachedDocument
  folderId: string | null
  savedAt: string
  // Tài liệu do chính mình đăng / tải lên
  ownedByMe: boolean
  ownerName: string
}

// GET /library: scope saved = đã lưu (gồm tệp riêng tải lên kho), mine = tài liệu mình đã đăng
export interface LibraryPage {
  data: LibraryItem[]
  nextCursor: string | null
}

export interface SaveToLibraryInput {
  documentId: string
  folderId?: string | null
}

// ── Trang Tài liệu & chi tiết tài liệu ──
export type DocumentSort = 'popular' | 'newest'

// Thẻ trong danh sách kho chung (kèm người đăng, lượt lưu)
export interface DocumentListItem extends AttachedDocument {
  ownerId: string
  ownerUsername: string
  ownerName: string
  saveCount: number
  createdAt: string
}

export interface DocumentListPage {
  data: DocumentListItem[]
  nextCursor: string | null
}

// GET /documents/:id/detail
export interface DocumentDetail extends DocumentListItem {
  description: string | null
  originalName: string | null
  viewCount: number
  isMine: boolean
  isSaved: boolean
  // Bài viết công khai có đính kèm tài liệu này (mới nhất trước)
  posts: { id: string; title: string | null; excerpt: string; authorName: string; createdAt: string }[]
  related: DocumentListItem[]
}
