import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdminGroup, AdminGroupMember, AdminPermission } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'
import { clearPermissionCache } from '../admin-permissions'
import type { GroupBody } from './admin-groups.dto'

@Injectable()
export class AdminGroupsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<AdminGroup[]> {
    const res = await this.db.query(
      `SELECT g.id, g.name, g.description, g.permissions, COUNT(m.user_id)::int AS member_count
       FROM admin_groups g LEFT JOIN admin_group_members m ON m.group_id = g.id GROUP BY g.id ORDER BY g.name`
    )
    return res.rows.map((r) => ({ id: r.id, name: r.name, description: r.description, permissions: r.permissions as AdminPermission[], memberCount: r.member_count }))
  }

  async create(adminId: string, body: GroupBody): Promise<{ id: string }> {
    return this.db.transaction(async (client) => {
      const dup = await client.query(`SELECT 1 FROM admin_groups WHERE lower(name) = lower($1)`, [body.name])
      if (dup.rows[0]) throw new ConflictException('Tên nhóm đã tồn tại')
      const res = await client.query(`INSERT INTO admin_groups (name, description, permissions, created_by) VALUES ($1, $2, $3, $4) RETURNING id`, [body.name, body.description || null, body.permissions, adminId])
      await writeAudit(client, adminId, { action: 'group.create', targetType: 'system', targetId: res.rows[0].id, details: { name: body.name, permissions: body.permissions } })
      return { id: res.rows[0].id as string }
    })
  }

  async update(adminId: string, id: string, body: GroupBody): Promise<{ id: string }> {
    await this.db.transaction(async (client) => {
      const dup = await client.query(`SELECT 1 FROM admin_groups WHERE lower(name) = lower($1) AND id <> $2`, [body.name, id])
      if (dup.rows[0]) throw new ConflictException('Tên nhóm đã tồn tại')
      const res = await client.query(`UPDATE admin_groups SET name = $2, description = $3, permissions = $4, updated_at = NOW() WHERE id = $1 RETURNING id`, [id, body.name, body.description || null, body.permissions])
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy nhóm')
      await writeAudit(client, adminId, { action: 'group.update', targetType: 'system', targetId: id, details: { name: body.name, permissions: body.permissions } })
    })
    clearPermissionCache()
    return { id }
  }

  async remove(adminId: string, id: string): Promise<{ deleted: true }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM admin_groups WHERE id = $1 RETURNING name`, [id])
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy nhóm')
      await writeAudit(client, adminId, { action: 'group.delete', targetType: 'system', targetId: id, details: { name: res.rows[0].name } })
    })
    clearPermissionCache()
    return { deleted: true }
  }

  async members(groupId: string): Promise<AdminGroupMember[]> {
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.role, m.created_at FROM admin_group_members m
       JOIN users u ON u.id = m.user_id WHERE m.group_id = $1 ORDER BY u.display_name`,
      [groupId]
    )
    return res.rows.map(toMember)
  }

  // Ứng viên: tài khoản người thật đang hoạt động, tìm theo tên hoặc @username
  async candidates(q?: string): Promise<AdminGroupMember[]> {
    const term = q?.trim()
    const res = await this.db.query(
      `SELECT id, username, display_name, avatar_url, role, NOW() AS created_at FROM users
       WHERE account_type = 'human' AND status = 'active'
         AND ($1::text IS NULL OR username ILIKE $1 || '%' OR display_name ILIKE '%' || $1 || '%')
       ORDER BY display_name LIMIT 20`,
      [term || null]
    )
    return res.rows.map(toMember)
  }

  async addMembers(adminId: string, groupId: string, userIds: string[]): Promise<AdminGroupMember[]> {
    const ids = [...new Set(userIds)]
    await this.db.transaction(async (client) => {
      if (!(await client.query(`SELECT 1 FROM admin_groups WHERE id = $1`, [groupId])).rows[0]) throw new NotFoundException('Không tìm thấy nhóm')
      const ok = await client.query(`SELECT id FROM users WHERE id = ANY($1::uuid[]) AND account_type = 'human' AND status = 'active'`, [ids])
      if (ok.rows.length !== ids.length) throw new BadRequestException('Chỉ thêm được tài khoản người dùng đang hoạt động')
      await client.query(`INSERT INTO admin_group_members (group_id, user_id, assigned_by) SELECT $1, x, $3 FROM unnest($2::uuid[]) x ON CONFLICT DO NOTHING`, [groupId, ids, adminId])
      await writeAudit(client, adminId, { action: 'group.member_add', targetType: 'system', targetId: groupId, details: { userIds: ids } })
    })
    clearPermissionCache()
    return this.members(groupId)
  }

  async removeMember(adminId: string, groupId: string, userId: string): Promise<{ removed: boolean }> {
    const removed = await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM admin_group_members WHERE group_id = $1 AND user_id = $2`, [groupId, userId])
      if (res.rowCount) await writeAudit(client, adminId, { action: 'group.member_remove', targetType: 'system', targetId: groupId, details: { userId } })
      return !!res.rowCount
    })
    clearPermissionCache()
    return { removed }
  }
}

const toMember = (r: { id: string; username: string; display_name: string; avatar_url: string | null; role: string; created_at: Date }): AdminGroupMember => ({
  id: r.id,
  username: r.username,
  displayName: r.display_name,
  avatarUrl: r.avatar_url,
  role: r.role as AdminGroupMember['role'],
  assignedAt: new Date(r.created_at).toISOString()
})
