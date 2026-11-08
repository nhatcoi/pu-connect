import { z } from 'zod'
import { def, enc, id, type McpToolDef } from './mcp.tools'

// Tool MCP cho admin (key pka_, endpoint /api/mcp/admin). Mỗi tool gọi lại /api/admin/* bằng chính key ⇒ AdminGuard + RBAC vẫn áp dụng.
// Allow-list đường dẫn nằm ở api-keys/api-key.scopes.ts (adminKeyAllows): không có đổi vai trò, xóa người dùng/dữ liệu,
// khóa nhà cung cấp AI, quản lý key, cài đặt hệ thống, xuất CSV.
const page = z.number().int().min(1).max(10000).optional()
const pageSize = z.number().int().min(10).max(100).optional().describe('Mặc định 25')
const q = z.string().max(100).optional()
const reason = z.string().max(255).optional()
const confirm = z.boolean().describe('Phải là true để xác nhận thao tác thay đổi dữ liệu')
const needConfirm = (a: { confirm?: boolean }) => {
  if (a.confirm !== true) throw new Error('Thao tác thay đổi dữ liệu: gọi lại với confirm=true sau khi người dùng đồng ý')
}
// Thao tác ghi: bắt buộc confirm
const write = (name: string, scope: string, description: string, input: z.ZodRawShape, call: McpToolDef['call'], destructive = false) =>
  def(name, scope, description, { ...input, confirm }, (a) => {
    needConfirm(a)
    const { confirm: _c, ...rest } = a
    return call(rest)
  }, { destructive })
const read = (name: string, description: string, input: z.ZodRawShape, call: McpToolDef['call']) => def(name, 'admin_read', description, input, call)

