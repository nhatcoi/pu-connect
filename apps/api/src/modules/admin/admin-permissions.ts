import type { AdminPermission } from '@pu/schemas'
import type { DatabaseService } from '../../database/database.service'
import { getRolePermissions } from './dto/admin.dto'

const TTL_MS = 30_000
const cache = new Map<string, { at: number; perms: AdminPermission[] }>()

// Quyền hiệu lực = quyền theo vai trò + quyền của mọi nhóm người đó thuộc về (cache ngắn, xóa khi đổi nhóm)
export async function effectivePermissions(db: Pick<DatabaseService, 'query'>, userId: string, role: string | undefined | null): Promise<AdminPermission[]> {
  const key = `${userId}:${role ?? ''}`
  const hit = cache.get(key)
  if (hit && Date.now() - hit.at < TTL_MS) return hit.perms
  const res = await db.query(
    `SELECT DISTINCT unnest(g.permissions) AS p FROM admin_group_members m JOIN admin_groups g ON g.id = m.group_id WHERE m.user_id = $1`,
    [userId]
  )
  const perms = [...new Set([...getRolePermissions(role), ...(res.rows.map((r) => r.p) as AdminPermission[])])]
  cache.set(key, { at: Date.now(), perms })
  return perms
}

export function clearPermissionCache() {
  cache.clear()
}
