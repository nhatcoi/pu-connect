import { z } from 'zod'

// Query string rỗng ⇒ undefined (không lọc)
const opt = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.enum(values).optional())
const text = (max = 100) => z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().max(max).optional())

// Phân trang + sắp xếp dùng chung
const paging = {
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25),
  dir: opt(['asc', 'desc'] as const).default('desc')
}

export const ReportsQuerySchema = z.object({
  ...paging,
  q: text(),
  status: opt(['pending', 'resolved'] as const).default('pending'),
  reason: opt(['spam', 'exam_leak', 'harassment', 'inaccurate_info', 'other'] as const),
  sort: opt(['reports', 'recent'] as const).default('reports')
})

export const CommentReportsQuerySchema = ReportsQuerySchema

export const PostsQuerySchema = z.object({
  ...paging,
  q: text(),
  filter: opt(['pinned', 'hidden', 'qna_unsolved', 'reported'] as const),
  type: text(30),
  sort: opt(['recent', 'likes', 'comments', 'views', 'reports'] as const).default('recent')
})

export const CommentsQuerySchema = z.object({
  ...paging,
  q: text(),
  filter: opt(['solution'] as const),
  sort: opt(['recent', 'likes'] as const).default('recent')
})

export const CoursesQuerySchema = z.object({
  ...paging,
  q: text(),
  faculty: text(30),
  sort: opt(['posts', 'documents', 'code', 'recent'] as const).default('posts')
})

export const DocumentsQuerySchema = z.object({
  ...paging,
  q: text(),
  docType: text(30),
  indexed: opt(['yes', 'no'] as const),
  sort: opt(['recent', 'downloads', 'size', 'chunks'] as const).default('recent')
})

export const CommunitiesQuerySchema = z.object({
  ...paging,
  q: text(),
  type: text(30),
  sort: opt(['members', 'posts', 'recent'] as const).default('members')
})

export const SkillsQuerySchema = z.object({
  ...paging,
  q: text(),
  status: opt(['public', 'private', 'disabled'] as const),
  sort: opt(['installs', 'uses', 'recent'] as const).default('installs')
})

export const AuditQuerySchema = z.object({
  ...paging,
  q: text(64),
  action: text(40),
  admin: text(50),
  targetType: opt(['post', 'comment', 'user', 'course', 'document', 'ai_ticket', 'ai_skill', 'system'] as const),
  days: opt(['1', '7', '30', '90'] as const)
})

export type ReportsQuery = z.infer<typeof ReportsQuerySchema>
export type CommentReportsQuery = ReportsQuery
export type PostsQuery = z.infer<typeof PostsQuerySchema>
export type CommentsQuery = z.infer<typeof CommentsQuerySchema>
export type CoursesQuery = z.infer<typeof CoursesQuerySchema>
export type DocumentsQuery = z.infer<typeof DocumentsQuerySchema>
export type CommunitiesQuery = z.infer<typeof CommunitiesQuerySchema>
export type SkillsQuery = z.infer<typeof SkillsQuerySchema>
export type AuditQuery = z.infer<typeof AuditQuerySchema>

// ── Hàng loạt ──
export const BulkPostBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['hide', 'unhide', 'pin', 'unpin', 'dismiss']),
  reason: z.string().trim().max(255).optional()
})

export const BulkCommentBodySchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(['delete', 'dismiss']),
  reason: z.string().trim().max(255).optional()
})


// Nhật ký đăng nhập toàn hệ thống
export const SecurityEventsQuerySchema = z.object({
  ...paging,
  q: text(64), // @username hoặc IP
  event: opt(['login', 'login_failed', 'login_blocked', 'logout', 'register', 'password_reset', 'password_reset_requested', 'email_verified', 'session_revoked'] as const),
  result: opt(['failed', 'unusual'] as const),
  country: z.preprocess((v) => (v === '' ? undefined : v), z.string().trim().regex(/^[A-Za-z]{2}$/).optional()),
  days: opt(['1', '7', '30', '90'] as const)
})
export type SecurityEventsQuery = z.infer<typeof SecurityEventsQuerySchema>
