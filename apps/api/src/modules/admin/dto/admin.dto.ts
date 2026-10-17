import { z } from 'zod'
import type {
  AdminBroadcastInput,
  AdminCourseInput,
  AdminModerateSkillInput,
  AdminPermission,
  AdminPinPostInput,
  AdminReasonInput,
  AdminTicketStatusInput,
  AdminUpdateRoleInput,
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
  lecturer: ['dashboard:view', 'moderation:read', 'moderation:write', 'academic:read', 'academic:manage', 'ai:read', 'search:read'],
  ta: ['dashboard:view', 'moderation:read', 'moderation:write', 'academic:read', 'search:read'],
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

// Báo lỗi biên dịch nếu lệch với @pu/schemas
const _checkReason: AdminReasonInput = {} as z.infer<typeof AdminReasonBodySchema>
const _checkRole: AdminUpdateRoleInput = {} as z.infer<typeof AdminUpdateRoleBodySchema>
const _checkVerify: AdminVerifyUserInput = {} as z.infer<typeof AdminVerifyUserBodySchema>
const _checkPin: AdminPinPostInput = {} as z.infer<typeof AdminPinPostBodySchema>
const _checkTicket: AdminTicketStatusInput = {} as z.infer<typeof AdminTicketStatusBodySchema>
const _checkSkill: AdminModerateSkillInput = {} as z.infer<typeof AdminModerateSkillBodySchema>
const _checkCourse: AdminCourseInput = {} as z.infer<typeof AdminCourseBodySchema>
const _checkBroadcast: AdminBroadcastInput = {} as z.infer<typeof AdminBroadcastBodySchema>
void [_checkReason, _checkRole, _checkVerify, _checkPin, _checkTicket, _checkSkill, _checkCourse, _checkBroadcast]
