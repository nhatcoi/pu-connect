import { z } from 'zod'

// ── 1. Phân quyền quản trị (RBAC — Role-Based Access Control) ──────────────

export const USER_ROLES = ['student', 'lecturer', 'ta', 'club_lead', 'admin'] as const
export type AdminUserRole = (typeof USER_ROLES)[number]

export const ADMIN_PERMISSIONS = [
  'dashboard:view', // Xem tổng quan hệ thống (Command Center)
  'moderation:read', // Xem báo cáo vi phạm, danh sách bài viết & bình luận
  'moderation:write', // Ẩn/hiện/ghim bài viết, xóa bình luận, xử lý báo cáo
  'users:read', // Xem danh sách người dùng & trạng thái
  'users:suspend', // Khóa/mở khóa tài khoản, thu hồi phiên đăng nhập
  'users:role', // Phân quyền vai trò (student / ta / lecturer / club_lead / admin)
  'users:verify', // Cấp/thu hồi tích xanh xác thực (is_verified)
  'users:insight', // Xem dữ liệu cá nhân hóa & hành vi (nhạy cảm, có ghi audit log)
  'ai:read', // Xem telemetry PU AI, token, latency, phản hồi 👍/👎, skills
  'ai:manage', // Xử lý ticket hỗ trợ PU AI, gỡ/vô hiệu hóa skill công khai vi phạm
  'academic:read', // Xem danh mục môn học, tài liệu RAG, cộng đồng
  'academic:manage', // Tạo/sửa môn học, xóa tài liệu vi phạm
  'search:read', // Xem phân tích tìm kiếm (Zero-result & Top queries)
  'system:broadcast', // Phát thông báo hệ thống toàn trường / theo nhóm vai trò
  'audit:read' // Xem nhật ký kiểm toán bảo mật (admin_audit_logs)
] as const

export type AdminPermission = (typeof ADMIN_PERMISSIONS)[number]

// Quyền cổng Admin (admin-puc.vnhat.dev) — chỉ Super Admin truy cập
export const ROLE_PERMISSIONS: Record<AdminUserRole, readonly AdminPermission[]> = {
  admin: ADMIN_PERMISSIONS,
  lecturer: [],
  ta: [],
  club_lead: [],
  student: []
}

export const ADMIN_ROLE_LABELS: Record<AdminUserRole, { label: string; badgeColor: string; description: string }> = {
  admin: {
    label: 'Quản trị viên (Super Admin)',
    badgeColor: 'red',
    description: 'Toàn quyền điều hành hệ thống, phân quyền RBAC, khóa tài khoản, AI Ops, phát thông báo và xem nhật ký kiểm toán.'
  },
  lecturer: {
    label: 'Giảng viên',
    badgeColor: 'blue',
    description: 'Giảng dạy & chia sẻ học thuật trên cổng người dùng (không truy cập cổng Admin).'
  },
  ta: {
    label: 'Trợ giảng',
    badgeColor: 'emerald',
    description: 'Hỗ trợ học phần trên cổng người dùng (không truy cập cổng Admin).'
  },
  club_lead: {
    label: 'Chủ nhiệm CLB',
    badgeColor: 'amber',
    description: 'Quản lý hoạt động CLB trên cổng người dùng (không truy cập cổng Admin).'
  },
  student: {
    label: 'Sinh viên',
    badgeColor: 'slate',
    description: 'Thành viên tiêu chuẩn trên mạng xã hội học thuật PU Connector.'
  }
}

