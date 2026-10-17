import { BadRequestException, ForbiddenException, Injectable, Logger, NotFoundException, type OnModuleDestroy, type OnModuleInit } from '@nestjs/common'
import type { PoolClient } from 'pg'
import type {
  AdminAuditLog,
  AdminAuthProvider,
  AdminBulkResult,
  AdminBulkUserInput,
  AdminUpdateRoleInput,
  AdminUserDetail,
  AdminUserNote,
  AdminUserPage,
  AdminUserRole,
  AdminUserRow,
  AdminUserSummary,
  AdminSanction,
  SanctionInput,
  SanctionKind,
  SanctionRecommendation,
  UserInsight
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'
import { UserInsightService } from '../personalization/user-insight.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { writeAudit } from './admin-audit'
import type { AdminUserQueryParsed } from './dto/admin.dto'

// Biểu thức lấy user id trong phiên express-session (có index idx_user_sessions_user)
const SESSION_USER = `sess::jsonb #>> '{passport,user,id}'`
const ONLINE_WINDOW = `INTERVAL '5 minutes'`

// Cột sắp xếp ⇒ biểu thức SQL (whitelist, không nối chuỗi từ client)
const SORT_SQL: Record<AdminUserQueryParsed['sort'], string> = {
  created: 'u.created_at',
  last_seen: 'u.last_seen_at',
  reputation: 'u.reputation_points',
  posts: 'post_count',
  reports: 'report_count',
  name: 'lower(u.display_name)'
}

// Hạn chế đang hiệu lực
const RESTRICTED = `(u.restricted_at IS NOT NULL AND (u.restricted_until IS NULL OR u.restricted_until > NOW()))`

const ROW_COLUMNS = `u.id, u.username, u.display_name, u.email, u.avatar_url, u.role,
  CASE WHEN u.status = 'suspended' AND u.suspended_until IS NOT NULL AND u.suspended_until <= NOW() THEN 'active' ELSE u.status::text END AS status,
  u.is_verified, u.student_id, u.faculty, u.reputation_points, u.suspended_at, u.suspended_reason, u.suspended_until,
  ${RESTRICTED} AS is_restricted, u.restricted_until, u.restricted_reason,
  u.last_seen_at, u.created_at, (u.password_hash IS NOT NULL) AS has_password, (u.google_id IS NOT NULL) AS has_google`

// Thang chế tài theo số lần vi phạm (180 ngày): cảnh cáo → hạn chế 1d → 7d → khóa 7d → 30d → vĩnh viễn
const SANCTION_LADDER: { kind: SanctionKind; durationDays: number | null }[] = [
  { kind: 'warning', durationDays: null },
  { kind: 'restrict', durationDays: 1 },
  { kind: 'restrict', durationDays: 7 },
  { kind: 'suspend', durationDays: 7 },
  { kind: 'suspend', durationDays: 30 },
  { kind: 'suspend', durationDays: null }
]
const STRIKE_WINDOW = `INTERVAL '180 days'`

// Đếm theo người — chỉ chạy cho các dòng của trang hiện tại (LATERAL sau LIMIT)
const COUNT_LATERAL = `
  LEFT JOIN LATERAL (SELECT COUNT(*)::int AS post_count FROM posts p WHERE p.author_id = u.id) pc ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*)::int AS report_count FROM post_reports r JOIN posts p ON p.id = r.post_id WHERE p.author_id = u.id
  ) rc ON TRUE`

type Row = Record<string, any>
const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : null)

function mapUserRow(row: Row): AdminUserRow {
  const authProviders: AdminAuthProvider[] = []
  if (row.has_password) authProviders.push('password')
  if (row.has_google) authProviders.push('google')
  return {
    id: row.id,
    username: row.username,
    displayName: row.display_name,
    email: row.email,
    avatarUrl: row.avatar_url,
    role: row.role as AdminUserRole,
    status: row.status,
    isVerified: !!row.is_verified,
    studentId: row.student_id,
    faculty: row.faculty,
    reputationPoints: row.reputation_points ?? 0,
    suspendedAt: iso(row.suspended_at),
    suspendedReason: row.suspended_reason,
    postCount: row.post_count ?? 0,
    reportCount: row.report_count ?? 0,
    lastSeenAt: iso(row.last_seen_at),
    createdAt: iso(row.created_at) as string,
    authProviders,
    suspendedUntil: iso(row.suspended_until),
    isRestricted: !!row.is_restricted,
    restrictedUntil: iso(row.restricted_until),
    restrictedReason: row.restricted_reason ?? null
  }
}

