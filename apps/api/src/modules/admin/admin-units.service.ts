import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { AdminUnit, AdminUnitCatalog, AdminUnitInput, AdminUnitPatch, AdminUnitRequest, AdminUnitRequestApprove, UnitKind, UnitRequestStatus } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'
import { foldSql, UNIT_TABLE } from '../units/unit-sql'
import { writeAudit } from './admin-audit'

const clean = (v: string) => v.replace(/\s+/g, ' ').trim()
const KIND_LABEL: Record<UnitKind, string> = { university: 'trường', field: 'lĩnh vực' }

// Danh mục trường + lĩnh vực quan tâm, và hàng chờ duyệt đơn vị người dùng nhập tay ("Khác").
// Mọi thay đổi ghi nhật ký admin trong cùng transaction.
@Injectable()
export class AdminUnitsService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  async list(): Promise<AdminUnitCatalog> {
    const [universities, fields] = await Promise.all([
      this.db.query(
        `SELECT t.id, t.code, t.name, t.sort_order, t.is_active, (SELECT COUNT(*)::int FROM users u WHERE u.university_id = t.id) AS user_count, 0 AS course_count
           FROM universities t ORDER BY t.sort_order, t.name`
      ),
      this.db.query(
        `SELECT t.id, t.code, t.name, t.sort_order, t.is_active, (SELECT COUNT(*)::int FROM users u WHERE u.interest_field_id = t.id) AS user_count,
                (SELECT COUNT(*)::int FROM courses c WHERE c.interest_field_id = t.id) AS course_count
           FROM interest_fields t ORDER BY t.sort_order, t.name`
      )
    ])
    const map = (r: any): AdminUnit => ({ id: r.id, code: r.code, name: r.name, sortOrder: r.sort_order, isActive: r.is_active, userCount: r.user_count, courseCount: r.course_count })
    return { universities: universities.rows.map(map), fields: fields.rows.map(map) }
  }

  async create(adminId: string, input: AdminUnitInput): Promise<{ id: string }> {
    return this.db.transaction(async (client) => {
      const id = await this.insertUnit(client, input.kind, clean(input.name))
      await writeAudit(client, adminId, { action: 'unit.create', targetType: 'unit', targetId: id, details: { kind: input.kind, name: input.name } })
      return { id }
    })
  }

  async update(adminId: string, kind: UnitKind, id: string, patch: AdminUnitPatch): Promise<void> {
    const { table } = UNIT_TABLE[kind]
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, kind, id)
      const sets: string[] = []
      const vals: unknown[] = []
      const add = (col: string, v: unknown) => {
        vals.push(v)
        sets.push(`${col} = $${vals.length}`)
      }
      if (patch.name !== undefined) add('name', clean(patch.name))
      if (patch.isActive !== undefined) add('is_active', patch.isActive)
      vals.push(id)
      await this.guard(() => client.query(`UPDATE ${table} SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals))
      await writeAudit(client, adminId, { action: 'unit.update', targetType: 'unit', targetId: id, details: { kind, before: cur.name, patch } })
    })
  }

  // Gộp đơn vị trùng: chuyển người dùng (và môn học nếu là lĩnh vực) sang đích rồi xóa nguồn
  async merge(adminId: string, kind: UnitKind, id: string, targetId: string): Promise<{ movedUsers: number }> {
    if (id === targetId) throw new BadRequestException('Không thể gộp vào chính nó')
    const { table, userColumn } = UNIT_TABLE[kind]
    return this.db.transaction(async (client) => {
      const src = await this.lock(client, kind, id)
      await this.lock(client, kind, targetId)
      const moved = await client.query(`UPDATE users SET ${userColumn} = $2 WHERE ${userColumn} = $1`, [id, targetId])
      if (kind === 'field') await client.query(`UPDATE courses SET interest_field_id = $2 WHERE interest_field_id = $1`, [id, targetId])
      await client.query(`DELETE FROM ${table} WHERE id = $1`, [id])
      await writeAudit(client, adminId, { action: 'unit.merge', targetType: 'unit', targetId: id, details: { kind, name: src.name, into: targetId, users: moved.rowCount } })
      return { movedUsers: moved.rowCount ?? 0 }
    })
  }

  async remove(adminId: string, kind: UnitKind, id: string): Promise<void> {
    const { table, userColumn } = UNIT_TABLE[kind]
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, kind, id)
      const used = await client.query(
        `SELECT (SELECT COUNT(*)::int FROM users WHERE ${userColumn} = $1) AS users,
                ${kind === 'field' ? '(SELECT COUNT(*)::int FROM courses WHERE interest_field_id = $1)' : '0'} AS courses`,
        [id]
      )
      const { users, courses } = used.rows[0]
      if (users > 0 || courses > 0) {
        throw new ConflictException(`Còn ${users} người dùng${courses ? ` và ${courses} môn học` : ''} — dùng "Gộp" để chuyển sang ${KIND_LABEL[kind]} khác, hoặc tắt hiển thị`)
      }
      await client.query(`DELETE FROM ${table} WHERE id = $1`, [id])
      await writeAudit(client, adminId, { action: 'unit.delete', targetType: 'unit', targetId: id, details: { kind, name: cur.name } })
    })
  }

  // ── Hàng chờ duyệt ──────────────────────────────────────────────────────

  async listRequests(status: UnitRequestStatus = 'pending'): Promise<AdminUnitRequest[]> {
    const res = await this.db.query(
      `SELECT r.id, r.kind, r.name, r.status, r.reject_reason, r.created_at, r.reviewed_at,
              u.id AS user_id, u.username, u.display_name, u.avatar_url,
              (SELECT COUNT(*)::int FROM unit_requests o WHERE o.status = 'pending' AND o.kind = r.kind AND ${foldSql('o.name')} = ${foldSql('r.name')}) AS same_name,
              CASE r.kind WHEN 'university' THEN (SELECT x.id FROM universities x WHERE x.is_active AND ${this.similar('x.name', 'r.name')} LIMIT 1)
                          ELSE (SELECT x.id FROM interest_fields x WHERE x.is_active AND ${this.similar('x.name', 'r.name')} LIMIT 1) END AS suggestion_id,
              CASE r.kind WHEN 'university' THEN (SELECT x.name FROM universities x WHERE x.is_active AND ${this.similar('x.name', 'r.name')} LIMIT 1)
                          ELSE (SELECT x.name FROM interest_fields x WHERE x.is_active AND ${this.similar('x.name', 'r.name')} LIMIT 1) END AS suggestion_name,
              CASE r.kind WHEN 'university' THEN (SELECT x.name FROM universities x WHERE x.id = r.resolved_id)
                          ELSE (SELECT x.name FROM interest_fields x WHERE x.id = r.resolved_id) END AS resolved_name
         FROM unit_requests r JOIN users u ON u.id = r.user_id
        WHERE r.status = $1
        ORDER BY r.created_at DESC
        LIMIT 200`,
      [status]
    )
    return res.rows.map((r) => ({
      id: r.id,
      kind: r.kind,
      name: r.name,
      status: r.status,
      user: { id: r.user_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url },
      sameNameCount: r.same_name,
      suggestion: r.suggestion_id ? { id: r.suggestion_id, name: r.suggestion_name } : null,
      resolvedName: r.resolved_name,
      rejectReason: r.reject_reason,
      createdAt: r.created_at.toISOString(),
      reviewedAt: r.reviewed_at ? r.reviewed_at.toISOString() : null
    }))
  }

  // Duyệt: tạo đơn vị mới (hoặc gộp vào đơn vị có sẵn) rồi gán cho mọi người đã gửi cùng tên
  async approveRequest(adminId: string, requestId: string, body: AdminUnitRequestApprove): Promise<{ unitId: string; users: number }> {
    const result = await this.db.transaction(async (client) => {
      const reqRes = await client.query(`SELECT id, kind, name FROM unit_requests WHERE id = $1 AND status = 'pending' FOR UPDATE`, [requestId])
      const req = reqRes.rows[0] as { id: string; kind: UnitKind; name: string } | undefined
      if (!req) throw new NotFoundException('Yêu cầu không tồn tại hoặc đã được xử lý')
      const { table, userColumn } = UNIT_TABLE[req.kind]

      let unitId: string
      let unitName: string
      if (body.existingId) {
        const cur = await this.lock(client, req.kind, body.existingId)
        unitId = cur.id
        unitName = cur.name
      } else {
        unitName = clean(body.name ?? req.name)
        const dup = await client.query(`SELECT id FROM ${table} WHERE ${foldSql('name')} = ${foldSql('$1::text')}`, [unitName])
        unitId = dup.rows[0]?.id ?? (await this.insertUnit(client, req.kind, unitName))
      }

      // Mọi yêu cầu chờ cùng loại + cùng tên (đã bỏ dấu / hoa thường) được duyệt một lượt
      const batch = await client.query(
        `UPDATE unit_requests SET status = 'approved', resolved_id = $2, reviewed_by = $3, reviewed_at = NOW()
          WHERE status = 'pending' AND kind = $4 AND ${foldSql('name')} = (SELECT ${foldSql('name')} FROM unit_requests WHERE id = $1)
          RETURNING user_id`,
        [requestId, unitId, adminId, req.kind]
      )
      const userIds: string[] = batch.rows.map((r) => r.user_id)
      await client.query(`UPDATE users SET ${userColumn} = $1, updated_at = NOW() WHERE id = ANY($2::uuid[])`, [unitId, userIds])
      await writeAudit(client, adminId, {
        action: 'unit_request.approve',
        targetType: 'unit_request',
        targetId: requestId,
        details: { kind: req.kind, requested: req.name, unit: unitName, merged: !!body.existingId, users: userIds.length }
      })
      return { unitId, unitName, kind: req.kind, userIds }
    })

    await this.notifications.fanOut(
      result.userIds.map((recipientId) => ({
        type: 'account_notice' as const,
        recipientId,
        actorId: null,
        verb: `${result.kind === 'university' ? 'Trường' : 'Lĩnh vực quan tâm'} của bạn đã được duyệt`,
        message: `Hồ sơ của bạn đã cập nhật thành "${result.unitName}".`
      }))
    )
    return { unitId: result.unitId, users: result.userIds.length }
  }

  // Từ chối: người dùng giữ nguyên trạng thái "chưa chọn" (không còn là "Khác")
  async rejectRequest(adminId: string, requestId: string, reason?: string): Promise<void> {
    const req = await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE unit_requests SET status = 'rejected', reject_reason = $2, reviewed_by = $3, reviewed_at = NOW()
          WHERE id = $1 AND status = 'pending' RETURNING user_id, kind, name`,
        [requestId, reason ? reason.slice(0, 300) : null, adminId]
      )
      if (!res.rows[0]) throw new NotFoundException('Yêu cầu không tồn tại hoặc đã được xử lý')
      await writeAudit(client, adminId, { action: 'unit_request.reject', targetType: 'unit_request', targetId: requestId, details: { kind: res.rows[0].kind, name: res.rows[0].name, reason } })
      return res.rows[0] as { user_id: string; kind: UnitKind; name: string }
    })
    await this.notifications.notify({
      type: 'account_notice',
      recipientId: req.user_id,
      actorId: null,
      verb: `Chưa thể thêm ${KIND_LABEL[req.kind]} "${req.name}"`,
      message: reason ? `Lý do: ${reason}. Bạn có thể chọn một mục có sẵn trong hồ sơ.` : 'Bạn có thể chọn một mục có sẵn trong hồ sơ.'
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  // Tên gần giống (một chuỗi chứa chuỗi kia, đã bỏ dấu / hoa thường) ⇒ gợi ý gộp
  private similar(a: string, b: string): string {
    return `(${foldSql(a)} LIKE '%' || ${foldSql(b)} || '%' OR ${foldSql(b)} LIKE '%' || ${foldSql(a)} || '%')`
  }

  private async insertUnit(client: PoolClient, kind: UnitKind, name: string): Promise<string> {
    const { table } = UNIT_TABLE[kind]
    const res = await this.guard(() =>
      client.query(
        `INSERT INTO ${table} (code, name, sort_order)
         VALUES ('u-' || replace(gen_random_uuid()::text, '-', ''), $1, COALESCE((SELECT MAX(sort_order) FROM ${table}), 0) + 10)
         RETURNING id`,
        [name]
      )
    )
    return res.rows[0].id
  }

  private async lock(client: PoolClient, kind: UnitKind, id: string): Promise<{ id: string; name: string }> {
    const res = await client.query(`SELECT id, name FROM ${UNIT_TABLE[kind].table} WHERE id = $1 FOR UPDATE`, [id])
    if (!res.rows[0]) throw new NotFoundException(`${KIND_LABEL[kind][0].toUpperCase()}${KIND_LABEL[kind].slice(1)} không tồn tại`)
    return res.rows[0]
  }

  // Trùng tên (unique index) ⇒ 409 dễ hiểu
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Đã có mục cùng tên')
      throw e
    }
  }
}