export const ADMIN_PERMISSION_META: Record<AdminPermission, { label: string; group: string }> = {
  'dashboard:view': { label: 'Xem Dashboard tổng quan', group: 'Tổng quan' },
  'moderation:read': { label: 'Xem báo cáo & nội dung', group: 'Kiểm duyệt' },
  'moderation:write': { label: 'Ẩn/ghim bài, xóa bình luận, xử lý báo cáo', group: 'Kiểm duyệt' },
  'users:read': { label: 'Xem danh sách người dùng', group: 'Người dùng & RBAC' },
  'users:suspend': { label: 'Khóa tài khoản & thu hồi phiên', group: 'Người dùng & RBAC' },
  'users:role': { label: 'Thay đổi vai trò (RBAC)', group: 'Người dùng & RBAC' },
  'users:verify': { label: 'Cấp tích xanh xác thực', group: 'Người dùng & RBAC' },
  'users:insight': { label: 'Xem dữ liệu cá nhân hóa (Audited)', group: 'Người dùng & RBAC' },
  'ai:read': { label: 'Xem Telemetry & Phản hồi PU AI', group: 'PU AI Ops' },
  'ai:manage': { label: 'Xử lý Ticket AI & Kiểm duyệt Skill', group: 'PU AI Ops' },
  'academic:read': { label: 'Xem Môn học, Tài liệu & Cộng đồng', group: 'Học thuật' },
  'academic:manage': { label: 'Thêm/sửa Môn học & Xóa Tài liệu', group: 'Học thuật' },
  'search:read': { label: 'Xem xu hướng & từ khóa tìm trống', group: 'Hệ thống' },
  'system:broadcast': { label: 'Gửi thông báo hệ thống', group: 'Hệ thống' },
  'audit:read': { label: 'Xem nhật ký kiểm toán (Audit Log)', group: 'Hệ thống' }
}

export function hasAdminPermission(role: string | undefined | null, permission: AdminPermission): boolean {
  if (!role || !(role in ROLE_PERMISSIONS)) return false
  return ROLE_PERMISSIONS[role as AdminUserRole].includes(permission)
}

export function canAccessAdminPortal(role: string | undefined | null): boolean {
  return hasAdminPermission(role, 'dashboard:view')
}

// ── 2. Zod Input Schemas ───────────────────────────────────────────────────

export const AdminReasonSchema = z.object({
  reason: z.string().trim().max(255).optional()
})
export type AdminReasonInput = z.infer<typeof AdminReasonSchema>

export const AdminUpdateRoleSchema = z.object({
  role: z.enum(USER_ROLES),
  reason: z.string().trim().max(255).optional()
})
export type AdminUpdateRoleInput = z.infer<typeof AdminUpdateRoleSchema>

export const AdminVerifyUserSchema = z.object({
  isVerified: z.boolean()
})
export type AdminVerifyUserInput = z.infer<typeof AdminVerifyUserSchema>

export const AdminPinPostSchema = z.object({
  isPinned: z.boolean()
})
export type AdminPinPostInput = z.infer<typeof AdminPinPostSchema>

export const AdminTicketStatusSchema = z.object({
  status: z.enum(['open', 'resolved', 'closed'])
})
export type AdminTicketStatusInput = z.infer<typeof AdminTicketStatusSchema>

export const AdminModerateSkillSchema = z.object({
  isPublic: z.boolean().optional(),
  enabled: z.boolean().optional(),
  reason: z.string().trim().max(255).optional()
})
export type AdminModerateSkillInput = z.infer<typeof AdminModerateSkillSchema>

export const AdminCourseInputSchema = z.object({
  code: z
    .string()
    .trim()
    .toUpperCase()
    .min(2, 'Mã môn tối thiểu 2 ký tự')
    .max(20, 'Mã môn tối đa 20 ký tự')
    .regex(/^[A-Z0-9_-]+$/, 'Mã môn chỉ gồm chữ in hoa, số, gạch ngang/dưới'),
  name: z.string().trim().min(3, 'Tên môn tối thiểu 3 ký tự').max(150),
  credits: z.number().int().min(1).max(15).default(3),
  facultyCode: z.string().trim().min(1, 'Chọn mã khoa/viện').max(30),
  description: z.string().trim().max(2000).optional().nullable(),
  syllabusUrl: z.string().trim().max(500).optional().nullable()
})
export type AdminCourseInput = z.infer<typeof AdminCourseInputSchema>

export const AdminBroadcastInputSchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(120),
  message: z.string().trim().min(5, 'Nội dung tối thiểu 5 ký tự').max(500),
  link: z.string().trim().max(255).optional().nullable(),
  targetRole: z.enum(['all', ...USER_ROLES]).default('all')
})
export type AdminBroadcastInput = z.infer<typeof AdminBroadcastInputSchema>

// ── 3. Response Interfaces ─────────────────────────────────────────────────

