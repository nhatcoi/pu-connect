import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  AdminAiOverview,
  AdminBulkCommentInput,
  AdminBulkPostInput,
  AdminBulkResult,
  AdminCourseInput,
  AdminCourseRow,
  AdminModerateSkillInput,
  AdminSessionInfo,
  AdminStats,
  AdminTicketStatusInput,
  AdminUserRole,
  TopSearchQuery,
  ZeroResultQuery
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { setTrashActor } from '../../database/trash'
import { NotificationsService } from '../notifications/notifications.service'
import { type AuditEntry, writeAudit } from './admin-audit'
import { effectivePermissions } from './admin-permissions'

// Tên lĩnh vực của môn vừa ghi (dùng trong RETURNING)
const FIELD_NAME_OF_COURSE = `(SELECT x.name FROM interest_fields x WHERE x.id = courses.interest_field_id)`

@Injectable()
export class AdminService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  // Thông tin phiên quản trị & danh sách quyền RBAC của người đang đăng nhập
  async getSessionInfo(userId: string): Promise<AdminSessionInfo> {
    const res = await this.db.query(
      `SELECT id, username, display_name, email, avatar_url, role FROM users WHERE id = $1 LIMIT 1`,
      [userId]
    )
    const row = res.rows[0]
    if (!row) throw new NotFoundException('Không tìm thấy tài khoản quản trị')
    const role = row.role as AdminUserRole
    return {
      user: {
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        email: row.email,
        avatarUrl: row.avatar_url,
        role
      },
      permissions: await effectivePermissions(this.db, userId, role)
    }
  }

  // ── 1. Command Center Dashboard ──────────────────────────────────────────

  async getStats(): Promise<AdminStats> {
    const [kpiRes, roleRes] = await Promise.all([
      this.db.query(`
        SELECT
          (SELECT COUNT(*) FROM post_reports WHERE status = 'pending')::int AS pending_reports,
          (SELECT COUNT(*) FROM moderation_events WHERE review_status = 'pending' AND action <> 'block')::int AS pending_moderation,
          (SELECT COUNT(*) FROM unit_requests WHERE status = 'pending')::int AS pending_unit_requests,
          (SELECT COUNT(DISTINCT post_id) FROM post_reports WHERE status = 'pending')::int AS reported_posts,
          (SELECT COUNT(*) FROM posts WHERE hidden_at IS NOT NULL)::int AS hidden_posts,
          (SELECT COUNT(*) FROM posts)::int AS total_posts,
          (SELECT COUNT(*) FROM comments)::int AS total_comments,
          (SELECT COUNT(*) FROM users WHERE account_type = 'human')::int AS total_users,
          (SELECT COUNT(*) FROM users WHERE status = 'suspended')::int AS suspended_users,
          (SELECT COUNT(*) FROM users WHERE account_type = 'human' AND created_at > NOW() - INTERVAL '7 days')::int AS new_users_7d,
          (SELECT COUNT(*) FROM users WHERE account_type = 'human' AND last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_users_24h,
          (SELECT COUNT(*) FROM users WHERE account_type = 'human' AND is_verified = TRUE)::int AS verified_users,
          (SELECT COUNT(*) FROM documents)::int AS total_documents,
          (SELECT COUNT(*) FROM courses)::int AS total_courses,
          (SELECT COUNT(*) FROM communities)::int AS total_communities,
          (SELECT COUNT(*) FROM study_groups)::int AS total_study_groups,
          (SELECT COUNT(*) FROM ai_runs WHERE created_at > NOW() - INTERVAL '24 hours')::int AS ai_runs_24h,
          (SELECT COUNT(*) FROM ai_runs WHERE status = 'error' AND created_at > NOW() - INTERVAL '24 hours')::int AS ai_error_runs_24h,
          (SELECT COALESCE(SUM(COALESCE(input_tokens, 0) + COALESCE(output_tokens, 0)), 0) FROM ai_runs WHERE created_at > NOW() - INTERVAL '24 hours')::int AS ai_tokens_24h,
          (SELECT COALESCE(ROUND(AVG(latency_ms)), 0) FROM ai_runs WHERE latency_ms IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours')::int AS ai_avg_latency_24h,
          (SELECT COUNT(*) FROM ai_support_tickets WHERE status = 'open')::int AS open_support_tickets
      `),
      this.db.query(`
        SELECT role, COUNT(*)::int AS count
        FROM users
        WHERE account_type = 'human'
        GROUP BY role
        ORDER BY count DESC
      `)
    ])
    const r = kpiRes.rows[0]
    return {
      pendingReports: r.pending_reports,
      pendingModeration: r.pending_moderation,
      pendingUnitRequests: r.pending_unit_requests,
      reportedPosts: r.reported_posts,
      hiddenPosts: r.hidden_posts,
      totalPosts: r.total_posts,
      totalComments: r.total_comments,
      totalUsers: r.total_users,
      suspendedUsers: r.suspended_users,
      newUsers7d: r.new_users_7d,
      activeUsers24h: r.active_users_24h,
      verifiedUsers: r.verified_users,
      totalDocuments: r.total_documents,
      totalCourses: r.total_courses,
      totalCommunities: r.total_communities,
      totalStudyGroups: r.total_study_groups,
      aiRuns24h: r.ai_runs_24h,
      aiErrorRuns24h: r.ai_error_runs_24h,
      aiTokens24h: r.ai_tokens_24h,
      aiAvgLatencyMs24h: r.ai_avg_latency_24h,
      openSupportTickets: r.open_support_tickets,
      roleDistribution: roleRes.rows.map((row) => ({ role: row.role as AdminUserRole, count: row.count }))
    }
  }

  // ── 2. Trust & Safety / Content Moderation ───────────────────────────────

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
      const res = await client.query(`UPDATE posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL WHERE id = $1 RETURNING id`, [postId])
      if (res.rowCount === 0) throw new NotFoundException('Bài viết không tồn tại')
      await this.audit(client, adminId, { action: 'post.unhide', targetType: 'post', targetId: postId })
    })
    return { hidden: false }
  }

  async pinPost(adminId: string, postId: string, isPinned: boolean): Promise<{ isPinned: boolean }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(`UPDATE posts SET is_pinned = $2, updated_at = NOW() WHERE id = $1 RETURNING id`, [postId, isPinned])
      if (res.rowCount === 0) throw new NotFoundException('Bài viết không tồn tại')
      await this.audit(client, adminId, { action: isPinned ? 'post.pin' : 'post.unpin', targetType: 'post', targetId: postId })
    })
    return { isPinned }
  }

  async dismissReports(adminId: string, postId: string): Promise<{ dismissed: number }> {
    return this.db.transaction(async (client) => {
      await this.assertPostExists(client, postId)
      const closed = await this.resolveReports(client, adminId, postId, 'dismissed')
      await this.audit(client, adminId, { action: 'report.dismiss', targetType: 'post', targetId: postId, details: { closedReports: closed } })
      return { dismissed: closed }
    })
  }

  // Xóa bình luận vi phạm + cập nhật lại bộ đếm comments_count trên bài viết (ACID)
  async deleteComment(adminId: string, commentId: string, reason?: string): Promise<{ deleted: boolean }> {
    await this.db.transaction(async (client) => {
      const target = await client.query(`SELECT id, post_id, author_id, left(content, 120) AS snippet FROM comments WHERE id = $1 FOR UPDATE`, [commentId])
      if (target.rows.length === 0) throw new NotFoundException('Bình luận không tồn tại')
      const { post_id: postId, snippet } = target.rows[0]
      await setTrashActor(client, adminId)
      await client.query(`DELETE FROM comments WHERE id = $1`, [commentId])
      await client.query(
        `UPDATE posts SET comments_count = (SELECT COUNT(*)::int FROM comments WHERE post_id = $1) WHERE id = $1`,
        [postId]
      )
      await this.audit(client, adminId, {
        action: 'comment.delete',
        targetType: 'comment',
        targetId: commentId,
        details: { postId, snippet, reason }
      })
    })
    return { deleted: true }
  }

  // ── 3. Users → admin-users.service.ts ──────────────────────────────────

  // ── 4. N7AI Operations & Telemetry ──────────────────────────────────────

  async getAiOverview(): Promise<AdminAiOverview> {
    const [summaryRes, dailyRes, byTaskRes, errorsRes, topUsersRes] = await Promise.all([
      this.db.query(`
        SELECT
          (SELECT COUNT(*) FROM ai_runs WHERE created_at > NOW() - INTERVAL '24 hours')::int AS runs_24h,
          (SELECT COUNT(*) FROM ai_runs WHERE created_at > NOW() - INTERVAL '7 days')::int AS runs_7d,
          (SELECT COUNT(*) FROM ai_runs WHERE status = 'error' AND created_at > NOW() - INTERVAL '24 hours')::int AS error_runs_24h,
          (SELECT COALESCE(SUM(input_tokens), 0) FROM ai_runs WHERE created_at > NOW() - INTERVAL '24 hours')::int AS input_tokens_24h,
          (SELECT COALESCE(SUM(output_tokens), 0) FROM ai_runs WHERE created_at > NOW() - INTERVAL '24 hours')::int AS output_tokens_24h,
          (SELECT COALESCE(ROUND(AVG(latency_ms)), 0) FROM ai_runs WHERE latency_ms IS NOT NULL AND created_at > NOW() - INTERVAL '24 hours')::int AS avg_latency_24h,
          (SELECT COUNT(*) FROM ai_tasks WHERE enabled = TRUE)::int AS active_tasks,
          (SELECT COUNT(*) FROM ai_skills WHERE is_public = TRUE AND enabled = TRUE)::int AS public_skills
      `),
      this.db.query(`
        SELECT
          to_char(d, 'YYYY-MM-DD') AS date,
          COUNT(r.id)::int AS runs,
          COUNT(r.id) FILTER (WHERE r.status = 'error')::int AS errors,
          COALESCE(SUM(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0)), 0)::int AS tokens
        FROM generate_series((NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date - 6, (NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh')::date, interval '1 day') d
        LEFT JOIN ai_runs r ON (r.created_at AT TIME ZONE 'Asia/Ho_Chi_Minh')::date = d::date
        GROUP BY d
        ORDER BY d
      `),
      this.db.query(`
        SELECT
          task,
          COUNT(*)::int AS count,
          COALESCE(ROUND(AVG(latency_ms)), 0)::int AS avg_latency_ms,
          COUNT(*) FILTER (WHERE status = 'error')::int AS errors
        FROM ai_runs
        WHERE created_at > NOW() - INTERVAL '7 days'
        GROUP BY task
        ORDER BY count DESC
      `),
      this.db.query(`
        SELECT r.id, r.task, r.model, left(r.error, 300) AS error, r.latency_ms, r.created_at, u.username
        FROM ai_runs r
        LEFT JOIN users u ON u.id = r.requester_id
        WHERE r.status = 'error'
        ORDER BY r.created_at DESC
        LIMIT 15
      `),
      this.db.query(`
        SELECT u.id AS user_id, u.username, u.display_name,
               COUNT(r.id)::int AS runs,
               COALESCE(SUM(COALESCE(r.input_tokens, 0) + COALESCE(r.output_tokens, 0)), 0)::int AS tokens
        FROM ai_runs r
        JOIN users u ON u.id = r.requester_id
        WHERE r.created_at > NOW() - INTERVAL '7 days'
        GROUP BY u.id
        ORDER BY runs DESC, tokens DESC
        LIMIT 10
      `)
    ])

    const s = summaryRes.rows[0]
    return {
      runs24h: s.runs_24h,
      runs7d: s.runs_7d,
      errorRuns24h: s.error_runs_24h,
      inputTokens24h: s.input_tokens_24h,
      outputTokens24h: s.output_tokens_24h,
      avgLatencyMs24h: s.avg_latency_24h,
      activeTasksCount: s.active_tasks,
      publicSkillsCount: s.public_skills,
      dailySeries: dailyRes.rows,
      byTask: byTaskRes.rows.map((row) => ({
        task: row.task,
        count: row.count,
        avgLatencyMs: row.avg_latency_ms,
        errors: row.errors
      })),
      recentErrors: errorsRes.rows.map((row) => ({
        id: row.id,
        task: row.task,
        model: row.model,
        error: row.error,
        latencyMs: row.latency_ms,
        createdAt: new Date(row.created_at).toISOString(),
        requesterUsername: row.username
      })),
      topUsers7d: topUsersRes.rows.map((row) => ({
        userId: row.user_id,
        username: row.username,
        displayName: row.display_name,
        runs: row.runs,
        tokens: row.tokens
      }))
    }
  }

  async updateTicketStatus(adminId: string, ticketId: string, input: AdminTicketStatusInput): Promise<{ status: string }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(`UPDATE ai_support_tickets SET status = $2 WHERE id = $1 RETURNING id`, [ticketId, input.status])
      if (res.rowCount === 0) throw new NotFoundException('Không tìm thấy yêu cầu hỗ trợ')
      await this.audit(client, adminId, {
        action: 'ai.ticket_status',
        targetType: 'ai_ticket',
        targetId: ticketId,
        details: { status: input.status }
      })
    })
    return { status: input.status }
  }

  async moderateSkill(adminId: string, skillId: string, input: AdminModerateSkillInput): Promise<{ id: string }> {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE ai_skills
         SET is_public = COALESCE($2, is_public),
             enabled = COALESCE($3, enabled),
             updated_at = NOW()
         WHERE id = $1 RETURNING id`,
        [skillId, input.isPublic ?? null, input.enabled ?? null]
      )
      if (res.rowCount === 0) throw new NotFoundException('Skill không tồn tại')
      await this.audit(client, adminId, {
        action: 'ai.skill_moderate',
        targetType: 'ai_skill',
        targetId: skillId,
        details: { isPublic: input.isPublic, enabled: input.enabled, reason: input.reason }
      })
    })
    return { id: skillId }
  }

  // ── 5. Academic, Documents & Communities ─────────────────────────────────

  async createCourse(adminId: string, input: AdminCourseInput): Promise<AdminCourseRow> {
    return this.db.transaction(async (client) => {
      const exists = await client.query(`SELECT 1 FROM courses WHERE UPPER(code) = $1`, [input.code.toUpperCase()])
      if (exists.rows.length > 0) throw new ConflictException(`Mã môn học ${input.code} đã tồn tại`)

      const res = await client.query(
        `INSERT INTO courses (code, name, credits, interest_field_id, description, syllabus_url)
         VALUES ($1, $2, $3, $4, $5, $6)
         RETURNING id, code, name, credits, interest_field_id, ${FIELD_NAME_OF_COURSE} AS field_name, description, syllabus_url, document_count, post_count, rating_avg, created_at`,
        [
          input.code.toUpperCase(),
          input.name,
          input.credits,
          input.fieldId ?? null,
          input.description || null,
          input.syllabusUrl || null
        ]
      )
      const row = res.rows[0]
      await this.audit(client, adminId, {
        action: 'course.create',
        targetType: 'course',
        targetId: row.id,
        details: { code: row.code, name: row.name }
      })
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        credits: row.credits ?? 3,
        fieldId: row.interest_field_id,
        fieldName: row.field_name,
        description: row.description,
        syllabusUrl: row.syllabus_url,
        documentCount: row.document_count ?? 0,
        postCount: row.post_count ?? 0,
        ratingAvg: Number(row.rating_avg ?? 0),
        createdAt: new Date(row.created_at).toISOString()
      }
    })
  }

  async updateCourse(adminId: string, courseId: string, input: AdminCourseInput): Promise<AdminCourseRow> {
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE courses
         SET code = $2, name = $3, credits = $4, interest_field_id = $5,
             description = $6, syllabus_url = $7, updated_at = NOW()
         WHERE id = $1
         RETURNING id, code, name, credits, interest_field_id, ${FIELD_NAME_OF_COURSE} AS field_name, description, syllabus_url, document_count, post_count, rating_avg, created_at`,
        [
          courseId,
          input.code.toUpperCase(),
          input.name,
          input.credits,
          input.fieldId ?? null,
          input.description || null,
          input.syllabusUrl || null
        ]
      )
      if (res.rowCount === 0) throw new NotFoundException('Môn học không tồn tại')
      const row = res.rows[0]
      await this.audit(client, adminId, {
        action: 'course.update',
        targetType: 'course',
        targetId: courseId,
        details: { code: row.code, name: row.name }
      })
      return {
        id: row.id,
        code: row.code,
        name: row.name,
        credits: row.credits ?? 3,
        fieldId: row.interest_field_id,
        fieldName: row.field_name,
        description: row.description,
        syllabusUrl: row.syllabus_url,
        documentCount: row.document_count ?? 0,
        postCount: row.post_count ?? 0,
        ratingAvg: Number(row.rating_avg ?? 0),
        createdAt: new Date(row.created_at).toISOString()
      }
    })
  }

  // Xóa tài liệu vi phạm (lộ đề thi / bản quyền) + cập nhật bộ đếm môn học (ACID)
  async deleteDocument(adminId: string, docId: string, reason?: string): Promise<{ deleted: boolean }> {
    await this.db.transaction(async (client) => {
      const target = await client.query(`SELECT id, title, course_id FROM documents WHERE id = $1 FOR UPDATE`, [docId])
      if (target.rows.length === 0) throw new NotFoundException('Tài liệu không tồn tại')
      const { title, course_id: courseId } = target.rows[0]
      await setTrashActor(client, adminId)
      await client.query(`DELETE FROM documents WHERE id = $1`, [docId])
      if (courseId) {
        await client.query(
          `UPDATE courses SET document_count = (SELECT COUNT(*)::int FROM documents WHERE course_id = $1) WHERE id = $1`,
          [courseId]
        )
      }
      await this.audit(client, adminId, {
        action: 'document.delete',
        targetType: 'document',
        targetId: docId,
        details: { title, reason }
      })
    })
    return { deleted: true }
  }

  // ── 6. Search Intelligence, Broadcast & Audit Trail ──────────────────────

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

  async topSearchQueries(days = 30, limit = 50): Promise<TopSearchQuery[]> {
    const res = await this.db.query(
      `SELECT q_norm, COUNT(*)::int AS cnt, ROUND(AVG(result_count))::int AS avg_res, MAX(created_at) AS last_at
       FROM search_logs
       WHERE result_count > 0 AND created_at > NOW() - make_interval(days => $1)
       GROUP BY q_norm
       ORDER BY cnt DESC, last_at DESC
       LIMIT $2`,
      [Math.min(365, Math.max(1, days)), Math.min(200, Math.max(1, limit))]
    )
    return res.rows.map((row) => ({
      query: row.q_norm,
      count: row.cnt,
      avgResults: row.avg_res ?? 0,
      lastSearchedAt: new Date(row.last_at).toISOString()
    }))
  }

  // Phát thông báo hệ thống tới toàn bộ người dùng hoặc theo vai trò (ACID)
  // ── Hàng loạt: bài viết (1 transaction, SQL theo tập, audit 1 dòng/bài) ──
  async bulkPosts(adminId: string, input: AdminBulkPostInput): Promise<AdminBulkResult> {
    const ids = [...new Set(input.ids)]
    const changed = await this.db.transaction(async (client) => {
      let rows: { id: string }[] = []
      switch (input.action) {
        case 'hide':
          rows = (
            await client.query(
              `UPDATE posts SET hidden_at = NOW(), hidden_by = $2, hidden_reason = $3
               WHERE id = ANY($1::uuid[]) AND hidden_at IS NULL RETURNING id`,
              [ids, adminId, input.reason || null]
            )
          ).rows
          // Ẩn bài ⇒ đóng báo cáo đang chờ của bài đó
          await this.resolveReportsMany(client, adminId, ids, 'hidden')
          break
        case 'unhide':
          rows = (
            await client.query(
              `UPDATE posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
               WHERE id = ANY($1::uuid[]) AND hidden_at IS NOT NULL RETURNING id`,
              [ids]
            )
          ).rows
          break
        case 'pin':
        case 'unpin':
          rows = (
            await client.query(
              `UPDATE posts SET is_pinned = $2, updated_at = NOW() WHERE id = ANY($1::uuid[]) AND is_pinned IS DISTINCT FROM $2 RETURNING id`,
              [ids, input.action === 'pin']
            )
          ).rows
          break
        case 'dismiss':
          rows = (
            await client.query(
              `UPDATE post_reports SET status = 'resolved', resolution = 'dismissed', resolved_by = $2, resolved_at = NOW()
               WHERE post_id = ANY($1::uuid[]) AND status = 'pending' RETURNING post_id AS id`,
              [ids, adminId]
            )
          ).rows
          break
      }
      const action = { hide: 'post.hide', unhide: 'post.unhide', pin: 'post.pin', unpin: 'post.unpin', dismiss: 'report.dismiss' }[input.action]
      const changedIds = [...new Set(rows.map((r) => r.id))]
      await this.auditMany(client, adminId, action, 'post', changedIds, { reason: input.reason, bulk: ids.length > 1 ? ids.length : undefined })
      return changedIds
    })
    return { affected: changed.length, skipped: ids.length - changed.length }
  }

  // Xóa nhiều bình luận + đếm lại comments_count cho các bài liên quan
  async bulkComments(adminId: string, input: AdminBulkCommentInput): Promise<AdminBulkResult> {
    const ids = [...new Set(input.ids)]
    if (input.action === 'dismiss') return this.dismissCommentReports(adminId, ids)
    const deleted = await this.db.transaction(async (client) => {
      await setTrashActor(client, adminId)
      const res = await client.query(
        `DELETE FROM comments WHERE id = ANY($1::uuid[]) RETURNING id, post_id, left(content, 120) AS snippet`,
        [ids]
      )
      const postIds = [...new Set(res.rows.map((r) => r.post_id))]
      if (postIds.length) {
        await client.query(
          `UPDATE posts p SET comments_count = (SELECT COUNT(*)::int FROM comments c WHERE c.post_id = p.id) WHERE p.id = ANY($1::uuid[])`,
          [postIds]
        )
      }
      for (const r of res.rows) {
        await this.audit(client, adminId, {
          action: 'comment.delete',
          targetType: 'comment',
          targetId: r.id,
          details: { postId: r.post_id, snippet: r.snippet, reason: input.reason, bulk: ids.length > 1 ? ids.length : undefined }
        })
      }
      return res.rowCount ?? 0
    })
    return { affected: deleted, skipped: ids.length - deleted }
  }

  // Bỏ qua báo cáo bình luận: đóng báo cáo đang chờ, giữ nguyên bình luận
  private async dismissCommentReports(adminId: string, ids: string[]): Promise<AdminBulkResult> {
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE comment_reports SET status = 'resolved', resolution = 'dismissed', resolved_by = $2, resolved_at = NOW()
         WHERE comment_id = ANY($1::uuid[]) AND status = 'pending' RETURNING comment_id`,
        [ids, adminId]
      )
      const done = [...new Set(res.rows.map((r) => r.comment_id as string))]
      for (const id of done) {
        await this.audit(client, adminId, { action: 'report.dismiss', targetType: 'comment', targetId: id, details: { bulk: ids.length > 1 ? ids.length : undefined } })
      }
      return { affected: done.length, skipped: ids.length - done.length }
    })
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

  private async resolveReportsMany(client: PoolClient, adminId: string, postIds: string[], resolution: 'hidden' | 'dismissed') {
    await client.query(
      `UPDATE post_reports SET status = 'resolved', resolution = $3, resolved_by = $2, resolved_at = NOW()
       WHERE post_id = ANY($1::uuid[]) AND status = 'pending'`,
      [postIds, adminId, resolution]
    )
  }

  // Nhật ký theo tập: 1 câu INSERT cho nhiều đối tượng
  private async auditMany(client: PoolClient, adminId: string, action: string, targetType: string, ids: string[], details?: Record<string, unknown>) {
    if (!ids.length) return
    await client.query(
      `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
       SELECT $1, $2, $3, t, $5::jsonb FROM unnest($4::text[]) t`,
      [adminId, action, targetType, ids, details ? JSON.stringify(details) : null]
    )
  }

  // Ghi nhật ký cho thao tác chỉ đọc (VD: xuất CSV)
  logAction(adminId: string, entry: AuditEntry) {
    return this.db.transaction((client) => writeAudit(client, adminId, entry))
  }

  private audit(client: PoolClient, adminId: string, entry: AuditEntry) {
    return writeAudit(client, adminId, entry)
  }
}
