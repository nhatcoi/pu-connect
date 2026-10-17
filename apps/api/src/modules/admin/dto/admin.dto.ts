import { z } from 'zod'
import type {
  AdminBroadcastInput,
  AdminBulkUserInput,
  AdminCourseInput,
  AdminModerateSkillInput,
  AdminPermission,
  AdminPinPostInput,
  AdminReasonInput,
  AdminTicketStatusInput,
  AdminUpdateRoleInput,
  AdminUserNoteInput,
  AdminUserQuery,
  AdminUserRole,
  AdminVerifyUserInput
} from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema/constant runtime ở đây (xem auth/dto/register.dto.ts)

export const USER_ROLES_RUNTIME = ['student', 'lecturer', 'ta', 'club_lead', 'admin'] as const

export const ADMIN_PERMISSIONS_RUNTIME: readonly AdminPermission[] = [
  'dashboard:view',
  'moderation:read',
  'moderation:write',
  'users:read',
  'users:suspend',
  'users:role',
  'users:verify',
  'users:insight',
  'ai:read',
  'ai:manage',
  'academic:read',
  'academic:manage',
  'search:read',
  'system:broadcast',
  'audit:read'
]

export const ROLE_PERMISSIONS_RUNTIME: Record<AdminUserRole, readonly AdminPermission[]> = {
  admin: ADMIN_PERMISSIONS_RUNTIME,
  // Cổng admin chỉ dành cho Super Admin (2026-10-17)
  lecturer: [],
  ta: [],
  club_lead: [],
  student: []
}

export function getRolePermissions(role: string | undefined | null): AdminPermission[] {
  if (!role || !(role in ROLE_PERMISSIONS_RUNTIME)) return []
  return [...ROLE_PERMISSIONS_RUNTIME[role as AdminUserRole]]
}

export function hasRolePermission(role: string | undefined | null, permission: AdminPermission): boolean {
  return getRolePermissions(role).includes(permission)
}

export const AdminReasonBodySchema = z.object({
  reason: z.string().trim().max(255).optional()
})

export const AdminUpdateRoleBodySchema = z.object({
  role: z.enum(USER_ROLES_RUNTIME),
  reason: z.string().trim().max(255).optional()
})

export const AdminVerifyUserBodySchema = z.object({
  isVerified: z.boolean()
})

export const AdminPinPostBodySchema = z.object({
  isPinned: z.boolean()
})

export const AdminTicketStatusBodySchema = z.object({
  status: z.enum(['open', 'resolved', 'closed'])
})

export const AdminModerateSkillBodySchema = z.object({
  isPublic: z.boolean().optional(),
  enabled: z.boolean().optional(),
  reason: z.string().trim().max(255).optional()
})

export const AdminCourseBodySchema = z.object({
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

export const AdminBroadcastBodySchema = z.object({
  title: z.string().trim().min(3, 'Tiêu đề tối thiểu 3 ký tự').max(120),
  message: z.string().trim().min(5, 'Nội dung tối thiểu 5 ký tự').max(500),
  link: z.string().trim().max(255).optional().nullable(),
  targetRole: z.enum(['all', ...USER_ROLES_RUNTIME]).default('all')
})

// ── Danh sách người dùng: query string → tham số đã chuẩn hóa ──
const optEnum = <T extends readonly [string, ...string[]]>(values: T) =>
  z.preprocess((v) => (v === '' || v === undefined ? undefined : v), z.enum(values).optional())

export const AdminUserQuerySchema = z.object({
  q: z.string().trim().max(100).optional(),
  role: optEnum(USER_ROLES_RUNTIME),
  status: optEnum(['active', 'suspended'] as const),
  verified: optEnum(['yes', 'no'] as const),
  auth: optEnum(['password', 'google'] as const),
  activity: optEnum(['online', '24h', '7d', '30d', 'dormant', 'never'] as const),
  joined: optEnum(['24h', '7d', '30d', '90d'] as const),
  faculty: z.string().trim().max(50).optional(),
  reported: optEnum(['yes'] as const),
  sort: optEnum(['created', 'last_seen', 'reputation', 'posts', 'reports', 'name'] as const).default('created'),
  dir: optEnum(['asc', 'desc'] as const).default('desc'),
  page: z.coerce.number().int().min(1).max(10_000).default(1),
  pageSize: z.coerce.number().int().min(10).max(100).default(25)
})
export type AdminUserQueryParsed = z.infer<typeof AdminUserQuerySchema>

export const AdminBulkUserBodySchema = z
  .object({
    ids: z.array(z.string().uuid()).min(1).max(100),
    action: z.enum(['verify', 'unverify', 'suspend', 'unsuspend', 'revoke_sessions', 'set_role']),
    role: z.enum(USER_ROLES_RUNTIME).optional(),
    reason: z.string().trim().max(255).optional()
  })
  .refine((b) => b.action !== 'set_role' || !!b.role, { message: 'Chọn vai trò mới', path: ['role'] })

export const AdminUserNoteBodySchema = z.object({
  body: z.string().trim().min(1, 'Nhập nội dung ghi chú').max(1000)
})

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _checkReason: AdminReasonInput = {} as z.infer<typeof AdminReasonBodySchema>
const _checkRole: AdminUpdateRoleInput = {} as z.infer<typeof AdminUpdateRoleBodySchema>
const _checkVerify: AdminVerifyUserInput = {} as z.infer<typeof AdminVerifyUserBodySchema>
const _checkPin: AdminPinPostInput = {} as z.infer<typeof AdminPinPostBodySchema>
const _checkTicket: AdminTicketStatusInput = {} as z.infer<typeof AdminTicketStatusBodySchema>
const _checkSkill: AdminModerateSkillInput = {} as z.infer<typeof AdminModerateSkillBodySchema>
const _checkCourse: AdminCourseInput = {} as z.infer<typeof AdminCourseBodySchema>
const _checkBroadcast: AdminBroadcastInput = {} as z.infer<typeof AdminBroadcastBodySchema>
const _checkBulk: AdminBulkUserInput = {} as z.infer<typeof AdminBulkUserBodySchema>
const _checkNote: AdminUserNoteInput = {} as z.infer<typeof AdminUserNoteBodySchema>
const _checkQuery: AdminUserQuery = {} as AdminUserQueryParsed
void [_checkBulk, _checkNote, _checkQuery]
void [_checkReason, _checkRole, _checkVerify, _checkPin, _checkTicket, _checkSkill, _checkCourse, _checkBroadcast]