export interface AdminSessionInfo {
  user: {
    id: string
    username: string
    displayName: string
    email: string
    avatarUrl: string | null
    role: AdminUserRole
  }
  permissions: AdminPermission[]
}

export interface AdminStats {
  pendingReports: number
  reportedPosts: number
  hiddenPosts: number
  totalPosts: number
  totalComments: number
  totalUsers: number
  suspendedUsers: number
  newUsers7d: number
  activeUsers24h: number
  verifiedUsers: number
  totalDocuments: number
  totalCourses: number
  totalCommunities: number
  totalStudyGroups: number
  aiRuns24h: number
  aiErrorRuns24h: number
  aiTokens24h: number
  aiAvgLatencyMs24h: number
  openSupportTickets: number
  roleDistribution: { role: AdminUserRole; count: number }[]
}

export interface AdminReportedPost {
  postId: string
  title: string
  content: string
  createdAt: string
  hiddenAt: string | null
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; status: string }
  reportCount: number
  reasons: { reason: string; count: number }[]
  details: string[]
  lastReportedAt: string
}

export interface AdminPostRow {
  id: string
  title: string | null
  content: string
  postType: string
  tags: string[]
  isPinned: boolean
  isResolved: boolean
  likesCount: number
  commentsCount: number
  viewsCount: number
  reportCount: number
  hiddenAt: string | null
  hiddenReason: string | null
  createdAt: string
  courseCode: string | null
  communityName: string | null
  author: { id: string; username: string; displayName: string; avatarUrl: string | null; role: string }
}

export interface AdminCommentRow {
  id: string
  postId: string
  postTitle: string | null
  content: string
  likesCount: number
  isSolution: boolean
  createdAt: string
  author: { id: string; username: string; displayName: string; avatarUrl: string | null }
}

export interface AdminUserRow {
  id: string
  username: string
  displayName: string
  email: string
  avatarUrl: string | null
  role: AdminUserRole
  status: string
  isVerified: boolean
  studentId: string | null
  faculty: string | null
  reputationPoints: number
  suspendedAt: string | null
  suspendedReason: string | null
  postCount: number
  reportCount: number
  lastSeenAt: string | null
  createdAt: string
}

export interface AdminAuditLog {
  id: string
  action: string
  targetType: string
  targetId: string
  details: Record<string, unknown> | null
  createdAt: string
  admin: { id: string; username: string; displayName: string; role?: string } | null
}

export interface ZeroResultQuery {
  query: string
  count: number
  lastSearchedAt: string
}

export interface TopSearchQuery {
  query: string
  count: number
  avgResults: number
  lastSearchedAt: string
}

export interface AdminAiOverview {
  runs24h: number
  runs7d: number
  errorRuns24h: number
  inputTokens24h: number
  outputTokens24h: number
  avgLatencyMs24h: number
  activeTasksCount: number
  publicSkillsCount: number
  dailySeries: { date: string; runs: number; errors: number; tokens: number }[]
  byTask: { task: string; count: number; avgLatencyMs: number; errors: number }[]
  recentErrors: {
    id: string
    task: string
    model: string | null
    error: string | null
    latencyMs: number | null
    createdAt: string
    requesterUsername: string | null
  }[]
  topUsers7d: {
    userId: string
    username: string
    displayName: string
    runs: number
    tokens: number
  }[]
}

export interface AdminAiSkillRow {
  id: string
  slug: string
  name: string
  description: string | null
  isPublic: boolean
  enabled: boolean
  installCount: number
  useCount: number
  createdAt: string
  owner: { id: string; username: string; displayName: string }
}

export interface AdminCourseRow {
  id: string
  code: string
  name: string
  credits: number
  facultyCode: string | null
  description: string | null
  syllabusUrl: string | null
  documentCount: number
  postCount: number
  ratingAvg: number
  createdAt: string
}

export interface AdminDocumentRow {
  id: string
  title: string
  docType: string
  fileUrl: string
  fileSize: number
  mimeType: string | null
  downloadCount: number
  viewCount: number
  chunkCount: number
  courseCode: string | null
  createdAt: string
  owner: { id: string; username: string; displayName: string }
}

export interface AdminCommunityRow {
  id: string
  slug: string
  name: string
  description: string | null
  communityType: string
  membersCount: number
  postsCount: number
  createdAt: string
}
