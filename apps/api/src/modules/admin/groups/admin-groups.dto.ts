import { z } from 'zod'
import { ADMIN_PERMISSIONS_RUNTIME } from '../dto/admin.dto'

// Quyền chỉ vai trò admin giữ: không đưa vào nhóm (tránh leo thang đặc quyền)
export const ADMIN_ONLY_PERMISSIONS = ['users:role', 'users:insight', 'roles:manage']
const GROUPABLE = ADMIN_PERMISSIONS_RUNTIME.filter((p) => !ADMIN_ONLY_PERMISSIONS.includes(p)) as [string, ...string[]]

export const GroupBodySchema = z
  .object({
    name: z.string().trim().min(2, 'Tên nhóm tối thiểu 2 ký tự').max(60),
    description: z.string().trim().max(255).optional().nullable(),
    permissions: z.array(z.enum(GROUPABLE)).min(1, 'Chọn ít nhất một quyền').max(GROUPABLE.length)
  })
  .strict()

export const GroupMembersSchema = z.object({ userIds: z.array(z.string().uuid()).min(1).max(50) }).strict()
export const MemberSearchSchema = z.object({ q: z.string().trim().max(60).optional() })

export type GroupBody = z.infer<typeof GroupBodySchema>