export const MCP_ADMIN_TOOLS: McpToolDef[] = [
  // ── Đọc ──
  read('admin_stats', 'Số liệu tổng quan hệ thống.', {}, () => ({ method: 'GET', path: '/admin/stats' })),
  read('admin_reports', 'Báo cáo bài viết (mặc định đang chờ).', {
    status: z.enum(['pending', 'resolved']).optional(), reason: z.enum(['spam', 'exam_leak', 'harassment', 'inaccurate_info', 'other']).optional(), q, page, pageSize
  }, (a) => ({ method: 'GET', path: '/admin/reports', query: a })),
  read('admin_comment_reports', 'Báo cáo bình luận.', { status: z.enum(['pending', 'resolved']).optional(), page, pageSize }, (a) => ({ method: 'GET', path: '/admin/comment-reports', query: a })),
  read('admin_posts', 'Danh sách bài viết để kiểm duyệt.', {
    q, filter: z.enum(['pinned', 'hidden', 'qna_unsolved', 'reported']).optional(), sort: z.enum(['recent', 'likes', 'comments', 'views', 'reports']).optional(), page, pageSize
  }, (a) => ({ method: 'GET', path: '/admin/posts', query: a })),
  read('admin_comments', 'Danh sách bình luận.', { q, page, pageSize }, (a) => ({ method: 'GET', path: '/admin/comments', query: a })),
  read('admin_users', 'Danh sách người dùng (lọc, phân trang).', {
    q, role: z.string().optional(), status: z.enum(['active', 'suspended', 'restricted']).optional(), verified: z.enum(['yes', 'no']).optional(),
    reported: z.enum(['yes']).optional(), risk: z.enum(['high', 'medium']).optional(), page, pageSize
  }, (a) => ({ method: 'GET', path: '/admin/users', query: a })),
  read('admin_users_summary', 'Thống kê người dùng theo trạng thái.', {}, () => ({ method: 'GET', path: '/admin/users/summary' })),
  read('admin_user', 'Chi tiết một người dùng.', { id }, (a) => ({ method: 'GET', path: `/admin/users/${enc(a.id)}` })),
  read('admin_user_insight', 'Phân tích rủi ro / hoạt động của một người dùng (được ghi nhật ký).', { id }, (a) => ({ method: 'GET', path: `/admin/users/${enc(a.id)}/insight` })),
  read('admin_user_security', 'Sự kiện bảo mật của một người dùng.', { id }, (a) => ({ method: 'GET', path: `/admin/users/${enc(a.id)}/security` })),
  read('admin_ai_overview', 'Tổng quan vận hành N7AI (lượt dùng, lỗi, ticket).', {}, () => ({ method: 'GET', path: '/admin/ai/overview' })),
  read('admin_ai_skills', 'Danh sách kỹ năng N7AI người dùng tạo.', { q, page, pageSize }, (a) => ({ method: 'GET', path: '/admin/ai/skills', query: a })),
  read('admin_courses', 'Danh sách học phần.', { q, page, pageSize }, (a) => ({ method: 'GET', path: '/admin/courses', query: a })),
  read('admin_documents', 'Danh sách tài liệu.', { q, page, pageSize }, (a) => ({ method: 'GET', path: '/admin/documents', query: a })),
  read('admin_communities', 'Danh sách cộng đồng (gồm đang chờ duyệt).', { q, page, pageSize }, (a) => ({ method: 'GET', path: '/admin/communities', query: a })),
  read('admin_user_reports', 'Báo cáo người dùng.', { page, pageSize }, (a) => ({ method: 'GET', path: '/admin/user-reports', query: a })),
  read('admin_audit_logs', 'Nhật ký thao tác của admin.', { page, pageSize }, (a) => ({ method: 'GET', path: '/admin/audit-logs', query: a })),
  read('admin_security_events', 'Sự kiện bảo mật toàn hệ thống.', { page, pageSize }, (a) => ({ method: 'GET', path: '/admin/security-events', query: a })),
  read('admin_search_top', 'Từ khóa tìm kiếm nhiều nhất.', {}, () => ({ method: 'GET', path: '/admin/search/top' })),
  read('admin_search_zero_results', 'Từ khóa tìm không ra kết quả.', {}, () => ({ method: 'GET', path: '/admin/search/zero-results' })),
  read('admin_ops_trends', 'Xu hướng hoạt động.', {}, () => ({ method: 'GET', path: '/admin/ops/trends' })),
  read('admin_ops_inbox', 'Hộp việc cần xử lý của admin.', {}, () => ({ method: 'GET', path: '/admin/ops/inbox' })),
  read('admin_ops_verification', 'Hàng chờ xác thực sinh viên.', {}, () => ({ method: 'GET', path: '/admin/ops/verification' })),
  read('admin_ops_sanctions', 'Danh sách xử phạt đang hiệu lực.', {}, () => ({ method: 'GET', path: '/admin/ops/sanctions' })),
  read('admin_ops_study_groups', 'Nhóm học.', {}, () => ({ method: 'GET', path: '/admin/ops/study-groups' })),
  read('admin_ops_chat_reports', 'Báo cáo tin nhắn.', {}, () => ({ method: 'GET', path: '/admin/ops/chat' })),
  read('admin_ops_health', 'Tình trạng hệ thống.', {}, () => ({ method: 'GET', path: '/admin/ops/health' })),
  read('admin_ops_storage', 'Dung lượng lưu trữ.', {}, () => ({ method: 'GET', path: '/admin/ops/storage' })),

  // ── Kiểm duyệt ──
  write('admin_hide_post', 'admin_moderate', 'Ẩn một bài viết.', { id, reason }, (a) => ({ method: 'POST', path: `/admin/posts/${enc(a.id)}/hide`, body: { reason: a.reason } })),
  write('admin_unhide_post', 'admin_moderate', 'Hiện lại bài viết đã ẩn.', { id }, (a) => ({ method: 'POST', path: `/admin/posts/${enc(a.id)}/unhide`, body: {} })),
  write('admin_pin_post', 'admin_moderate', 'Ghim / bỏ ghim bài viết toàn hệ thống.', { id, isPinned: z.boolean() }, (a) => ({ method: 'POST', path: `/admin/posts/${enc(a.id)}/pin`, body: { isPinned: a.isPinned } })),
  write('admin_dismiss_post_reports', 'admin_moderate', 'Bỏ qua mọi báo cáo của một bài (bài không vi phạm).', { id }, (a) => ({ method: 'POST', path: `/admin/posts/${enc(a.id)}/dismiss-reports`, body: {} })),
  write('admin_delete_comment', 'admin_moderate', 'Xóa một bình luận vi phạm.', { id, reason }, (a) => ({ method: 'DELETE', path: `/admin/comments/${enc(a.id)}`, body: { reason: a.reason } }), true),
  write('admin_resolve_user_reports', 'admin_moderate', 'Xử lý báo cáo người dùng.', {
    ids: z.array(z.string().uuid()).min(1).max(20), resolution: z.enum(['actioned', 'dismissed'])
  }, (a) => ({ method: 'POST', path: '/admin/user-reports/resolve', body: { ids: a.ids, resolution: a.resolution } })),
  write('admin_approve_community', 'admin_moderate', 'Duyệt cộng đồng đang chờ.', { id }, (a) => ({ method: 'POST', path: `/admin/communities/${enc(a.id)}/approve`, body: {} })),
  write('admin_reject_community', 'admin_moderate', 'Từ chối cộng đồng đang chờ.', { id, note: z.string().max(500).optional() }, (a) => ({ method: 'POST', path: `/admin/communities/${enc(a.id)}/reject`, body: { note: a.note } })),

  // ── Người dùng ──
  write('admin_suspend_user', 'admin_users', 'Khóa tài khoản.', { id, reason }, (a) => ({ method: 'POST', path: `/admin/users/${enc(a.id)}/suspend`, body: { reason: a.reason } }), true),
  write('admin_unsuspend_user', 'admin_users', 'Mở khóa tài khoản.', { id }, (a) => ({ method: 'POST', path: `/admin/users/${enc(a.id)}/unsuspend`, body: {} })),
  write('admin_sanction_user', 'admin_users', 'Cảnh cáo / hạn chế / đình chỉ có thời hạn.', {
    id, kind: z.enum(['warning', 'restrict', 'suspend']), durationDays: z.number().int().min(1).max(365).nullable().optional(), reason: z.string().min(3).max(255)
  }, (a) => ({ method: 'POST', path: `/admin/users/${enc(a.id)}/sanctions`, body: { kind: a.kind, durationDays: a.durationDays, reason: a.reason } }), true),
  write('admin_revoke_sanction', 'admin_users', 'Gỡ một xử phạt.', { id, sanctionId: z.string().regex(/^\d+$/) }, (a) => ({ method: 'DELETE', path: `/admin/users/${enc(a.id)}/sanctions/${enc(a.sanctionId)}` })),
  write('admin_verify_user', 'admin_users', 'Xác thực / bỏ xác thực sinh viên.', { id, isVerified: z.boolean() }, (a) => ({ method: 'PATCH', path: `/admin/users/${enc(a.id)}/verify`, body: { isVerified: a.isVerified } })),
  write('admin_add_user_note', 'admin_users', 'Thêm ghi chú nội bộ về người dùng.', { id, body: z.string().min(1).max(1000) }, (a) => ({ method: 'POST', path: `/admin/users/${enc(a.id)}/notes`, body: { body: a.body } })),

  // ── Học vụ ──
  write('admin_create_course', 'admin_academic', 'Tạo học phần.', {
    code: z.string().min(2).max(20), name: z.string().min(3).max(150), credits: z.number().int().min(1).max(15).optional(),
    fieldId: z.string().uuid().nullable().optional(), description: z.string().max(2000).nullable().optional(), syllabusUrl: z.string().max(500).nullable().optional()
  }, (a) => ({ method: 'POST', path: '/admin/courses', body: a })),
  write('admin_update_course', 'admin_academic', 'Sửa học phần (gửi đủ code và name).', {
    id, code: z.string().min(2).max(20), name: z.string().min(3).max(150), credits: z.number().int().min(1).max(15).optional(),
    fieldId: z.string().uuid().nullable().optional(), description: z.string().max(2000).nullable().optional(), syllabusUrl: z.string().max(500).nullable().optional()
  }, (a) => {
    const { id: cid, ...body } = a
    return { method: 'PATCH', path: `/admin/courses/${enc(cid)}`, body }
  }),
  write('admin_set_study_group_status', 'admin_academic', 'Đổi trạng thái nhóm học.', { id, status: z.string().min(2).max(30) }, (a) => ({ method: 'PATCH', path: `/admin/ops/study-groups/${enc(a.id)}/status`, body: { status: a.status } }))
]
