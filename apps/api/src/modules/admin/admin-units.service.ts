import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type { AcademicUnitKind, AdminAcademicUnit, AdminAcademicUnitInput, AdminAcademicUnitPatch } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { writeAudit } from './admin-audit'

// Loại đơn vị cha hợp lệ theo từng loại (null = gốc)
const PARENT_RULES: Record<AcademicUnitKind, (AcademicUnitKind | null)[]> = {
  school: [null],
  faculty: [null, 'school'],
  major: ['faculty', 'school'],
  institute: [null],
  center: [null]
}

interface UnitRow {
  id: string
  parent_id: string | null
  type: AcademicUnitKind
  name: string
}

// Cây đơn vị học thuật: danh sách + thêm / sửa / sắp xếp / gộp / xóa (mọi thay đổi ghi nhật ký admin)
@Injectable()
export class AdminUnitsService {
  constructor(private readonly db: DatabaseService) {}

  async list(): Promise<AdminAcademicUnit[]> {
    const res = await this.db.query(
      `WITH RECURSIVE tree(root, node) AS (
         SELECT id, id FROM academic_units
         UNION ALL
         SELECT t.root, c.id FROM tree t JOIN academic_units c ON c.parent_id = t.node
       ), cnt AS (SELECT unit_id, COUNT(*)::int AS n FROM users WHERE unit_id IS NOT NULL GROUP BY unit_id)
       SELECT a.id, a.code, a.parent_id, a.type, a.name, a.short_name, a.sort_order, a.is_active,
              (SELECT COUNT(*)::int FROM academic_units c WHERE c.parent_id = a.id) AS child_count,
              COALESCE(d.n, 0) AS user_count,
              COALESCE((SELECT SUM(c.n) FROM tree t JOIN cnt c ON c.unit_id = t.node WHERE t.root = a.id), 0)::int AS user_total
       FROM academic_units a LEFT JOIN cnt d ON d.unit_id = a.id
       ORDER BY a.sort_order, a.name`
    )
    return res.rows.map((r) => ({
      id: r.id,
      code: r.code,
      parentId: r.parent_id,
      type: r.type,
      name: r.name,
      shortName: r.short_name,
      sortOrder: r.sort_order,
      isActive: r.is_active,
      childCount: r.child_count,
      userCount: r.user_count,
      userTotal: r.user_total
    }))
  }

  async create(adminId: string, input: AdminAcademicUnitInput): Promise<{ id: string }> {
    return this.db.transaction(async (client) => {
      await this.assertParent(client, input.type, input.parentId ?? null)
      const res = await this.guard(() =>
        client.query(
          `INSERT INTO academic_units (code, type, name, short_name, parent_id, sort_order)
           VALUES ('u-' || replace(gen_random_uuid()::text, '-', ''), $1, $2, $3, $4,
                   COALESCE((SELECT MAX(sort_order) FROM academic_units WHERE parent_id IS NOT DISTINCT FROM $4::uuid), 0) + 10)
           RETURNING id`,
          [input.type, input.name, input.shortName ?? null, input.parentId ?? null]
        )
      )
      const id = res.rows[0].id as string
      await writeAudit(client, adminId, { action: 'academic_unit.create', targetType: 'academic_unit', targetId: id, details: { name: input.name, type: input.type } })
      return { id }
    })
  }

