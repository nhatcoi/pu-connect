import { ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { AdminSavedView } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'

// View đã lưu: bộ lọc hay dùng của admin (riêng tư hoặc chia sẻ cho mọi admin)
@Injectable()
export class AdminViewsService {
  constructor(private readonly db: DatabaseService) {}

  async list(adminId: string, page: string): Promise<AdminSavedView[]> {
    const res = await this.db.query(
      `SELECT v.id, v.page, v.name, v.query, v.shared, v.admin_id = $1 AS mine, u.username AS owner
       FROM admin_saved_views v LEFT JOIN users u ON u.id = v.admin_id
       WHERE v.page = $2 AND (v.admin_id = $1 OR v.shared)
       ORDER BY (v.admin_id = $1) DESC, v.created_at`,
      [adminId, page]
    )
    return res.rows.map((r) => ({ id: String(r.id), page: r.page, name: r.name, query: r.query, shared: r.shared, mine: r.mine, owner: r.owner }))
  }

  async create(adminId: string, input: { page: string; name: string; query: string; shared: boolean }): Promise<AdminSavedView[]> {
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM admin_saved_views WHERE admin_id = $1`, [adminId])
    if (count.rows[0].n >= 50) throw new ForbiddenException('Tối đa 50 view mỗi người')
    await this.db.query(`INSERT INTO admin_saved_views (admin_id, page, name, query, shared) VALUES ($1, $2, $3, $4, $5)`, [
      adminId,
      input.page,
      input.name,
      input.query.replace(/^\?/, ''),
      input.shared
    ])
    return this.list(adminId, input.page)
  }

  async remove(adminId: string, id: string): Promise<{ deleted: true }> {
    const res = await this.db.query(`DELETE FROM admin_saved_views WHERE id = $1 AND admin_id = $2`, [id, adminId])
    if (!res.rowCount) throw new NotFoundException('View không tồn tại hoặc không phải của bạn')
    return { deleted: true }
  }
}
