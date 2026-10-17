import { ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  AdminAiOverview,
  AdminAiSkillRow,
  AdminAuditLog,
  AdminBroadcastInput,
  AdminCommentRow,
  AdminCommunityRow,
  AdminCourseInput,
  AdminCourseRow,
  AdminDocumentRow,
  AdminModerateSkillInput,
  AdminPostRow,
  AdminReportedPost,
  AdminSessionInfo,
  AdminStats,
  AdminTicketStatusInput,
  AdminUserRole,
  TopSearchQuery,
  ZeroResultQuery
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'
import { type AuditEntry, writeAudit } from './admin-audit'
import { getRolePermissions } from './dto/admin.dto'


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
      permissions: getRolePermissions(role)
    }
  }

  // ── 1. Command Center Dashboard ──────────────────────────────────────────

  async getStats(): Promise<AdminStats> {
    const [kpiRes, roleRes] = await Promise.all([
      this.db.query(`
        SELECT
          (SELECT COUNT(*) FROM post_reports WHERE status = 'pending')::int AS pending_reports,
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

  async listPosts(q?: string, filter?: string, limit = 50): Promise<AdminPostRow[]> {
    const params: unknown[] = []
    let where = 'WHERE 1=1'
    if (q?.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`)
      where += ` AND (LOWER(COALESCE(p.title, '')) LIKE $${params.length} OR LOWER(p.content) LIKE $${params.length} OR LOWER(u.username) LIKE $${params.length})`
    }
    if (filter === 'hidden') where += ` AND p.hidden_at IS NOT NULL`
    else if (filter === 'pinned') where += ` AND p.is_pinned = TRUE`
    else if (filter === 'qna_unsolved') where += ` AND p.post_type = 'question' AND p.is_resolved = FALSE`

    params.push(Math.min(100, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT p.id, p.title, p.content, p.post_type, p.tags, p.is_pinned, p.is_resolved,
              p.likes_count, p.comments_count, p.views_count, p.hidden_at, p.hidden_reason, p.created_at,
              c.code AS course_code, cm.name AS community_name,
              u.id AS author_id, u.username, u.display_name, u.avatar_url, u.role AS author_role,
              (SELECT COUNT(*) FROM post_reports r WHERE r.post_id = p.id)::int AS report_count
       FROM posts p
       JOIN users u ON u.id = p.author_id
       LEFT JOIN courses c ON c.id = p.course_id
       LEFT JOIN communities cm ON cm.id = p.community_id
       ${where}
       ORDER BY p.is_pinned DESC, p.created_at DESC
       LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      content: row.content,
      postType: row.post_type,
      tags: row.tags || [],
      isPinned: !!row.is_pinned,
      isResolved: !!row.is_resolved,
      likesCount: row.likes_count,
      commentsCount: row.comments_count,
      viewsCount: row.views_count,
      reportCount: row.report_count,
      hiddenAt: row.hidden_at ? new Date(row.hidden_at).toISOString() : null,
      hiddenReason: row.hidden_reason,
      createdAt: new Date(row.created_at).toISOString(),
      courseCode: row.course_code,
      communityName: row.community_name,
      author: {
        id: row.author_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url,
        role: row.author_role
      }
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

  async listComments(q?: string, limit = 50): Promise<AdminCommentRow[]> {
    const params: unknown[] = []
    let where = 'WHERE 1=1'
    if (q?.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`)
      where += ` AND (LOWER(cm.content) LIKE $${params.length} OR LOWER(u.username) LIKE $${params.length})`
    }
    params.push(Math.min(100, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT cm.id, cm.post_id, cm.content, cm.likes_count, cm.is_solution, cm.created_at,
              p.title AS post_title,
              u.id AS author_id, u.username, u.display_name, u.avatar_url
       FROM comments cm
       JOIN posts p ON p.id = cm.post_id
       JOIN users u ON u.id = cm.author_id
       ${where}
       ORDER BY cm.created_at DESC
       LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: row.id,
      postId: row.post_id,
      postTitle: row.post_title,
      content: row.content,
      likesCount: row.likes_count,
      isSolution: !!row.is_solution,
      createdAt: new Date(row.created_at).toISOString(),
      author: {
        id: row.author_id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url
      }
    }))
  }

  // Xóa bình luận vi phạm + cập nhật lại bộ đếm comments_count trên bài viết (ACID)
  async deleteComment(adminId: string, commentId: string, reason?: string): Promise<{ deleted: boolean }> {
    await this.db.transaction(async (client) => {
      const target = await client.query(`SELECT id, post_id, author_id, left(content, 120) AS snippet FROM comments WHERE id = $1 FOR UPDATE`, [commentId])
      if (target.rows.length === 0) throw new NotFoundException('Bình luận không tồn tại')
      const { post_id: postId, snippet } = target.rows[0]
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

  async listAiSkills(onlyPublic = false, limit = 50): Promise<AdminAiSkillRow[]> {
    const res = await this.db.query(
      `SELECT s.id, s.slug, s.name, s.description, s.is_public, s.enabled, s.install_count, s.use_count, s.created_at,
              u.id AS owner_id, u.username, u.display_name
       FROM ai_skills s
       JOIN users u ON u.id = s.owner_id
       WHERE s.source_skill_id IS NULL ${onlyPublic ? 'AND s.is_public = TRUE' : ''}
       ORDER BY s.is_public DESC, s.install_count DESC, s.use_count DESC
       LIMIT $1`,
      [Math.min(100, Math.max(1, limit))]
    )
    return res.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      isPublic: !!row.is_public,
      enabled: !!row.enabled,
      installCount: row.install_count ?? 0,
      useCount: row.use_count ?? 0,
      createdAt: new Date(row.created_at).toISOString(),
      owner: {
        id: row.owner_id,
        username: row.username,
        displayName: row.display_name
      }
    }))
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

  async listCourses(q?: string, limit = 50): Promise<AdminCourseRow[]> {
    const params: unknown[] = []
    let where = 'WHERE 1=1'
    if (q?.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`)
      where += ` AND (LOWER(code) LIKE $${params.length} OR LOWER(name) LIKE $${params.length} OR LOWER(COALESCE(faculty_code, '')) LIKE $${params.length})`
    }
    params.push(Math.min(100, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT id, code, name, credits, faculty_code, description, syllabus_url,
              document_count, post_count, rating_avg, created_at
       FROM courses
       ${where}
       ORDER BY post_count DESC, document_count DESC, code ASC
       LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: row.id,
      code: row.code,
      name: row.name,
      credits: row.credits ?? 3,
      facultyCode: row.faculty_code,
      description: row.description,
      syllabusUrl: row.syllabus_url,
      documentCount: row.document_count ?? 0,
      postCount: row.post_count ?? 0,
      ratingAvg: Number(row.rating_avg ?? 0),
      createdAt: new Date(row.created_at).toISOString()
    }))
  }

  async createCourse(adminId: string, input: AdminCourseInput): Promise<AdminCourseRow> {
    return this.db.transaction(async (client) => {
      const exists = await client.query(`SELECT 1 FROM courses WHERE UPPER(code) = $1`, [input.code.toUpperCase()])
      if (exists.rows.length > 0) throw new ConflictException(`Mã môn học ${input.code} đã tồn tại`)

      const fac = await client.query(`SELECT id FROM faculties WHERE UPPER(code) = $1 LIMIT 1`, [input.facultyCode.toUpperCase()])
      const facultyId = fac.rows[0]?.id ?? null

      const res = await client.query(
        `INSERT INTO courses (code, name, credits, faculty_id, faculty_code, description, syllabus_url)
         VALUES ($1, $2, $3, $4, $5, $6, $7)
         RETURNING id, code, name, credits, faculty_code, description, syllabus_url, document_count, post_count, rating_avg, created_at`,
        [
          input.code.toUpperCase(),
          input.name,
          input.credits,
          facultyId,
          input.facultyCode.toUpperCase(),
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
        facultyCode: row.faculty_code,
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
      const fac = await client.query(`SELECT id FROM faculties WHERE UPPER(code) = $1 LIMIT 1`, [input.facultyCode.toUpperCase()])
      const facultyId = fac.rows[0]?.id ?? null

      const res = await client.query(
        `UPDATE courses
         SET code = $2, name = $3, credits = $4, faculty_id = $5, faculty_code = $6,
             description = $7, syllabus_url = $8, updated_at = NOW()
         WHERE id = $1
         RETURNING id, code, name, credits, faculty_code, description, syllabus_url, document_count, post_count, rating_avg, created_at`,
        [
          courseId,
          input.code.toUpperCase(),
          input.name,
          input.credits,
          facultyId,
          input.facultyCode.toUpperCase(),
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
        facultyCode: row.faculty_code,
        description: row.description,
        syllabusUrl: row.syllabus_url,
        documentCount: row.document_count ?? 0,
        postCount: row.post_count ?? 0,
        ratingAvg: Number(row.rating_avg ?? 0),
        createdAt: new Date(row.created_at).toISOString()
      }
    })
  }

  async listDocuments(q?: string, limit = 50): Promise<AdminDocumentRow[]> {
    const params: unknown[] = []
    let where = 'WHERE 1=1'
    if (q?.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`)
      where += ` AND (LOWER(d.title) LIKE $${params.length} OR LOWER(u.username) LIKE $${params.length} OR LOWER(COALESCE(c.code, '')) LIKE $${params.length})`
    }
    params.push(Math.min(100, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT d.id, d.title, d.doc_type, d.file_url, d.file_size, d.mime_type,
              d.download_count, d.view_count, d.created_at,
              c.code AS course_code,
              u.id AS owner_id, u.username, u.display_name,
              (SELECT COUNT(*) FROM document_chunks dc WHERE dc.document_id = d.id)::int AS chunk_count
       FROM documents d
       JOIN users u ON u.id = d.owner_id
       LEFT JOIN courses c ON c.id = d.course_id
       ${where}
       ORDER BY d.created_at DESC
       LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: row.id,
      title: row.title,
      docType: row.doc_type,
      fileUrl: row.file_url,
      fileSize: Number(row.file_size ?? 0),
      mimeType: row.mime_type,
      downloadCount: row.download_count ?? 0,
      viewCount: row.view_count ?? 0,
      chunkCount: row.chunk_count ?? 0,
      courseCode: row.course_code,
      createdAt: new Date(row.created_at).toISOString(),
      owner: {
        id: row.owner_id,
        username: row.username,
        displayName: row.display_name
      }
    }))
  }

  // Xóa tài liệu vi phạm (lộ đề thi / bản quyền) + cập nhật bộ đếm môn học (ACID)
  async deleteDocument(adminId: string, docId: string, reason?: string): Promise<{ deleted: boolean }> {
    await this.db.transaction(async (client) => {
      const target = await client.query(`SELECT id, title, course_id FROM documents WHERE id = $1 FOR UPDATE`, [docId])
      if (target.rows.length === 0) throw new NotFoundException('Tài liệu không tồn tại')
      const { title, course_id: courseId } = target.rows[0]
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

  async listCommunities(q?: string, limit = 50): Promise<AdminCommunityRow[]> {
    const params: unknown[] = []
    let where = 'WHERE 1=1'
    if (q?.trim()) {
      params.push(`%${q.trim().toLowerCase()}%`)
      where += ` AND (LOWER(name) LIKE $${params.length} OR LOWER(slug) LIKE $${params.length})`
    }
    params.push(Math.min(100, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT id, slug, name, description, community_type, members_count, posts_count, created_at
       FROM communities
       ${where}
       ORDER BY members_count DESC, posts_count DESC
       LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      communityType: row.community_type,
      membersCount: row.members_count ?? 0,
      postsCount: row.posts_count ?? 0,
      createdAt: new Date(row.created_at).toISOString()
    }))
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
  async broadcastSystemNotification(adminId: string, input: AdminBroadcastInput): Promise<{ sentCount: number }> {
    const sentCount = await this.db.transaction(async (client) => {
      const params: unknown[] = [input.title, input.message, input.link || null]
      let roleFilter = ''
      if (input.targetRole && input.targetRole !== 'all') {
        params.push(input.targetRole)
        roleFilter = `AND role = $${params.length}::user_role_enum`
      }
      const res = await client.query(
        `INSERT INTO notifications (recipient_id, actor_id, actor_ids, actors_count, type, title, message, link, updated_at)
         SELECT id, NULL, '{}'::uuid[], 1, 'account_verified'::notification_type_enum, $1, $2, $3, NOW()
         FROM users
         WHERE account_type = 'human' AND status = 'active' ${roleFilter}`,
        params
      )
      const count = res.rowCount ?? 0
      await this.audit(client, adminId, {
        action: 'system.broadcast',
        targetType: 'system',
        targetId: input.targetRole,
        details: { title: input.title, message: input.message, link: input.link, sentCount: count }
      })
      return count
    })
    return { sentCount }
  }

  async listAuditLogs(limit = 50, action?: string): Promise<AdminAuditLog[]> {
    const params: unknown[] = []
    let where = ''
    if (action?.trim()) {
      params.push(action.trim())
      where = `WHERE l.action = $1`
    }
    params.push(Math.min(200, Math.max(1, limit)))
    const res = await this.db.query(
      `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at,
              u.id AS admin_id, u.username, u.display_name, u.role AS admin_role
       FROM admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id
       ${where}
       ORDER BY l.created_at DESC LIMIT $${params.length}`,
      params
    )
    return res.rows.map((row) => ({
      id: String(row.id),
      action: row.action,
      targetType: row.target_type,
      targetId: row.target_id,
      details: row.details,
      createdAt: new Date(row.created_at).toISOString(),
      admin: row.admin_id
        ? { id: row.admin_id, username: row.username, displayName: row.display_name, role: row.admin_role }
        : null
    }))
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

  // Ghi nhật ký cho thao tác chỉ đọc (VD: xuất CSV)
  logAction(adminId: string, entry: AuditEntry) {
    return this.db.transaction((client) => writeAudit(client, adminId, entry))
  }

  private audit(client: PoolClient, adminId: string, entry: AuditEntry) {
    return writeAudit(client, adminId, entry)
  }
}
