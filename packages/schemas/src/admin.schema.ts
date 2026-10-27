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
  'ai:read', // Xem telemetry N7AI, token, latency, phản hồi 👍/👎, skills
  'ai:manage', // Xử lý ticket hỗ trợ N7AI, gỡ/vô hiệu hóa skill công khai vi phạm
  'academic:read', // Xem danh mục môn học, tài liệu RAG, cộng đồng
  'academic:manage', // Tạo/sửa môn học, xóa tài liệu vi phạm
  'search:read', // Xem phân tích tìm kiếm (Zero-result & Top queries)
  'system:broadcast', // Phát thông báo hệ thống toàn trường / theo nhóm vai trò
  'bots:manage', // Điều khiển Bot Simulator (bật/tắt, tốc độ, lệnh thủ công)
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
  'ai:read': { label: 'Xem Telemetry & Phản hồi N7AI', group: 'N7AI Ops' },
  'ai:manage': { label: 'Xử lý Ticket AI & Kiểm duyệt Skill', group: 'N7AI Ops' },
  'academic:read': { label: 'Xem Môn học, Tài liệu & Cộng đồng', group: 'Học thuật' },
  'academic:manage': { label: 'Thêm/sửa Môn học & Xóa Tài liệu', group: 'Học thuật' },
  'search:read': { label: 'Xem xu hướng & từ khóa tìm trống', group: 'Hệ thống' },
  'system:broadcast': { label: 'Gửi thông báo hệ thống', group: 'Hệ thống' },
  'bots:manage': { label: 'Điều khiển Bot Simulator', group: 'Hệ thống' },
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

// Thông báo hệ thống: đối tượng, hẹn giờ, banner
export interface AdminAnnouncementAudience {
  roles?: AdminUserRole[]
  unitIds?: string[]
  years?: string[]
}

export interface AdminAnnouncement {
  id: string
  title: string
  message: string
  link: string | null
  audience: AdminAnnouncementAudience
  sendInApp: boolean
  banner: boolean
  bannerUntil: string | null
  status: 'scheduled' | 'sent' | 'cancelled'
  scheduledAt: string
  sentAt: string | null
  recipientsCount: number | null
  createdBy: string | null
  createdAt: string
}

export interface AdminAnnouncementInput {
  title: string
  message: string
  link?: string | null
  audience: AdminAnnouncementAudience
  sendInApp: boolean
  banner: boolean
  bannerUntil?: string | null
  scheduledAt?: string | null
}

// Banner hiện cho người dùng trên web
export interface AdminAnnouncementBanner {
  id: string
  title: string
  message: string
  link: string | null
}

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

// Báo cáo bình luận gom theo bình luận
export interface AdminReportedComment {
  commentId: string
  postId: string
  postTitle: string | null
  content: string
  createdAt: string
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
  authProviders: AdminAuthProvider[]
  // Chế tài đang hiệu lực
  suspendedUntil: string | null // null + status=suspended ⇒ vĩnh viễn
  isRestricted: boolean
  restrictedUntil: string | null // null + isRestricted ⇒ vô thời hạn
  restrictedReason: string | null
  riskScore: number
  riskFactors: { key: string; label: string; points: number }[]
}

// ── Chế tài theo bậc: cảnh cáo → hạn chế (chỉ đọc) → khóa có thời hạn → vĩnh viễn ──
export const SANCTION_KINDS = ['warning', 'restrict', 'suspend'] as const
export type SanctionKind = (typeof SANCTION_KINDS)[number]
export const SANCTION_DURATIONS = [1, 3, 7, 14, 30, 90] as const

export interface AdminSanction {
  id: string
  kind: SanctionKind
  reason: string | null
  startsAt: string
  endsAt: string | null
  revokedAt: string | null
  active: boolean
  admin: { username: string; displayName: string } | null
  revokedBy: { username: string } | null
}

// Bậc đề xuất theo số lần vi phạm (180 ngày gần nhất, không tính bản đã hủy)
export interface SanctionRecommendation {
  strikes: number
  kind: SanctionKind
  durationDays: number | null // null: cảnh cáo hoặc vĩnh viễn (khi kind = suspend)
}

export const SanctionInputSchema = z.object({
  kind: z.enum(SANCTION_KINDS),
  durationDays: z.number().int().min(1).max(365).nullable().optional(),
  reason: z.string().trim().min(3, 'Nhập lý do (≥ 3 ký tự)').max(255)
})
export type SanctionInput = z.infer<typeof SanctionInputSchema>

// ── Quản lý người dùng nâng cao: phân trang server, lọc, sắp xếp, hàng loạt ──

