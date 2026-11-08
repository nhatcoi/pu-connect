import { z, type ZodRawShape } from 'zod'

// Mỗi tool = 1 lời gọi REST nội bộ với chính key của người dùng ⇒ guard, giới hạn tốc độ,
// kiểm duyệt và quyền xem y như trên web. Tool không tự đụng DB.
export interface HttpCall {
  method: 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE'
  path: string
  query?: Record<string, string | number | boolean | undefined | null>
  body?: unknown
  // POST multipart (tải tệp)
  file?: { field: string; filename: string; data: Buffer; mime: string }
  // Gọi tiếp sau khi lời gọi đầu xong (vd tải tệp rồi phân loại)
  then?: (first: any) => HttpCall
}

export interface McpToolDef {
  name: string
  scope: string
  description: string
  input: ZodRawShape
  readOnly?: boolean
  destructive?: boolean
  call: (args: any) => HttpCall
}

export const id = z.string().min(1).describe('ID (uuid)')
export const limit = (n = 10) => z.number().int().min(1).max(50).optional().describe(`Số mục (mặc định ${n}, tối đa 50)`)
const offset = z.number().int().min(0).optional().describe('Bỏ qua N mục đầu (phân trang)')
const DOC_CATEGORIES = ['lecture', 'exam', 'summary', 'exercise', 'book', 'other']

export const def = (
  name: string,
  scope: string,
  description: string,
  input: ZodRawShape,
  call: McpToolDef['call'],
  opts: { destructive?: boolean } = {}
): McpToolDef => ({ name, scope, description, input, call, readOnly: scope === 'read', destructive: opts.destructive })