  async update(adminId: string, id: string, patch: AdminAcademicUnitPatch): Promise<void> {
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      const type = patch.type ?? cur.type
      const parentId = patch.parentId !== undefined ? patch.parentId : cur.parent_id
      if (patch.type !== undefined || patch.parentId !== undefined) {
        await this.assertParent(client, type, parentId)
        if (parentId) await this.assertNotInSubtree(client, id, parentId)
      }
      const sets: string[] = []
      const vals: unknown[] = []
      const add = (col: string, v: unknown) => {
        vals.push(v)
        sets.push(`${col} = $${vals.length}`)
      }
      if (patch.name !== undefined) add('name', patch.name)
      if (patch.shortName !== undefined) add('short_name', patch.shortName)
      if (patch.type !== undefined) add('type', patch.type)
      if (patch.parentId !== undefined) add('parent_id', patch.parentId)
      if (patch.isActive !== undefined) add('is_active', patch.isActive)
      vals.push(id)
      await this.guard(() => client.query(`UPDATE academic_units SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${vals.length}`, vals))
      await this.syncUsers(client, id)
      await writeAudit(client, adminId, { action: 'academic_unit.update', targetType: 'academic_unit', targetId: id, details: { before: cur.name, patch } })
    })
  }

  // Đổi thứ tự trong cùng cha: hoán đổi với anh em liền kề
  async reorder(adminId: string, id: string, direction: 'up' | 'down'): Promise<void> {
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      const sib = await client.query(`SELECT id FROM academic_units WHERE parent_id IS NOT DISTINCT FROM $1::uuid ORDER BY sort_order, name FOR UPDATE`, [cur.parent_id])
      const ids: string[] = sib.rows.map((r) => r.id)
      const i = ids.indexOf(id)
      const j = direction === 'up' ? i - 1 : i + 1
      if (j < 0 || j >= ids.length) return
      ;[ids[i], ids[j]] = [ids[j], ids[i]]
      // Đánh lại 10, 20, 30… cho cả nhóm (tránh trùng sort_order)
      await client.query(
        `UPDATE academic_units a SET sort_order = t.ord * 10 FROM unnest($1::uuid[]) WITH ORDINALITY AS t(id, ord) WHERE a.id = t.id`,
        [ids]
      )
      await writeAudit(client, adminId, { action: 'academic_unit.reorder', targetType: 'academic_unit', targetId: id, details: { direction } })
    })
  }

  // Gộp đơn vị trùng: chuyển người dùng + đơn vị con sang đích rồi xóa nguồn
  async merge(adminId: string, id: string, targetId: string): Promise<{ movedUsers: number }> {
    if (id === targetId) throw new BadRequestException('Không thể gộp đơn vị vào chính nó')
    return this.db.transaction(async (client) => {
      const src = await this.lock(client, id)
      await this.lock(client, targetId)
      await this.assertNotInSubtree(client, id, targetId)
      await this.guard(() => client.query(`UPDATE academic_units SET parent_id = $2, updated_at = NOW() WHERE parent_id = $1`, [id, targetId]))
      const moved = await client.query(`UPDATE users SET unit_id = $2 WHERE unit_id = $1`, [id, targetId])
      await client.query(`DELETE FROM academic_units WHERE id = $1`, [id])
      await this.syncUsers(client, targetId)
      await writeAudit(client, adminId, { action: 'academic_unit.merge', targetType: 'academic_unit', targetId: id, details: { name: src.name, into: targetId, users: moved.rowCount } })
      return { movedUsers: moved.rowCount ?? 0 }
    })
  }

  async remove(adminId: string, id: string): Promise<void> {
    await this.db.transaction(async (client) => {
      const cur = await this.lock(client, id)
      const used = await client.query(
        `SELECT (SELECT COUNT(*)::int FROM academic_units WHERE parent_id = $1) AS children, (SELECT COUNT(*)::int FROM users WHERE unit_id = $1) AS users`,
        [id]
      )
      const { children, users } = used.rows[0]
      if (children > 0) throw new ConflictException(`Còn ${children} đơn vị con — chuyển hoặc xóa chúng trước`)
      if (users > 0) throw new ConflictException(`Còn ${users} người dùng — dùng "Gộp" để chuyển họ sang đơn vị khác, hoặc tắt đơn vị`)
      await client.query(`DELETE FROM academic_units WHERE id = $1`, [id])
      await writeAudit(client, adminId, { action: 'academic_unit.delete', targetType: 'academic_unit', targetId: id, details: { name: cur.name } })
    })
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async lock(client: PoolClient, id: string): Promise<UnitRow> {
    const res = await client.query(`SELECT id, parent_id, type, name FROM academic_units WHERE id = $1 FOR UPDATE`, [id])
    if (!res.rows[0]) throw new NotFoundException('Đơn vị không tồn tại')
    return res.rows[0]
  }

  private async assertParent(client: PoolClient, type: AcademicUnitKind, parentId: string | null): Promise<void> {
    let parentType: AcademicUnitKind | null = null
    if (parentId) {
      const res = await client.query(`SELECT type FROM academic_units WHERE id = $1`, [parentId])
      if (!res.rows[0]) throw new BadRequestException('Đơn vị cha không tồn tại')
      parentType = res.rows[0].type
    }
    if (!PARENT_RULES[type].includes(parentType)) {
      throw new BadRequestException(parentType ? `"${type}" không thể nằm dưới "${parentType}"` : `"${type}" phải nằm dưới một đơn vị cha`)
    }
  }

  // Chặn vòng lặp: đơn vị cha mới không được là chính nó hoặc con cháu của nó
  private async assertNotInSubtree(client: PoolClient, id: string, candidate: string): Promise<void> {
    const res = await client.query(
      `WITH RECURSIVE sub(id) AS (SELECT $1::uuid UNION ALL SELECT c.id FROM academic_units c JOIN sub s ON c.parent_id = s.id)
       SELECT 1 FROM sub WHERE id = $2::uuid`,
      [id, candidate]
    )
    if (res.rowCount) throw new BadRequestException('Không thể chuyển đơn vị vào chính nó hoặc đơn vị con của nó')
  }

  // Đổi tên / tên ngắn / cha ⇒ cập nhật cột chữ (trường, khoa, ngành) của mọi người trong nhánh
  private async syncUsers(client: PoolClient, rootId: string): Promise<void> {
    await client.query(
      `WITH RECURSIVE sub(id) AS (SELECT $1::uuid UNION ALL SELECT c.id FROM academic_units c JOIN sub s ON c.parent_id = s.id)
       UPDATE users u SET school = p.school, faculty = p.faculty, major = COALESCE(p.major, u.major)
       FROM academic_unit_paths p
       WHERE u.unit_id = p.id AND u.unit_id IN (SELECT id FROM sub)`,
      [rootId]
    )
  }

  // Trùng tên trong cùng cha (unique index) ⇒ 409 dễ hiểu
  private async guard<T>(fn: () => Promise<T>): Promise<T> {
    try {
      return await fn()
    } catch (e) {
      if ((e as { code?: string }).code === '23505') throw new ConflictException('Đã có đơn vị cùng tên trong cùng nhóm')
      throw e
    }
  }
}