export type AdminAuthProvider = 'password' | 'google'
export const ADMIN_USER_SORTS = ['created', 'last_seen', 'reputation', 'posts', 'reports', 'name', 'risk'] as const
export type AdminUserSort = (typeof ADMIN_USER_SORTS)[number]
export const ADMIN_USER_ACTIVITY = ['online', '24h', '7d', '30d', 'dormant', 'never'] as const
export type AdminUserActivity = (typeof ADMIN_USER_ACTIVITY)[number]
export const ADMIN_USER_JOINED = ['24h', '7d', '30d', '90d'] as const
export type AdminUserJoined = (typeof ADMIN_USER_JOINED)[number]

// Tham số lọc danh sách (đồng bộ với URL #/users?...)
export interface AdminUserQuery {
  q?: string
  role?: AdminUserRole
  status?: 'active' | 'suspended' | 'restricted'
  verified?: 'yes' | 'no'
  auth?: AdminAuthProvider
  activity?: AdminUserActivity
  joined?: AdminUserJoined
  faculty?: string
  unit?: string
  reported?: 'yes'
  risk?: 'high' | 'medium'
  sort?: AdminUserSort
  dir?: 'asc' | 'desc'
  page?: number
  pageSize?: number
}

// Trang dữ liệu phân trang server dùng chung cho mọi danh sách admin
export interface AdminPage<T> {
  items: T[]
  total: number
  page: number
  pageSize: number
  // Giá trị cho bộ lọc (VD: danh sách khoa, loại tài liệu) kèm số lượng
  facets?: Record<string, { value: string; count: number }[]>
}

export type AdminUserPage = AdminPage<AdminUserRow>

// ── Thao tác hàng loạt cho nội dung ──
export const ADMIN_BULK_POST_ACTIONS = ['hide', 'unhide', 'pin', 'unpin', 'dismiss'] as const
export type AdminBulkPostAction = (typeof ADMIN_BULK_POST_ACTIONS)[number]
export interface AdminBulkPostInput {
  ids: string[]
  action: AdminBulkPostAction
  reason?: string
}
export interface AdminBulkCommentInput {
  ids: string[]
  action: 'delete' | 'dismiss'
  reason?: string
}

// Số liệu nhanh cho thanh "phân khúc" đầu trang + giá trị cho bộ lọc
export interface AdminUserSummary {
  total: number
  online: number
  active24h: number
  new7d: number
  verified: number
  suspended: number
  restricted: number
  highRisk: number
  reported: number
  dormant: number
  byRole: Partial<Record<AdminUserRole, number>>
  faculties: { faculty: string; count: number }[]
}

export interface AdminUserNote {
  id: string
  body: string
  createdAt: string
  author: { username: string; displayName: string } | null
}

// Hồ sơ đầy đủ trong ngăn chi tiết (drawer)
export interface AdminUserDetail {
  user: AdminUserRow & {
    bio: string | null
    major: string | null
    className: string | null
    academicYear: string | null
    verifiedAt: string | null
  }
  stats: {
    posts: number
    hiddenPosts: number
    comments: number
    documents: number
    followers: number
    following: number
    reportsReceived: number
    reportsFiled: number
    activeSessions: number
    aiRuns30d: number
  }
  recentPosts: { id: string; title: string | null; content: string; createdAt: string; hiddenAt: string | null; likes: number; comments: number }[]
  moderationLog: AdminAuditLog[]
  notes: AdminUserNote[]
  sanctions: AdminSanction[]
  recommendation: SanctionRecommendation
}

export const ADMIN_BULK_USER_ACTIONS = ['verify', 'unverify', 'warn', 'restrict', 'unrestrict', 'suspend', 'unsuspend', 'revoke_sessions', 'send_reset', 'force_reset', 'set_role'] as const
export type AdminBulkUserAction = (typeof ADMIN_BULK_USER_ACTIONS)[number]

export const AdminBulkUserSchema = z.object({
  ids: z.array(z.string().uuid()).min(1).max(100),
  action: z.enum(ADMIN_BULK_USER_ACTIONS),
  role: z.enum(USER_ROLES).optional(),
  reason: z.string().trim().max(255).optional(),
  // Thời hạn cho restrict / suspend (bỏ trống = vô thời hạn)
  durationDays: z.number().int().min(1).max(365).nullable().optional()
})
export type AdminBulkUserInput = z.infer<typeof AdminBulkUserSchema>

export interface AdminBulkResult {
  affected: number
  skipped: number
}

export const AdminUserNoteSchema = z.object({
  body: z.string().trim().min(1, 'Nhập nội dung ghi chú').max(1000)
})
export type AdminUserNoteInput = z.infer<typeof AdminUserNoteSchema>

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

export interface AdminCourseLecturer {
  id: string
  username: string
  displayName: string
  avatarUrl: string | null
  role: AdminUserRole
}

export interface AdminCourseImportResult {
  created: number
  updated: number
  errors: { row: number; message: string }[]
  applied: boolean
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