@Injectable()
export class AdminUsersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(AdminUsersService.name)
  private timer?: NodeJS.Timeout

  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway,
    private readonly insight: UserInsightService,
    private readonly notifications: NotificationsService
  ) {}

  // ── Đọc ─────────────────────────────────────────────────────────────────

  // Điều kiện WHERE dùng chung cho danh sách & export
  private buildFilter(f: Omit<AdminUserQueryParsed, 'sort' | 'dir' | 'page' | 'pageSize'>) {
    const params: unknown[] = []
    const where: string[] = [`u.account_type = 'human'`]
    const p = (v: unknown) => {
      params.push(v)
      return `$${params.length}`
    }

    // Tìm không dấu: tên + username (idx_users_name_trgm), email & mã SV (trigram)
    if (f.q) {
      const raw = f.q.replace(/^@/, '').toLowerCase()
      const like = p(`%${raw.replace(/[\\%_]/g, '\\$&')}%`)
      where.push(
        `(immutable_unaccent(lower(u.display_name || ' ' || u.username)) LIKE immutable_unaccent(${like})
          OR lower(u.email) LIKE ${like} OR lower(u.student_id) LIKE ${like})`
      )
    }
    if (f.role) where.push(`u.role = ${p(f.role)}::user_role_enum`)
    if (f.status === 'restricted') where.push(RESTRICTED)
    else if (f.status) where.push(`u.status = ${p(f.status)}::account_status_enum`)
    if (f.verified) where.push(f.verified === 'yes' ? `u.is_verified` : `NOT COALESCE(u.is_verified, FALSE)`)
    if (f.auth === 'google') where.push(`u.google_id IS NOT NULL`)
    if (f.auth === 'password') where.push(`u.password_hash IS NOT NULL`)
    if (f.faculty) where.push(`u.faculty = ${p(f.faculty)}`)
    if (f.reported) where.push(`EXISTS (SELECT 1 FROM post_reports r JOIN posts p ON p.id = r.post_id WHERE p.author_id = u.id)`)

    const activity: Record<string, string> = {
      online: `u.last_seen_at > NOW() - ${ONLINE_WINDOW}`,
      '24h': `u.last_seen_at > NOW() - INTERVAL '24 hours'`,
      '7d': `u.last_seen_at > NOW() - INTERVAL '7 days'`,
      '30d': `u.last_seen_at > NOW() - INTERVAL '30 days'`,
      dormant: `u.last_seen_at <= NOW() - INTERVAL '30 days'`,
      never: `u.last_seen_at IS NULL`
    }
    if (f.activity) where.push(activity[f.activity])

    const joined: Record<string, string> = { '24h': '24 hours', '7d': '7 days', '30d': '30 days', '90d': '90 days' }
    if (f.joined) where.push(`u.created_at > NOW() - INTERVAL '${joined[f.joined]}'`)

    return { where: `WHERE ${where.join(' AND ')}`, params }
  }

  // Danh sách phân trang server (offset — phù hợp bảng admin cần nhảy trang & sắp xếp tùy ý)
  async list(query: AdminUserQueryParsed): Promise<AdminUserPage> {
    const { where, params } = this.buildFilter(query)
    const dir = query.dir === 'asc' ? 'ASC' : 'DESC'
    const nulls = dir === 'DESC' ? 'NULLS LAST' : 'NULLS FIRST'
    const order = `${SORT_SQL[query.sort]} ${dir} ${nulls}, u.id ${dir}`
    const offset = (query.page - 1) * query.pageSize
    const limitIdx = params.length + 1

    // Sắp theo số bài/báo cáo ⇒ phải đếm trước khi LIMIT; còn lại LIMIT trước rồi mới đếm cho 1 trang
    const countFirst = query.sort === 'posts' || query.sort === 'reports'
    const sql = countFirst
      ? `SELECT ${ROW_COLUMNS}, pc.post_count, rc.report_count, COUNT(*) OVER()::int AS total
         FROM users u ${COUNT_LATERAL}
         ${where}
         ORDER BY ${order}
         LIMIT $${limitIdx} OFFSET $${limitIdx + 1}`
      : `WITH page AS (
           SELECT u.*, COUNT(*) OVER()::int AS total FROM users u ${where}
           ORDER BY ${order}
           LIMIT $${limitIdx} OFFSET $${limitIdx + 1}
         )
         SELECT ${ROW_COLUMNS}, pc.post_count, rc.report_count, u.total
         FROM page u ${COUNT_LATERAL}
         ORDER BY ${order}`

    const res = await this.db.query(sql, [...params, query.pageSize, offset])
    let total = res.rows[0]?.total ?? 0
    // Trang vượt quá cuối ⇒ vẫn trả tổng đúng
    if (res.rows.length === 0 && query.page > 1) {
      const c = await this.db.query(`SELECT COUNT(*)::int AS n FROM users u ${where}`, params)
      total = c.rows[0].n
    }
    return { items: res.rows.map(mapUserRow), total, page: query.page, pageSize: query.pageSize }
  }

  // Số liệu phân khúc (1 lần quét users với FILTER)
  async summary(): Promise<AdminUserSummary> {
    const [agg, roles, faculties] = await Promise.all([
      this.db.query(`
        SELECT COUNT(*)::int AS total,
          COUNT(*) FILTER (WHERE last_seen_at > NOW() - ${ONLINE_WINDOW})::int AS online,
          COUNT(*) FILTER (WHERE last_seen_at > NOW() - INTERVAL '24 hours')::int AS active_24h,
          COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days')::int AS new_7d,
          COUNT(*) FILTER (WHERE is_verified)::int AS verified,
          COUNT(*) FILTER (WHERE status = 'suspended')::int AS suspended,
          COUNT(*) FILTER (WHERE restricted_at IS NOT NULL AND (restricted_until IS NULL OR restricted_until > NOW()))::int AS restricted,
          COUNT(*) FILTER (WHERE last_seen_at <= NOW() - INTERVAL '30 days')::int AS dormant,
          (SELECT COUNT(DISTINCT p.author_id) FROM post_reports r JOIN posts p ON p.id = r.post_id)::int AS reported
        FROM users WHERE account_type = 'human'`),
      this.db.query(`SELECT role, COUNT(*)::int AS n FROM users WHERE account_type = 'human' GROUP BY role`),
      this.db.query(
        `SELECT faculty, COUNT(*)::int AS n FROM users WHERE account_type = 'human' AND faculty IS NOT NULL AND faculty <> ''
         GROUP BY faculty ORDER BY n DESC, faculty LIMIT 30`
      )
    ])
    const a = agg.rows[0]
    return {
      total: a.total,
      online: a.online,
      active24h: a.active_24h,
      new7d: a.new_7d,
      verified: a.verified,
      suspended: a.suspended,
      restricted: a.restricted,
      reported: a.reported,
      dormant: a.dormant,
      byRole: Object.fromEntries(roles.rows.map((r) => [r.role, r.n])),
      faculties: faculties.rows.map((r) => ({ faculty: r.faculty, count: r.n }))
    }
  }

  // Hồ sơ đầy đủ cho ngăn chi tiết
  async detail(userId: string): Promise<AdminUserDetail> {
    const userRes = await this.db.query(
      `SELECT ${ROW_COLUMNS}, u.bio, u.major, u.class_name, u.academic_year, u.verified_at, pc.post_count, rc.report_count
       FROM users u ${COUNT_LATERAL}
       WHERE u.id = $1 AND u.account_type = 'human'`,
      [userId]
    )
    const row = userRes.rows[0]
    if (!row) throw new NotFoundException('Người dùng không tồn tại')

    const [stats, posts, log, notes, sanctions] = await Promise.all([
      this.db.query(
        `SELECT
          (SELECT COUNT(*) FROM posts WHERE author_id = $1 AND hidden_at IS NOT NULL)::int AS hidden_posts,
          (SELECT COUNT(*) FROM comments WHERE author_id = $1)::int AS comments,
          (SELECT COUNT(*) FROM documents WHERE owner_id = $1)::int AS documents,
          (SELECT COUNT(*) FROM user_follows WHERE following_id = $1)::int AS followers,
          (SELECT COUNT(*) FROM user_follows WHERE follower_id = $1)::int AS following,
          (SELECT COUNT(*) FROM post_reports WHERE reporter_id = $1)::int AS reports_filed,
          (SELECT COUNT(*) FROM user_sessions WHERE ${SESSION_USER} = $1::text AND expire > NOW())::int AS sessions,
          (SELECT COUNT(*) FROM ai_runs WHERE requester_id = $1 AND created_at > NOW() - INTERVAL '30 days')::int AS ai_runs`,
        [userId]
      ),
      this.db.query(
        `SELECT id, title, content, created_at, hidden_at, likes_count, comments_count
         FROM posts WHERE author_id = $1 ORDER BY created_at DESC LIMIT 5`,
        [userId]
      ),
      this.db.query(
        `SELECT l.id, l.action, l.target_type, l.target_id, l.details, l.created_at,
                a.id AS admin_id, a.username AS admin_username, a.display_name AS admin_name, a.role AS admin_role
         FROM admin_audit_logs l LEFT JOIN users a ON a.id = l.admin_id
         WHERE l.target_type = 'user' AND l.target_id = $1
         ORDER BY l.created_at DESC LIMIT 20`,
        [userId]
      ),
      this.listNotes(userId),
      this.listSanctions(userId)
    ])
    const s = stats.rows[0]

    return {
      user: {
        ...mapUserRow(row),
        bio: row.bio,
        major: row.major,
        className: row.class_name,
        academicYear: row.academic_year,
        verifiedAt: iso(row.verified_at)
      },
      stats: {
        posts: row.post_count ?? 0,
        hiddenPosts: s.hidden_posts,
        comments: s.comments,
        documents: s.documents,
        followers: s.followers,
        following: s.following,
        reportsReceived: row.report_count ?? 0,
        reportsFiled: s.reports_filed,
        activeSessions: s.sessions,
        aiRuns30d: s.ai_runs
      },
      recentPosts: posts.rows.map((p) => ({
        id: p.id,
        title: p.title,
        content: p.content,
        createdAt: iso(p.created_at) as string,
        hiddenAt: iso(p.hidden_at),
        likes: p.likes_count ?? 0,
        comments: p.comments_count ?? 0
      })),
      moderationLog: log.rows.map(
        (l): AdminAuditLog => ({
          id: String(l.id),
          action: l.action,
          targetType: l.target_type,
          targetId: l.target_id,
          details: l.details,
          createdAt: iso(l.created_at) as string,
          admin: l.admin_id ? { id: l.admin_id, username: l.admin_username, displayName: l.admin_name, role: l.admin_role } : null
        })
      ),
      notes,
      sanctions,
      recommendation: this.recommend(sanctions)
    }
  }

  // ── Chế tài ─────────────────────────────────────────────────────────────

  async listSanctions(userId: string): Promise<AdminSanction[]> {
    const res = await this.db.query(
      `SELECT s.id, s.kind, s.reason, s.starts_at, s.ends_at, s.revoked_at,
              a.username AS admin_username, a.display_name AS admin_name, r.username AS revoked_username,
              (s.kind <> 'warning' AND s.revoked_at IS NULL AND (s.ends_at IS NULL OR s.ends_at > NOW())) AS active
       FROM user_sanctions s
       LEFT JOIN users a ON a.id = s.admin_id
       LEFT JOIN users r ON r.id = s.revoked_by
       WHERE s.user_id = $1 ORDER BY s.created_at DESC LIMIT 50`,
      [userId]
    )
    return res.rows.map((r) => ({
      id: String(r.id),
      kind: r.kind,
      reason: r.reason,
      startsAt: iso(r.starts_at) as string,
      endsAt: iso(r.ends_at),
      revokedAt: iso(r.revoked_at),
      active: !!r.active,
      admin: r.admin_username ? { username: r.admin_username, displayName: r.admin_name } : null,
      revokedBy: r.revoked_username ? { username: r.revoked_username } : null
    }))
  }

  // Bậc đề xuất: số lần vi phạm trong 180 ngày (bỏ bản đã hủy do nhầm)
  private recommend(sanctions: AdminSanction[]): SanctionRecommendation {
    const since = Date.now() - 180 * 86_400_000
    const strikes = sanctions.filter((x) => !x.revokedAt && new Date(x.startsAt).getTime() > since).length
    return { strikes, ...SANCTION_LADDER[Math.min(strikes, SANCTION_LADDER.length - 1)] }
  }

  // Áp chế tài cho 1 người (cảnh cáo / hạn chế / khóa)
  async sanction(adminId: string, userId: string, input: SanctionInput): Promise<AdminBulkResult> {
    if (adminId === userId) throw new BadRequestException('Không thể tự xử phạt chính mình')
    const action = { warning: 'warn', restrict: 'restrict', suspend: 'suspend' } as const
    const res = await this.bulk(adminId, { ids: [userId], action: action[input.kind], reason: input.reason, durationDays: input.durationDays ?? null })
    if (!res.affected) throw new ForbiddenException('Không thể xử phạt tài khoản này (quản trị viên hoặc không tồn tại)')
    return res
  }

  // Hủy 1 chế tài (nhầm lẫn): không tính là vi phạm; nếu đang hiệu lực thì gỡ luôn
  async revokeSanction(adminId: string, userId: string, sanctionId: string): Promise<AdminSanction[]> {
    let lifted: 'restrict' | 'suspend' | null = null
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE user_sanctions SET revoked_at = NOW(), revoked_by = $3
         WHERE id = $1 AND user_id = $2 AND revoked_at IS NULL
         RETURNING kind, (ends_at IS NULL OR ends_at > NOW()) AS was_active`,
        [sanctionId, userId, adminId]
      )
      if (!res.rowCount) throw new NotFoundException('Chế tài không tồn tại hoặc đã hủy')
      const { kind, was_active } = res.rows[0]
      if (was_active && kind === 'restrict') {
        await client.query(`UPDATE users SET restricted_at = NULL, restricted_until = NULL, restricted_reason = NULL WHERE id = $1`, [userId])
        lifted = 'restrict'
      }
      if (was_active && kind === 'suspend') {
        await client.query(
          `UPDATE users SET status = 'active', suspended_at = NULL, suspended_reason = NULL, suspended_until = NULL WHERE id = $1 AND status = 'suspended'`,
          [userId]
        )
        lifted = 'suspend'
      }
      await writeAudit(client, adminId, { action: 'user.sanction_revoke', targetType: 'user', targetId: userId, details: { sanctionId, kind, lifted } })
    })
    return this.listSanctions(userId)
  }

  // Job: gỡ chế tài hết hạn (mỗi phút) — đăng nhập đã tự coi khóa hết hạn là hoạt động
  async liftExpired(): Promise<{ unsuspended: number; unrestricted: number }> {
    const [a, b] = await Promise.all([
      this.db.query(
        `UPDATE users SET status = 'active', suspended_at = NULL, suspended_reason = NULL, suspended_until = NULL
         WHERE status = 'suspended' AND suspended_until IS NOT NULL AND suspended_until <= NOW()`
      ),
      this.db.query(
        `UPDATE users SET restricted_at = NULL, restricted_until = NULL, restricted_reason = NULL
         WHERE restricted_at IS NOT NULL AND restricted_until IS NOT NULL AND restricted_until <= NOW()`
      )
    ])
    return { unsuspended: a.rowCount ?? 0, unrestricted: b.rowCount ?? 0 }
  }

  onModuleInit() {
    this.timer = setInterval(() => {
      this.liftExpired().catch((err) => this.logger.warn(`liftExpired: ${(err as Error).message}`))
    }, 60_000)
    this.timer.unref()
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  // Xuất CSV theo bộ lọc hiện tại (tối đa 10.000 dòng)
  async exportCsv(query: AdminUserQueryParsed): Promise<string> {
    const { where, params } = this.buildFilter(query)
    const res = await this.db.query(
      `SELECT ${ROW_COLUMNS}, pc.post_count, rc.report_count FROM users u ${COUNT_LATERAL}
       ${where} ORDER BY u.created_at DESC LIMIT 10000`,
      params
    )
    const head = ['username', 'display_name', 'email', 'role', 'status', 'verified', 'student_id', 'faculty', 'reputation', 'posts', 'reports', 'last_seen_at', 'created_at']
    const esc = (v: unknown) => {
      const t = v == null ? '' : String(v)
      // Chặn CSV injection (=, +, -, @ ở đầu ô)
      const safe = /^[=+\-@]/.test(t) ? `'${t}` : t
      return /[",\n]/.test(safe) ? `"${safe.replace(/"/g, '""')}"` : safe
    }
    const lines = res.rows.map((r) =>
      [r.username, r.display_name, r.email, r.role, r.status, r.is_verified, r.student_id, r.faculty, r.reputation_points, r.post_count, r.report_count, iso(r.last_seen_at), iso(r.created_at)]
        .map(esc)
        .join(',')
    )
    return '﻿' + [head.join(','), ...lines].join('\n')
  }

  // ── Ghi chú nội bộ ──────────────────────────────────────────────────────

  async listNotes(userId: string): Promise<AdminUserNote[]> {
    const res = await this.db.query(
      `SELECT n.id, n.body, n.created_at, a.username, a.display_name
       FROM admin_user_notes n LEFT JOIN users a ON a.id = n.admin_id
       WHERE n.user_id = $1 ORDER BY n.created_at DESC LIMIT 50`,
      [userId]
    )
    return res.rows.map((n) => ({
      id: String(n.id),
      body: n.body,
      createdAt: iso(n.created_at) as string,
      author: n.username ? { username: n.username, displayName: n.display_name } : null
    }))
  }

  async addNote(adminId: string, userId: string, body: string): Promise<AdminUserNote[]> {
    await this.db.transaction(async (client) => {
      const exists = await client.query(`SELECT 1 FROM users WHERE id = $1 AND account_type = 'human'`, [userId])
      if (!exists.rowCount) throw new NotFoundException('Người dùng không tồn tại')
      await client.query(`INSERT INTO admin_user_notes (user_id, admin_id, body) VALUES ($1, $2, $3)`, [userId, adminId, body])
      await writeAudit(client, adminId, { action: 'user.note_add', targetType: 'user', targetId: userId })
    })
    return this.listNotes(userId)
  }

  async deleteNote(adminId: string, userId: string, noteId: string): Promise<AdminUserNote[]> {
    await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM admin_user_notes WHERE id = $1 AND user_id = $2`, [noteId, userId])
      if (!res.rowCount) throw new NotFoundException('Ghi chú không tồn tại')
      await writeAudit(client, adminId, { action: 'user.note_delete', targetType: 'user', targetId: userId })
    })
    return this.listNotes(userId)
  }

  // ── Thao tác 1 người ────────────────────────────────────────────────────

  // Đổi vai trò + đồng bộ role vào mọi phiên đang mở (ACID)
  async updateRole(adminId: string, userId: string, input: AdminUpdateRoleInput): Promise<{ role: AdminUserRole }> {
    if (adminId === userId && input.role !== 'admin') {
      throw new BadRequestException('Không thể tự hạ quyền quản trị của chính mình')
    }
    await this.db.transaction(async (client) => {
      const target = await client.query(`SELECT role, account_type FROM users WHERE id = $1 FOR UPDATE`, [userId])
      if (target.rows.length === 0) throw new NotFoundException('Người dùng không tồn tại')
      if (target.rows[0].account_type !== 'human') throw new ForbiddenException('Không thể đổi vai trò tài khoản hệ thống')
      const from = target.rows[0].role as string
      await this.applyRole(client, [userId], input.role)
      await writeAudit(client, adminId, {
        action: 'user.role_change',
        targetType: 'user',
        targetId: userId,
        details: { from, to: input.role, reason: input.reason }
      })
    })
    return { role: input.role }
  }

  async verify(adminId: string, userId: string, isVerified: boolean): Promise<{ isVerified: boolean }> {
    const res = await this.bulk(adminId, { ids: [userId], action: isVerified ? 'verify' : 'unverify' })
    if (!res.affected && !res.skipped) throw new NotFoundException('Người dùng không tồn tại')
    return { isVerified }
  }

  async revokeSessions(adminId: string, userId: string): Promise<{ revokedCount: number }> {
    const revokedCount = await this.db.transaction(async (client) => {
      const n = await this.deleteSessions(client, [userId])
      await writeAudit(client, adminId, { action: 'user.revoke_sessions', targetType: 'user', targetId: userId, details: { revokedSessions: n } })
      return n
    })
    this.realtime.disconnectUser(userId)
    return { revokedCount }
  }

  async suspend(adminId: string, userId: string, reason?: string): Promise<{ status: string }> {
    if (adminId === userId) throw new BadRequestException('Không thể tự khóa tài khoản của mình')
    const target = await this.db.query(`SELECT role FROM users WHERE id = $1 AND account_type = 'human'`, [userId])
    if (!target.rowCount) throw new NotFoundException('Người dùng không tồn tại')
    if (target.rows[0].role === 'admin') throw new ForbiddenException('Không thể khóa tài khoản quản trị')
    await this.bulk(adminId, { ids: [userId], action: 'suspend', reason })
    return { status: 'suspended' }
  }

  async unsuspend(adminId: string, userId: string): Promise<{ status: string }> {
    await this.bulk(adminId, { ids: [userId], action: 'unsuspend' })
    return { status: 'active' }
  }

  // Xem dữ liệu cá nhân hóa — nhạy cảm ⇒ luôn ghi nhật ký
  async userInsight(adminId: string, userId: string): Promise<UserInsight> {
    const insight = await this.insight.get(userId)
    await this.db.transaction((client) => writeAudit(client, adminId, { action: 'user.insight_view', targetType: 'user', targetId: userId }))
    return insight
  }

  // ── Thao tác hàng loạt (1 transaction, SQL theo tập) ────────────────────

  async bulk(adminId: string, input: AdminBulkUserInput): Promise<AdminBulkResult> {
    const ids = [...new Set(input.ids)].filter((id) => id !== adminId || input.action === 'verify' || input.action === 'unverify')

    const days = input.durationDays ?? null
    const affectedIds = await this.db.transaction(async (client) => {
      // Khóa các dòng mục tiêu; bỏ qua bot
      const locked = await client.query(
        `SELECT id, role FROM users WHERE id = ANY($1::uuid[]) AND account_type = 'human' ORDER BY id FOR UPDATE`,
        [ids]
      )
      let targets: string[] = locked.rows.map((r) => r.id)
      let changed: { id: string }[] = []

      switch (input.action) {
        case 'verify':
        case 'unverify': {
          const on = input.action === 'verify'
          changed = (
            await client.query(
              `UPDATE users SET is_verified = $2, verified_at = CASE WHEN $2 THEN NOW() ELSE NULL END, updated_at = NOW()
               WHERE id = ANY($1::uuid[]) AND COALESCE(is_verified, FALSE) <> $2 RETURNING id`,
              [targets, on]
            )
          ).rows
          break
        }
        case 'warn': {
          // Cảnh cáo: chỉ ghi nhận (tính 1 lần vi phạm) + gửi thông báo
          targets = locked.rows.filter((r) => r.role !== 'admin').map((r) => r.id)
          changed = targets.map((id) => ({ id }))
          await this.recordSanctions(client, adminId, targets, 'warning', null, input.reason)
          break
        }
        case 'restrict': {
          targets = locked.rows.filter((r) => r.role !== 'admin').map((r) => r.id)
          changed = (
            await client.query(
              `UPDATE users SET restricted_at = NOW(), restricted_reason = $2, updated_at = NOW(),
                 restricted_until = CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $3::int) END
               WHERE id = ANY($1::uuid[]) RETURNING id`,
              [targets, input.reason || null, days]
            )
          ).rows
          await this.recordSanctions(client, adminId, changed.map((r) => r.id), 'restrict', days, input.reason)
          break
        }
        case 'unrestrict':
          changed = (
            await client.query(
              `UPDATE users SET restricted_at = NULL, restricted_until = NULL, restricted_reason = NULL, updated_at = NOW()
               WHERE id = ANY($1::uuid[]) AND ${RESTRICTED.replace(/u\./g, '')} RETURNING id`,
              [targets]
            )
          ).rows
          await this.endSanctions(client, changed.map((r) => r.id), 'restrict')
          break
        case 'suspend': {
          // Không khóa admin; khóa lại người đang bị khóa ⇒ cập nhật thời hạn mới
          targets = locked.rows.filter((r) => r.role !== 'admin').map((r) => r.id)
          changed = (
            await client.query(
              `UPDATE users SET status = 'suspended', suspended_at = NOW(), suspended_reason = $2, updated_at = NOW(),
                 suspended_until = CASE WHEN $3::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $3::int) END
               WHERE id = ANY($1::uuid[]) RETURNING id`,
              [targets, input.reason || null, days]
            )
          ).rows
          await this.deleteSessions(client, changed.map((r) => r.id))
          await this.recordSanctions(client, adminId, changed.map((r) => r.id), 'suspend', days, input.reason)
          break
        }
        case 'unsuspend':
          changed = (
            await client.query(
              `UPDATE users SET status = 'active', suspended_at = NULL, suspended_reason = NULL, suspended_until = NULL, updated_at = NOW()
               WHERE id = ANY($1::uuid[]) AND status = 'suspended' RETURNING id`,
              [targets]
            )
          ).rows
          await this.endSanctions(client, changed.map((r) => r.id), 'suspend')
          break
        case 'revoke_sessions':
          await this.deleteSessions(client, targets)
          changed = targets.map((id) => ({ id }))
          break
        case 'set_role': {
          const role = input.role as AdminUserRole
          const from = new Map(locked.rows.map((r) => [r.id, r.role]))
          changed = targets.filter((id) => from.get(id) !== role).map((id) => ({ id }))
          await this.applyRole(client, changed.map((r) => r.id), role)
          break
        }
      }

      // Nhật ký: 1 dòng / người (insert theo tập)
      const action = {
        verify: 'user.verify',
        unverify: 'user.unverify',
        warn: 'user.warn',
        restrict: 'user.restrict',
        unrestrict: 'user.unrestrict',
        suspend: 'user.suspend',
        unsuspend: 'user.unsuspend',
        revoke_sessions: 'user.revoke_sessions',
        set_role: 'user.role_change'
      }[input.action]
      if (changed.length) {
        const details = JSON.stringify({
          reason: input.reason,
          to: input.role,
          days: ['restrict', 'suspend'].includes(input.action) ? (days ?? 'permanent') : undefined,
          bulk: ids.length > 1 ? ids.length : undefined
        })
        await client.query(
          `INSERT INTO admin_audit_logs (admin_id, action, target_type, target_id, details)
           SELECT $1, $2, 'user', t::text, $4::jsonb FROM unnest($3::uuid[]) t`,
          [adminId, action, changed.map((r) => r.id), details]
        )
      }
      return changed.map((r) => r.id)
    })

    // Hậu xử lý ngoài transaction: ngắt socket, gửi thông báo
    if (input.action === 'suspend' || input.action === 'revoke_sessions') {
      affectedIds.forEach((id) => this.realtime.disconnectUser(id))
    }
    if (input.action === 'warn' || input.action === 'restrict') {
      const until = days ? ` trong ${days} ngày` : ''
      const verb =
        input.action === 'warn'
          ? 'Bạn nhận một cảnh cáo từ Ban Quản Trị vì vi phạm tiêu chuẩn cộng đồng'
          : `Tài khoản của bạn bị hạn chế${until}: chỉ xem, chưa thể đăng bài, bình luận hay nhắn tin`
      await Promise.all(
        affectedIds.map((id) =>
          this.notifications
            .notify({ type: 'account_notice', recipientId: id, actorId: null, verb, message: input.reason || undefined })
            .catch(() => undefined)
        )
      )
    }
    if (input.action === 'verify') {
      await Promise.all(
        affectedIds.map((id) =>
          this.notifications
            .notify({
              type: 'account_verified',
              recipientId: id,
              actorId: null,
              verb: 'Tài khoản của bạn đã được Ban Quản Trị xác thực chính thức',
              message: 'Huy hiệu xác thực đã hiển thị trên hồ sơ cá nhân của bạn.'
            })
            .catch(() => undefined)
        )
      )
    }
    return { affected: affectedIds.length, skipped: input.ids.length - affectedIds.length }
  }

  // ── Helpers ─────────────────────────────────────────────────────────────

  private async applyRole(client: PoolClient, ids: string[], role: AdminUserRole) {
    if (!ids.length) return
    await client.query(`UPDATE users SET role = $2::user_role_enum, updated_at = NOW() WHERE id = ANY($1::uuid[])`, [ids, role])
    // Đồng bộ role vào phiên đang mở
    await client.query(
      `UPDATE user_sessions SET sess = jsonb_set(sess::jsonb, '{passport,user,role}', to_jsonb($2::text))::json
       WHERE ${SESSION_USER} = ANY($1::text[])`,
      [ids, role]
    )
  }

  // Ghi lịch sử chế tài theo tập; chế tài cùng loại đang hiệu lực được kết thúc (thay thế)
  private async recordSanctions(client: PoolClient, adminId: string, ids: string[], kind: SanctionKind, days: number | null, reason?: string) {
    if (!ids.length) return
    if (kind !== 'warning') await this.endSanctions(client, ids, kind)
    await client.query(
      `INSERT INTO user_sanctions (user_id, admin_id, kind, reason, ends_at)
       SELECT t, $2, $3, $4, CASE WHEN $5::int IS NULL THEN NULL ELSE NOW() + make_interval(days => $5::int) END
       FROM unnest($1::uuid[]) t`,
      [ids, adminId, kind, reason || null, days]
    )
  }

  private async endSanctions(client: PoolClient, ids: string[], kind: 'restrict' | 'suspend') {
    if (!ids.length) return
    await client.query(
      `UPDATE user_sanctions SET ends_at = NOW()
       WHERE user_id = ANY($1::uuid[]) AND kind = $2 AND revoked_at IS NULL AND (ends_at IS NULL OR ends_at > NOW())`,
      [ids, kind]
    )
  }

  private async deleteSessions(client: PoolClient, ids: string[]): Promise<number> {
    if (!ids.length) return 0
    const res = await client.query(`DELETE FROM user_sessions WHERE ${SESSION_USER} = ANY($1::text[])`, [ids])
    return res.rowCount ?? 0
  }
}
