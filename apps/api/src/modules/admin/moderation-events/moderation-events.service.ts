import { Injectable } from '@nestjs/common'
import type { AdminBulkResult, AdminModerationEvent, AdminPage } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'

export interface ModerationEventsQuery {
  status: 'pending' | 'reviewed'
  action?: string
  surface?: string
  q?: string
  page: number
  pageSize: number
}

// Nhật ký kiểm duyệt tự động: nội dung bị chặn (block) hoặc ẩn chờ duyệt (hold) và các cờ nghi vấn
@Injectable()
export class AdminModerationEventsService {
  constructor(private readonly db: DatabaseService) {}

  async list(q: ModerationEventsQuery): Promise<AdminPage<AdminModerationEvent>> {
    const params: unknown[] = []
    const where = [q.status === 'pending' ? `e.review_status = 'pending'` : `e.review_status <> 'pending'`]
    if (q.action) where.push(`e.action = $${params.push(q.action)}`)
    if (q.surface) where.push(`e.surface = $${params.push(q.surface)}`)
    if (q.q) where.push(`(u.username ILIKE $${params.push(`${q.q.replace(/[\\%_]/g, '\\$&')}%`)} OR e.content ILIKE '%' || $${params.length} || '%')`)
    const from = `FROM moderation_events e LEFT JOIN users u ON u.id = e.user_id WHERE ${where.join(' AND ')}`
    const total = (await this.db.query(`SELECT COUNT(*)::int AS n ${from}`, params)).rows[0].n as number
    const limit = params.push(q.pageSize)
    const offset = params.push((q.page - 1) * q.pageSize)
    const res = await this.db.query(
      `SELECT e.id, e.surface, e.action, e.tier, e.reason, e.scores, e.matched_terms, e.content, e.enforced, e.target_type, e.target_id,
              e.review_status, e.created_at, u.id AS uid, u.username, u.display_name, u.avatar_url,
              (e.target_type = 'post' AND p.hidden_at IS NOT NULL) AS target_hidden
       ${from.replace('WHERE', `LEFT JOIN posts p ON e.target_type = 'post' AND p.id = e.target_id WHERE`)}
       ORDER BY e.created_at DESC, e.id LIMIT $${limit} OFFSET $${offset}`,
      params
    )
    return {
      items: res.rows.map(
        (r): AdminModerationEvent => ({
          id: r.id,
          surface: r.surface,
          action: r.action,
          tier: r.tier,
          reason: r.reason,
          scores: r.scores,
          matchedTerms: r.matched_terms ?? [],
          content: r.content,
          enforced: r.enforced,
          targetType: r.target_type,
          targetId: r.target_id,
          targetHidden: !!r.target_hidden,
          reviewStatus: r.review_status,
          createdAt: new Date(r.created_at).toISOString(),
          user: r.uid ? { id: r.uid, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url } : null
        })
      ),
      total,
      page: q.page,
      pageSize: q.pageSize
    } as AdminPage<AdminModerationEvent>
  }

  /**
   * confirmed: đồng ý với hệ thống (giữ nguyên chặn/ẩn).
   * dismissed: hệ thống sai ⇒ bài đang bị ẩn tự động được hiện lại (nội dung bị chặn không tạo bài nên không khôi phục được).
   */
  async review(adminId: string, ids: string[], resolution: 'confirmed' | 'dismissed'): Promise<AdminBulkResult> {
    const unique = [...new Set(ids)]
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE moderation_events SET review_status = $3, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = ANY($1::uuid[]) AND review_status = 'pending' RETURNING id, target_type, target_id, action`,
        [unique, adminId, resolution]
      )
      let restored = 0
      for (const r of res.rows) {
        if (resolution === 'dismissed' && r.action === 'hold' && r.target_type === 'post' && r.target_id) {
          const up = await client.query(`UPDATE posts SET hidden_at = NULL, hidden_reason = NULL WHERE id = $1 AND hidden_reason LIKE 'auto-moderation:%'`, [r.target_id])
          restored += up.rowCount ?? 0
        }
        await writeAudit(client, adminId, { action: `moderation_event.${resolution}`, targetType: 'system', targetId: r.id, details: { eventAction: r.action } })
      }
      return { affected: res.rowCount ?? 0, skipped: unique.length - (res.rowCount ?? 0), restored } as AdminBulkResult
    })
  }
}
