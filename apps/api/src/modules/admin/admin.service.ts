import { BadRequestException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  AdminAuditLog,
  AdminReportedPost,
  AdminStats,
  AdminUserRow,
  UserInsight,
  ZeroResultQuery
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { UserInsightService } from '../personalization/user-insight.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'

type AuditEntry = { action: string; targetType: 'post' | 'user'; targetId: string; details?: Record<string, unknown> }

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly insight: UserInsightService
  ) {}

  async getStats(): Promise<AdminStats> {
    const res = await this.db.query(`
      SELECT
        (SELECT COUNT(*) FROM post_reports WHERE status = 'pending')::int AS pending_reports,
        (SELECT COUNT(DISTINCT post_id) FROM post_reports WHERE status = 'pending')::int AS reported_posts,
        (SELECT COUNT(*) FROM posts WHERE hidden_at IS NOT NULL)::int AS hidden_posts,
        (SELECT COUNT(*) FROM users WHERE account_type = 'human')::int AS total_users,
        (SELECT COUNT(*) FROM users WHERE status = 'suspended')::int AS suspended_users,
        (SELECT COUNT(*) FROM users WHERE account_type = 'human' AND created_at > NOW() - INTERVAL '7 days')::int AS new_users_7d
    `)
    const r = res.rows[0]
    return {
      pendingReports: r.pending_reports,
      reportedPosts: r.reported_posts,
      hiddenPosts: r.hidden_posts,
      totalUsers: r.total_users,
      suspendedUsers: r.suspended_users,
      newUsers7d: r.new_users_7d
    }
  }

  // Báo cáo gom theo bài viết: pending = chờ xử lý, resolved = đã xử lý gần đây
  async listReports(status: 'pending' | 'resolved' = 'pending', limit = 50): Promise<AdminReportedPost[]> {
    const res = await this.db.query(
      `SELECT p.id AS post_id, p.title, p.content, p.created_at, p.hidden_at,
              u.id AS author_id, u.username, u.display_name, u.avatar_url, u.status AS author_status,
              COUNT(r.id)::int AS report_count,
              MAX(r.created_at) AS last_reported_at,
              (SELECT json_agg(json_build_object('reason', x.reason, 'count', x.cnt) ORDER BY x.cnt DESC)
                 FROM (SELECT reason, COUNT(*)::int AS cnt FROM post_reports
                       WHERE post_id = p.id AND ($1 = 'pending') = (status = 'pending')
                       GROUP BY reason) x) AS reasons,
              (ARRAY_AGG(r.details ORDER BY r.created_at DESC) FILTER (WHERE r.details IS NOT NULL AND r.details <> ''))[1:5] AS details
       FROM post_reports r
       JOIN posts p ON p.id = r.post_id
       JOIN users u ON u.id = p.author_id
       WHERE ($1 = 'pending') = (r.status = 'pending')
       GROUP BY p.id, u.id
       ORDER BY ${status === 'pending' ? 'report_count DESC, last_reported_at DESC' : 'last_reported_at DESC'}
       LIMIT $2`,
      [status, Math.min(100, Math.max(1, limit))]
    )
    return res.rows.map((row) => ({
      postId: row.post_id,
      title: row.title,
      content: row.content,
      createdAt: new Date(row.created_at).toISOString(),
      hiddenAt: row.hidden_at ? new Date(row.hidden_at).toISOString() : null,
      author: {
        id: row.author_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        status: row.author_status
      },
      reportCount: row.report_count,
      reasons: row.reasons || [],
      details: row.details || [],
      lastReportedAt: new Date(row.last_reported_at).toISOString()
    }))
  }

  // Ẩn bài + đóng mọi báo cáo đang chờ của bài đó (ACID)
  async hidePost(adminId: string, postId: string, reason?: string): Promise<{ hidden: boolean }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE posts SET hidden_at = NOW(), hidden_by = $2, hidden_reason = $3
         WHERE id = $1 AND hidden_at IS NULL RETURNING id`,
        [postId, adminId, reason || null]
      )
      if (res.rowCount === 0) await this.assertPostExists(client, postId)
      const closed = await this.resolveReports(client, adminId, postId, 'hidden')
      await this.audit(client, adminId, { action: 'post.hide', targetType: 'post', targetId: postId, details: { reason, closedReports: closed } })
    })
    return { hidden: true }
  }

  async unhidePost(adminId: string, postId: string): Promise<{ hidden: boolean }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL WHERE id = $1 RETURNING id`,
        [postId]
      )
      if (res.rowCount === 0) throw new NotFoundException('Bài viết không tồn tại')
      await this.audit(client, adminId, { action: 'post.unhide', targetType: 'post', targetId: postId })
    })
    return { hidden: false }
  }

  // Bỏ qua báo cáo: bài giữ nguyên
  async dismissReports(adminId: string, postId: string): Promise<{ dismissed: number }> {
    return this.db.transaction(async (client) => {
      await this.assertPostExists(client, postId)
      const closed = await this.resolveReports(client, adminId, postId, 'dismissed')
      await this.audit(client, adminId, { action: 'report.dismiss', targetType: 'post', targetId: postId, details: { closedReports: closed } })
      return { dismissed: closed }
    })
  }

  async listUsers(q?: string, status?: string, limit = 50): Promise<AdminUserRow[]> {
    const params: unknown[] = []
    let where = `WHERE u.account_type = 'human'`
    if (q?.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`)
      where += ` AND (LOWER(u.username) LIKE $${params.length} OR LOWER(u.email) LIKE $${params.length} OR LOWER(u.display_name) LIKE $${params.length})`
    }
    if (status === 'suspended' || status === 'active') {
      params.push(status)
      where += ` AND u.status = $${params.length}::account_status_enum`
    }
    params.push(Math.min(100, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.email, u.avatar_url, u.role, u.status,
              u.suspended_at, u.suspended_reason, u.created_at,
              (SELECT COUNT(*) FROM posts p WHERE p.author_id = u.id)::int AS post_count,
              (SELECT COUNT(*) FROM post_reports r JOIN posts p ON p.id = r.post_id WHERE p.author_id = u.id)::int AS report_count
       FROM users u
       ${where}
       ORDER BY (u.status = 'suspended') DESC, u.created_at DESC
       LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: row.id,
      username: row.username,
      displayName: row.display_name,
      email: row.email,
      avatarUrl: row.avatar_url,
      role: row.role,
      status: row.status,
      suspendedAt: row.suspended_at ? new Date(row.suspended_at).toISOString() : null,
      suspendedReason: row.suspended_reason,
      postCount: row.post_count,
      reportCount: row.report_count,
      createdAt: new Date(row.created_at).toISOString()
    }))
  }

  // Khóa tài khoản: chặn đăng nhập, hủy mọi phiên + ngắt socket đang mở
  async suspendUser(adminId: string, userId: string, reason?: string): Promise<{ status: string }> {
    if (adminId === userId) throw new BadRequestException('Không thể tự khóa tài khoản của mình')
    await this.db.transaction(async (client) => {
      const target = await client.query(`SELECT role, account_type FROM users WHERE id = $1 FOR UPDATE`, [userId])
      if (target.rows.length === 0) throw new NotFoundException('Người dùng không tồn tại')
      if (target.rows[0].role === 'admin' || target.rows[0].account_type !== 'human') {
        throw new ForbiddenException('Không thể khóa tài khoản quản trị hoặc tài khoản hệ thống')
      }
      await client.query(
        `UPDATE users SET status = 'suspended', suspended_at = NOW(), suspended_reason = $2, updated_at = NOW() WHERE id = $1`,
        [userId, reason || null]
      )
      await client.query(`DELETE FROM user_sessions WHERE sess::jsonb #>> '{passport,user,id}' = $1`, [userId])
      await this.audit(client, adminId, { action: 'user.suspend', targetType: 'user', targetId: userId, details: { reason } })
    })
    this.realtime.disconnectUser(userId)
    return { status: 'suspended' }
  }

  async unsuspendUser(adminId: string, userId: string): Promise<{ status: string }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE users SET status = 'active', suspended_at = NULL, suspended_reason = NULL, updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [userId]
      )
      if (res.rowCount === 0) throw new NotFoundException('Người dùng không tồn tại')
      await this.audit(client, adminId, { action: 'user.unsuspend', targetType: 'user', targetId: userId })
    })
    return { status: 'active' }
  }

  // Xem dữ liệu cá nhân hóa của 1 người — dữ liệu nhạy cảm ⇒ luôn ghi nhật ký
  // Personalisation snapshot; every view is audited
  async userInsight(adminId: string, userId: string): Promise<UserInsight> {
    const insight = await this.insight.get(userId)
    await this.db.transaction((client) => this.audit(client, adminId, { action: 'user.insight_view', targetType: 'user', targetId: userId }))
    return insight
  }

  async listAuditLogs(limit = 50): Promise<AdminAuditLog[]> {
    const res = await this.db.query(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at,
              u.id AS admin_id, u.username, u.display_name
       FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id
       ORDER BY l.created_at DESC LIMIT $1`,
      [Math.min(200, Math.max(1, limit))]
    )
    return res.rows.map((row) => ({
      id: String(row.id),
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      details: row.details,
      createdAt: new Date(row.created_at).toISOString(),
      admin: row.admin_id ? { id: row.admin_id, username: row.username, displayName: row.display_name } : null
    }))
  }

  // Từ khóa tìm không ra kết quả (search_logs không lưu user ⇒ ẩn danh)
  async zeroResultQueries(days = 30, limit = 50): Promise<ZeroResultQuery[]> {
    const res = await this.db.query(
      `SELECT q_norm, COUNT(*)::int AS cnt, MAX(created_at) AS last_at
       FROM search_logs
       WHERE result_count = 0 AND created_at > NOW() - make_interval(days => $1)
       GROUP BY q_norm
       ORDER BY cnt DESC, last_at DESC
       LIMIT $2`,
      [Math.min(365, Math.max(1, days)), Math.min(200, Math.max(1, limit))]
    )
    return res.rows.map((row) => ({ query: row.q_norm, count: row.cnt, lastSearchedAt: new Date(row.last_at).toISOString() }))
  }

  private async assertPostExists(client: PoolClient, postId: string) {
    const res = await client.query(`SELECT 1 FROM posts WHERE id = $1`, [postId])
    if (res.rows.length === 0) throw new NotFoundException('Bài viết không tồn tại')
  }

  private async resolveReports(client: PoolClient, adminId: string, postId: string, resolution: 'hidden' | 'dismissed') {
    const res = await client.query(
      `UPDATE post_reports SET status = 'resolved', resolution = $3, resolved_by = $2, resolved_at = NOW()
       WHERE post_id = $1 AND status = 'pending'`,
      [postId, adminId, resolution]
    )
    return res.rowCount ?? 0
  }

  private async audit(client: PoolClient, adminId: string, entry: AuditEntry) {
    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details) VALUES ($1, $2, $3, $4, $5)`,
      [adminId, entry.action, entry.targetType, entry.targetId, entry.details ? JSON.stringify(entry.details) : null]
    )
  }
}
