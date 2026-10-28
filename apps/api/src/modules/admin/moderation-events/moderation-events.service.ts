import { Injectable } from '@nestjs/common'
import type { AdminBulkResult, AdminModerationEvent, AdminPage } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { writeAudit } from '../admin-audit'
import { CommentsService } from '../../posts/comments.service'

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
  constructor(
    private readonly db: DatabaseService,
    private readonly comments: CommentsService
  ) {}

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
              ((e.target_type = 'post' AND p.hidden_at IS NOT NULL) OR (e.target_type = 'comment' AND cm.hidden_at IS NOT NULL)) AS target_hidden
       ${from.replace('WHERE', `LEFT JOIN posts p ON e.target_type = 'post' AND p.id = e.target_id LEFT JOIN comments cm ON e.target_type = 'comment' AND cm.id = e.target_id WHERE`)}
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
   * dismissed: hệ thống sai ⇒ bài / bình luận đang bị ẩn tự động được hiện lại (bình luận còn được báo cho các bên bị hoãn); nội dung bị chặn không được lưu nên không khôi phục được.
   * confirmed: bình luận chuyển sang "bị từ chối" (tác giả được báo), bài giữ nguyên ẩn.
   */
  async review(adminId: string, ids: string[], resolution: 'confirmed' | 'dismissed'): Promise<AdminBulkResult> {
    const unique = [...new Set(ids)]
    const comments: string[] = []
    const result = await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE moderation_events SET review_status = $3, reviewed_by = $2, reviewed_at = NOW()
         WHERE id = ANY($1::uuid[]) AND review_status = 'pending' RETURNING id, target_type, target_id, action`,
        [unique, adminId, resolution]
      )
      let restored = 0
      for (const r of res.rows) {
        if (resolution === 'dismissed' && r.action !== 'block' && r.target_type === 'post' && r.target_id) {
          const up = await client.query(`UPDATE posts SET hidden_at = NULL, hidden_reason = NULL WHERE id = $1 AND hidden_reason LIKE 'auto-moderation:%'`, [r.target_id])
          restored += up.rowCount ?? 0
        }
        if (r.action !== 'block' && r.target_type === 'comment' && r.target_id) comments.push(r.target_id)
        await writeAudit(client, adminId, { action: `moderation_event.${resolution}`, targetType: 'system', targetId: r.id, details: { eventAction: r.action } })
      }
      return { affected: res.rowCount ?? 0, skipped: unique.length - (res.rowCount ?? 0), restored } as AdminBulkResult
    })
    // Bình luận: hiện lại + báo (hoặc từ chối) sau khi transaction nhật ký đã commit
    for (const id of comments) {
      const ok = resolution === 'dismissed' ? await this.comments.approveHeld(id) : await this.comments.rejectHeld(id)
      if (ok && resolution === 'dismissed') result.restored = (result.restored ?? 0) + 1
    }
    return result
  }
}
