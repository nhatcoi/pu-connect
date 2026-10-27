import { Injectable } from '@nestjs/common'
import type { AdminBulkResult, AdminPage, AdminReportedUser } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'

export interface UserReportsQuery {
  status: 'pending' | 'resolved'
  reason?: string
  q?: string
  page: number
  pageSize: number
}

// Báo cáo người dùng gom theo người bị báo cáo
@Injectable()
export class AdminUserReportsService {
  constructor(private readonly db: DatabaseService) {}

  async list(q: UserReportsQuery): Promise<AdminPage<AdminReportedUser>> {
    const pending = q.status === 'pending'
    const status = pending ? `r.status = 'pending'` : `r.status <> 'pending'`
    const params: unknown[] = []
    const where = [status]
    if (q.reason) where.push(`EXISTS (SELECT 1 FROM user_reports r2 WHERE r2.reported_id = u.id AND r2.reason = $${params.push(q.reason)})`)
    if (q.q) where.push(`(u.username ILIKE $${params.push(`${q.q.replace(/[\\%_]/g, '\\$&')}%`)} OR u.display_name ILIKE '%' || $${params.length} || '%')`)
    const from = `FROM user_reports r JOIN users u ON u.id = r.reported_id WHERE ${where.join(' AND ')} GROUP BY u.id`
    const total = (await this.db.query(`SELECT COUNT(*)::int AS n FROM (SELECT 1 ${from}) x`, params)).rows[0].n as number
    const limit = params.push(q.pageSize)
    const offset = params.push((q.page - 1) * q.pageSize)
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, u.status, u.role,
         COUNT(r.id)::int AS report_count, MAX(r.created_at) AS last_reported_at,
         (SELECT json_agg(json_build_object('reason', x.reason, 'count', x.cnt) ORDER BY x.cnt DESC)
            FROM (SELECT reason, COUNT(*)::int AS cnt FROM user_reports r3 WHERE r3.reported_id = u.id AND ${pending ? `r3.status = 'pending'` : `r3.status <> 'pending'`} GROUP BY reason) x) AS reasons,
         (ARRAY_AGG(r.details ORDER BY r.created_at DESC) FILTER (WHERE r.details IS NOT NULL AND r.details <> ''))[1:5] AS details
       ${from} ORDER BY MAX(r.created_at) DESC, u.id LIMIT $${limit} OFFSET $${offset}`,
      params
    )
    return {
      items: res.rows.map(
        (row): AdminReportedUser => ({
          userId: row.id,
          username: row.username,
          displayName: row.display_name,
          avatarUrl: row.avatar_url,
          status: row.status,
          role: row.role,
          reportCount: row.report_count,
          reasons: row.reasons || [],
          details: row.details || [],
          lastReportedAt: new Date(row.last_reported_at).toISOString()
        })
      ),
      total,
      page: q.page,
      pageSize: q.pageSize
    } as AdminPage<AdminReportedUser>
  }

  // Đóng mọi báo cáo đang chờ của các người dùng: 'actioned' (đã xử lý, ví dụ xử phạt) hoặc 'dismissed' (bỏ qua)
  async resolve(adminId: string, userIds: string[], resolution: 'actioned' | 'dismissed'): Promise<AdminBulkResult> {
    const ids = [...new Set(userIds)]
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE user_reports SET status = 'resolved', resolution = $3, resolved_by = $2, resolved_at = NOW()
         WHERE reported_id = ANY($1::uuid[]) AND status = 'pending' RETURNING reported_id`,
        [ids, adminId, resolution]
      )
      const done = [...new Set(res.rows.map((r) => r.reported_id as string))]
      for (const id of done) {
        await writeAudit(client, adminId, { action: resolution === 'actioned' ? 'report.resolve' : 'report.dismiss', targetType: 'user', targetId: id, details: { resolution } })
      }
      return { affected: done.length, skipped: ids.length - done.length }
    })
  }
}