export const MCP_TOOLS: McpToolDef[] = [
  // ── Đọc ──
  def('search', 'read', 'Tìm trong PU Connect: học phần, tài liệu, bài viết, người dùng, nhóm học, cộng đồng.', {
    q: z.string().min(1).max(200),
    type: z.enum(['all', 'courses', 'documents', 'posts', 'users', 'groups', 'communities']).optional(),
    limit: limit(20),
    offset
  }, (a) => ({ method: 'GET', path: '/search', query: a })),
  def('get_feed', 'read', 'Bảng tin: for_you (gợi ý), latest (mới nhất), following (đang theo dõi), qa (hỏi đáp).', {
    feedType: z.enum(['for_you', 'latest', 'following', 'qa']).optional(),
    tag: z.string().optional(),
    course: z.string().optional().describe('Mã học phần'),
    limit: limit(),
    offset
  }, (a) => ({ method: 'GET', path: '/posts', query: a })),
  def('get_post', 'read', 'Đọc một bài viết.', { id }, (a) => ({ method: 'GET', path: `/posts/${enc(a.id)}` })),
  def('list_comments', 'read', 'Bình luận của một bài viết.', { postId: id, limit: limit(5), offset }, (a) => ({
    method: 'GET',
    path: `/posts/${enc(a.postId)}/comments`,
    query: { limit: a.limit, offset: a.offset }
  })),
  def('list_courses', 'read', 'Danh sách học phần.', {}, () => ({ method: 'GET', path: '/courses' })),
  def('get_course', 'read', 'Chi tiết một học phần.', { id }, (a) => ({ method: 'GET', path: `/courses/${enc(a.id)}` })),
  def('list_followed_courses', 'read', 'Học phần tôi đang theo dõi.', {}, () => ({ method: 'GET', path: '/courses/followed' })),
  def('browse_documents', 'read', 'Duyệt kho tài liệu (lọc theo học phần, loại, từ khóa).', {
    q: z.string().max(100).optional(),
    course: z.string().optional().describe('Mã học phần'),
    category: z.enum(DOC_CATEGORIES as [string, ...string[]]).optional(),
    sort: z.enum(['popular', 'newest']).optional(),
    cursor: z.string().optional().describe('Con trỏ trang tiếp (nextCursor của lần trước)')
  }, (a) => ({ method: 'GET', path: '/documents/browse', query: a })),
  def('get_document', 'read', 'Chi tiết một tài liệu (mô tả, học phần, điểm đánh giá).', { id }, (a) => ({ method: 'GET', path: `/documents/${enc(a.id)}/detail` })),
  def('list_communities', 'read', 'Danh sách cộng đồng.', { search: z.string().optional() }, (a) => ({ method: 'GET', path: '/communities', query: a })),
  def('get_community', 'read', 'Chi tiết một cộng đồng.', { slug: z.string() }, (a) => ({ method: 'GET', path: `/communities/${enc(a.slug)}` })),
  def('list_community_posts', 'read', 'Bài viết trong một cộng đồng.', {
    slug: z.string(),
    sort: z.enum(['hot', 'new', 'top']).optional(),
    limit: limit(),
    offset
  }, (a) => ({ method: 'GET', path: `/communities/${enc(a.slug)}/posts`, query: { sort: a.sort, limit: a.limit, offset: a.offset } })),
  def('get_user', 'read', 'Hồ sơ công khai của người dùng theo username.', { username: z.string() }, (a) => ({ method: 'GET', path: `/users/${enc(a.username)}` })),
  def('list_notifications', 'read', 'Thông báo của tôi.', { unreadOnly: z.boolean().optional(), limit: limit(15) }, (a) => ({
    method: 'GET',
    path: '/notifications',
    query: { unread: a.unreadOnly ? 1 : undefined, limit: a.limit }
  })),
  def('unread_notification_count', 'read', 'Số thông báo chưa đọc.', {}, () => ({ method: 'GET', path: '/notifications/unread-count' })),

  // ── Ghi: bài viết, bình luận… ──
  def('create_post', 'write', 'Đăng bài. postType: general | qa (hỏi đáp) | review | group_recruit. Gắn học phần bằng courseId, cộng đồng bằng communitySlug.', {
    content: z.string().min(1).max(20000),
    title: z.string().max(200).optional(),
    postType: z.enum(['general', 'qa', 'review', 'group_recruit']).optional(),
    courseId: z.string().optional(),
    communitySlug: z.string().optional(),
    tags: z.array(z.string()).max(10).optional(),
    visibility: z.enum(['public', 'followers', 'private']).optional(),
    isAnonymous: z.boolean().optional().describe('Chỉ bài hỏi đáp'),
    documentIds: z.array(z.string().uuid()).max(10).optional().describe('Tài liệu đã tải lên (upload_document)')
  }, (a) => ({
    method: 'POST',
    path: '/posts',
    body: {
      postType: 'general',
      targetAudience: 'everyone',
      visibility: 'public',
      tags: [],
      attachedDocumentIds: [],
      documentIds: [],
      mediaUrls: [],
      isAnonymous: false,
      ...a
    }
  })),
  def('update_post', 'write', 'Sửa bài của tôi (chỉ gửi trường cần đổi).', {
    id,
    title: z.string().max(200).optional(),
    content: z.string().min(1).max(20000).optional(),
    tags: z.array(z.string()).max(10).optional(),
    visibility: z.enum(['public', 'followers', 'private']).optional()
  }, (a) => {
    const { id: pid, ...body } = a
    return { method: 'PATCH', path: `/posts/${enc(pid)}`, body }
  }),
  def('delete_post', 'write', 'Xóa bài của tôi.', { id }, (a) => ({ method: 'DELETE', path: `/posts/${enc(a.id)}` }), { destructive: true }),
  def('toggle_like_post', 'write', 'Thích / bỏ thích một bài.', { id }, (a) => ({ method: 'POST', path: `/posts/${enc(a.id)}/like` })),
  def('toggle_bookmark_post', 'write', 'Lưu / bỏ lưu một bài.', { id }, (a) => ({ method: 'POST', path: `/posts/${enc(a.id)}/bookmark` })),
  def('create_comment', 'write', 'Bình luận vào bài (parentId để trả lời một bình luận).', {
    postId: id,
    content: z.string().min(1).max(10000),
    parentId: z.string().optional(),
    isAnonymous: z.boolean().optional()
  }, (a) => ({
    method: 'POST',
    path: `/posts/${enc(a.postId)}/comments`,
    body: { content: a.content, parentId: a.parentId, isAnonymous: a.isAnonymous ?? false, mediaUrls: [] }
  })),
  def('update_comment', 'write', 'Sửa bình luận của tôi.', { id, content: z.string().min(1).max(10000) }, (a) => ({
    method: 'PATCH',
    path: `/comments/${enc(a.id)}`,
    body: { content: a.content }
  })),
  def('delete_comment', 'write', 'Xóa bình luận của tôi.', { id }, (a) => ({ method: 'DELETE', path: `/comments/${enc(a.id)}` }), { destructive: true }),
  def('toggle_like_comment', 'write', 'Thích / bỏ thích bình luận.', { id }, (a) => ({ method: 'POST', path: `/comments/${enc(a.id)}/like` })),
  def('follow_course', 'write', 'Theo dõi một học phần.', { id }, (a) => ({ method: 'PUT', path: `/courses/${enc(a.id)}/follow` })),
  def('unfollow_course', 'write', 'Bỏ theo dõi học phần.', { id }, (a) => ({ method: 'DELETE', path: `/courses/${enc(a.id)}/follow` })),
  def('toggle_join_community', 'write', 'Tham gia / rời một cộng đồng.', { slug: z.string() }, (a) => ({ method: 'POST', path: `/communities/${enc(a.slug)}/join` })),
  def('mark_all_notifications_read', 'write', 'Đánh dấu đã đọc mọi thông báo.', {}, () => ({ method: 'PATCH', path: '/notifications/read-all' })),

  // ── Tài liệu ──
  def('upload_document', 'documents', 'Tải một tệp lên thư viện của tôi (≤ 10MB qua MCP) rồi phân loại/xuất bản. Nội dung dạng text hoặc base64.', {
    filename: z.string().min(1).max(200).describe('Tên tệp kèm đuôi, vd bai-giang.pdf'),
    text: z.string().max(5_000_000).optional().describe('Nội dung văn bản (UTF-8). Dùng cho .md/.txt'),
    base64: z.string().max(14_000_000).optional().describe('Nội dung nhị phân mã hóa base64 (pdf, docx…)'),
    title: z.string().max(200).optional(),
    courseId: z.string().uuid().optional(),
    docCategory: z.enum(DOC_CATEGORIES as [string, ...string[]]).optional(),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/).optional().describe('Dạng 2025-2026'),
    listed: z.boolean().optional().describe('true = công khai trong kho tài liệu (cần courseId + docCategory)')
  }, (a) => {
    if (!a.text && !a.base64) throw new Error('Cần text hoặc base64')
    const data = a.base64 ? Buffer.from(a.base64, 'base64') : Buffer.from(a.text as string, 'utf8')
    if (data.length > 10 * 1024 * 1024) throw new Error('Tệp vượt 10MB')
    const { filename, text: _t, base64: _b, ...classify } = a
    const body = Object.fromEntries(Object.entries(classify).filter(([, v]) => v !== undefined))
    return {
      method: 'POST',
      path: '/documents/upload',
      file: { field: 'file', filename, data, mime: mimeOf(filename) },
      then: Object.keys(body).length
        ? (first) => ({ method: 'PATCH', path: `/documents/${enc(first?.data?.document?.id)}`, body })
        : undefined
    }
  }),
  def('update_document', 'documents', 'Sửa tên / phân loại / công khai của tài liệu tôi sở hữu.', {
    id,
    title: z.string().max(200).optional(),
    courseId: z.string().uuid().nullable().optional(),
    docCategory: z.enum(DOC_CATEGORIES as [string, ...string[]]).nullable().optional(),
    academicYear: z.string().regex(/^\d{4}-\d{4}$/).nullable().optional(),
    listed: z.boolean().optional()
  }, (a) => {
    const { id: did, ...body } = a
    return { method: 'PATCH', path: `/documents/${enc(did)}`, body }
  }),
  def('rate_document', 'documents', 'Chấm tài liệu 1–5 sao.', { id, rating: z.number().int().min(1).max(5) }, (a) => ({
    method: 'PUT',
    path: `/documents/${enc(a.id)}/rating`,
    body: { rating: a.rating }
  })),
  def('delete_document', 'documents', 'Xóa tài liệu của tôi.', { id }, (a) => ({ method: 'DELETE', path: `/documents/${enc(a.id)}` }), { destructive: true }),

  // ── N7AI ──
  def('summarize_post', 'ai', 'N7AI tóm tắt một bài viết (tính 1 lượt hạn mức AI).', { id }, (a) => ({ method: 'POST', path: `/posts/${enc(a.id)}/summary` })),
  def('summarize_document', 'ai', 'N7AI tóm tắt một tài liệu (tính 1 lượt hạn mức AI).', { id }, (a) => ({ method: 'POST', path: `/documents/${enc(a.id)}/summarize` })),
  def('ask_community', 'ai', 'Hỏi N7AI dựa trên bài viết và tài liệu của một cộng đồng bạn là thành viên (1 lượt hạn mức AI).', {
    slug: z.string(),
    question: z.string().min(3).max(500)
  }, (a) => ({ method: 'POST', path: `/communities/${enc(a.slug)}/ask`, body: { question: a.question } })),
  def('list_notes', 'ai', 'Ghi chú N7AI của tôi.', {}, () => ({ method: 'GET', path: '/ai/notes' })),
  def('get_note', 'ai', 'Đọc một ghi chú N7AI.', { id }, (a) => ({ method: 'GET', path: `/ai/notes/${enc(a.id)}` })),
  def('create_note', 'ai', 'Tạo ghi chú N7AI (nội dung Markdown).', {
    title: z.string().max(200).optional(),
    content: z.string().max(200000).optional()
  }, (a) => ({ method: 'POST', path: '/ai/notes', body: a })),
  def('update_note', 'ai', 'Sửa ghi chú N7AI (ghi đè title/content).', {
    id,
    title: z.string().max(200).optional(),
    content: z.string().max(200000).optional(),
    pinned: z.boolean().optional()
  }, (a) => {
    const { id: nid, ...body } = a
    return { method: 'PATCH', path: `/ai/notes/${enc(nid)}`, body }
  }),
  def('append_note', 'ai', 'Nối thêm Markdown vào cuối ghi chú N7AI.', { id, markdown: z.string().min(1).max(200000) }, (a) => ({
    method: 'POST',
    path: `/ai/notes/${enc(a.id)}/append`,
    body: { markdown: a.markdown }
  })),
  def('delete_note', 'ai', 'Xóa ghi chú N7AI.', { id }, (a) => ({ method: 'DELETE', path: `/ai/notes/${enc(a.id)}` }), { destructive: true })
]

export function enc(v: unknown): string {
  return encodeURIComponent(String(v ?? ''))
}

const MIME: Record<string, string> = {
  pdf: 'application/pdf',
  doc: 'application/msword',
  docx: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  ppt: 'application/vnd.ms-powerpoint',
  pptx: 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  xls: 'application/vnd.ms-excel',
  xlsx: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  txt: 'text/plain',
  md: 'text/markdown',
  zip: 'application/zip'
}
function mimeOf(filename: string): string {
  return MIME[filename.split('.').pop()?.toLowerCase() ?? ''] ?? 'application/octet-stream'
}
