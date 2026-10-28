import { Injectable } from '@nestjs/common'
import type {
  AdminAiSkillRow,
  AdminAuditLog,
  AdminCommentRow,
  AdminCommunityRow,
  AdminCourseRow,
  AdminDocumentRow,
  AdminPage,
  AdminPostRow,
  AdminReportedComment,
  AdminReportedPost,
  AdminSecurityEventRow
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { formatLocation } from '../auth/security-log.service'
import { iso, likeEscape, orderBy, pagedQuery, searchCondition, SqlParams, whereOf } from './admin-paging'
import type {
  AuditQuery,
  CommentsQuery,
  CommunitiesQuery,
  CoursesQuery,
  DocumentsQuery,
  PostsQuery,
  ReportsQuery,
  SecurityEventsQuery,
  SkillsQuery
} from './dto/admin-lists.dto'

type Row = Record<string, any>

// Danh sách đọc của admin: phân trang server + lọc + sắp xếp (whitelist)
@Injectable()
export class AdminListsService {
  constructor(private readonly db: DatabaseService) {}

  // ── Kiểm duyệt ──────────────────────────────────────────────────────────

  // Báo cáo gom theo bài viết
  async reports(q: ReportsQuery): Promise<AdminPage<AdminReportedPost>> {
    const p = new SqlParams()
    const pending = q.status === 'pending'
    const statusCond = pending ? `r.status = 'pending'` : `r.status <> 'pending'`
    const conds = [
      statusCond,
      searchCondition(p, q.q, { username: 'u.username', tsv: 'p.search_tsv' }),
      q.reason && `EXISTS (SELECT 1 FROM post_reports r2 WHERE r2.post_id = p.id AND r2.reason = ${p.add(q.reason)})`
    ]
    const from = `post_reports r JOIN posts p ON p.id = r.post_id JOIN users u ON u.id = p.author_id ${whereOf(conds)}
      GROUP BY p.id, u.id`
    const sort = q.sort === 'recent' ? 'MAX(r.created_at)' : 'COUNT(r.id)'
    return pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `p.id AS post_id, p.title, p.content, p.created_at, p.hidden_at,
        u.id AS author_id, u.username, u.display_name, u.avatar_url, u.status AS author_status,
        COUNT(r.id)::int AS report_count, MAX(r.created_at) AS last_reported_at,
        (SELECT json_agg(json_build_object('reason', x.reason, 'count', x.cnt) ORDER BY x.cnt DESC)
           FROM (SELECT reason, COUNT(*)::int AS cnt FROM post_reports r3
                 WHERE r3.post_id = p.id AND ${statusCond.replace(/\br\./g, 'r3.')} GROUP BY reason) x) AS reasons,
        (ARRAY_AGG(r.details ORDER BY r.created_at DESC) FILTER (WHERE r.details IS NOT NULL AND r.details <> ''))[1:5] AS details`,
      from,
      order: orderBy(sort, q.dir, 'p.id'),
      countSql: `SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM ${from}) x`,
      map: (row): AdminReportedPost => ({
        postId: row.post_id,
        title: row.title,
        content: row.content,
        createdAt: iso(row.created_at) as string,
        hiddenAt: iso(row.hidden_at),
        author: { id: row.author_id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, status: row.author_status },
        reportCount: row.report_count,
        reasons: row.reasons || [],
        details: row.details || [],
        lastReportedAt: iso(row.last_reported_at) as string
      })
    })
  }

  // Báo cáo bình luận gom theo bình luận (cùng bộ lọc với báo cáo bài)
  async commentReports(q: ReportsQuery): Promise<AdminPage<AdminReportedComment>> {
    const p = new SqlParams()
    const statusCond = q.status === 'pending' ? `r.status = 'pending'` : `r.status <> 'pending'`
    const conds = [
      statusCond,
      searchCondition(p, q.q, { username: 'u.username', like: ['cm.content'] }),
      q.reason && `EXISTS (SELECT 1 FROM comment_reports r2 WHERE r2.comment_id = cm.id AND r2.reason = ${p.add(q.reason)})`
    ]
    const from = `comment_reports r JOIN comments cm ON cm.id = r.comment_id JOIN posts p ON p.id = cm.post_id
      JOIN users u ON u.id = cm.author_id ${whereOf(conds)} GROUP BY cm.id, p.id, u.id`
    const sort = q.sort === 'recent' ? 'MAX(r.created_at)' : 'COUNT(r.id)'
    return pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `cm.id AS comment_id, cm.post_id, cm.content, cm.created_at, p.title AS post_title,
        u.id AS author_id, u.username, u.display_name, u.avatar_url, u.status AS author_status,
        COUNT(r.id)::int AS report_count, MAX(r.created_at) AS last_reported_at,
        (SELECT json_agg(json_build_object('reason', x.reason, 'count', x.cnt) ORDER BY x.cnt DESC)
           FROM (SELECT reason, COUNT(*)::int AS cnt FROM comment_reports r3
                 WHERE r3.comment_id = cm.id AND ${statusCond.replace(/\br\./g, 'r3.')} GROUP BY reason) x) AS reasons,
        (ARRAY_AGG(r.details ORDER BY r.created_at DESC) FILTER (WHERE r.details IS NOT NULL AND r.details <> ''))[1:5] AS details`,
      from,
      order: orderBy(sort, q.dir, 'cm.id'),
      countSql: `SELECT COUNT(*)::int AS n FROM (SELECT 1 FROM ${from}) x`,
      map: (row): AdminReportedComment => ({
        commentId: row.comment_id,
        postId: row.post_id,
        postTitle: row.post_title,
        content: row.content,
        createdAt: iso(row.created_at) as string,
        author: { id: row.author_id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, status: row.author_status },
        reportCount: row.report_count,
        reasons: row.reasons || [],
        details: row.details || [],
        lastReportedAt: iso(row.last_reported_at) as string
      })
    })
  }

  async posts(q: PostsQuery): Promise<AdminPage<AdminPostRow>> {
    const p = new SqlParams()
    const filter = {
      pinned: 'p.is_pinned = TRUE',
      hidden: 'p.hidden_at IS NOT NULL',
      qna_unsolved: `p.post_type = 'question' AND p.is_resolved = FALSE`,
      reported: 'EXISTS (SELECT 1 FROM post_reports r WHERE r.post_id = p.id)'
    }
    const conds = [
      searchCondition(p, q.q, { username: 'u.username', tsv: 'p.search_tsv' }),
      q.filter && filter[q.filter],
      q.type && `p.post_type::text = ${p.add(q.type)}`
    ]
    const sort = { recent: 'p.created_at', likes: 'p.likes_count', comments: 'p.comments_count', views: 'p.views_count', reports: 'report_count' }[q.sort]
    return pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `p.id, p.title, p.content, p.post_type, p.tags, p.is_pinned, p.is_resolved,
        p.likes_count, p.comments_count, p.views_count, p.hidden_at, p.hidden_reason, p.created_at,
        c.code AS course_code, cm.name AS community_name,
        u.id AS author_id, u.username, u.display_name, u.avatar_url, u.role AS author_role,
        (SELECT COUNT(*) FROM post_reports r WHERE r.post_id = p.id)::int AS report_count`,
      from: `posts p JOIN users u ON u.id = p.author_id
        LEFT JOIN courses c ON c.id = p.course_id
        LEFT JOIN communities cm ON cm.id = p.community_id
        ${whereOf(conds)}`,
      order: orderBy(sort, q.dir, 'p.id'),
      map: (row): AdminPostRow => ({
        id: row.id,
        title: row.title,
        content: row.content,
        postType: row.post_type,
        tags: row.tags || [],
        isPinned: !!row.is_pinned,
        isResolved: !!row.is_resolved,
        likesCount: row.likes_count ?? 0,
        commentsCount: row.comments_count ?? 0,
        viewsCount: row.views_count ?? 0,
        reportCount: row.report_count,
        hiddenAt: iso(row.hidden_at),
        hiddenReason: row.hidden_reason,
        createdAt: iso(row.created_at) as string,
        courseCode: row.course_code,
        communityName: row.community_name,
        author: { id: row.author_id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url, role: row.author_role }
      })
    })
  }

  async comments(q: CommentsQuery): Promise<AdminPage<AdminCommentRow>> {
    const p = new SqlParams()
    const conds = [
      searchCondition(p, q.q, { username: 'u.username', like: ['cm.content'] }),
      q.filter === 'solution' && 'cm.is_solution = TRUE'
    ]
    const sort = q.sort === 'likes' ? 'cm.likes_count' : 'cm.created_at'
    return pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `cm.id, cm.post_id, cm.content, cm.likes_count, cm.is_solution, cm.created_at,
        p.title AS post_title, u.id AS author_id, u.username, u.display_name, u.avatar_url`,
      from: `comments cm JOIN posts p ON p.id = cm.post_id JOIN users u ON u.id = cm.author_id ${whereOf(conds)}`,
      order: orderBy(sort, q.dir, 'cm.id'),
      map: (row): AdminCommentRow => ({
        id: row.id,
        postId: row.post_id,
        postTitle: row.post_title,
        content: row.content,
        likesCount: row.likes_count ?? 0,
        isSolution: !!row.is_solution,
        createdAt: iso(row.created_at) as string,
        author: { id: row.author_id, username: row.username, displayName: row.display_name, avatarUrl: row.avatar_url }
      })
    })
  }

  // ── Học thuật ───────────────────────────────────────────────────────────

  async courses(q: CoursesQuery): Promise<AdminPage<AdminCourseRow>> {
    const p = new SqlParams()
    const search = q.q?.trim()
    const conds = [
      search && `(${searchCondition(p, search, { tsv: 'search_tsv' }) ?? 'FALSE'} OR lower(code) LIKE ${p.add(`${likeEscape(search.toLowerCase())}%`)})`,
      q.field && `interest_field_id IN (SELECT id FROM interest_fields WHERE name = ${p.add(q.field)})`
    ]
    const sort = { posts: 'post_count', documents: 'document_count', code: 'code', recent: 'created_at' }[q.sort]
    const [page, facets] = await Promise.all([
      pagedQuery(this.db, {
        params: p,
        page: q.page,
        pageSize: q.pageSize,
        select: `id, code, name, credits, interest_field_id, (SELECT x.name FROM interest_fields x WHERE x.id = courses.interest_field_id) AS field_name, description, syllabus_url, document_count, post_count, rating_avg, created_at`,
        from: `courses ${whereOf(conds)}`,
        order: orderBy(sort, q.dir, 'id'),
        map: (row): AdminCourseRow => ({
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
          createdAt: iso(row.created_at) as string
        })
      }),
      this.facet(`SELECT f.name AS value, COUNT(*)::int AS count FROM courses c JOIN interest_fields f ON f.id = c.interest_field_id GROUP BY 1 ORDER BY 2 DESC, 1`)
    ])
    return { ...page, facets: { field: facets } }
  }

  async documents(q: DocumentsQuery): Promise<AdminPage<AdminDocumentRow>> {
    const p = new SqlParams()
    const search = q.q?.trim()
    const hasChunks = 'EXISTS (SELECT 1 FROM document_chunks dc WHERE dc.document_id = d.id)'
    const conds = [
      search &&
        (search.startsWith('@')
          ? searchCondition(p, search, { username: 'u.username' })
          : `(${searchCondition(p, search, { tsv: 'd.search_tsv' }) ?? 'FALSE'} OR lower(c.code) = ${p.add(search.toLowerCase())})`),
      q.docType && `d.doc_type::text = ${p.add(q.docType)}`,
      q.indexed === 'yes' && hasChunks,
      q.indexed === 'no' && `NOT ${hasChunks}`
    ]
    const sort = { recent: 'd.created_at', downloads: 'd.download_count', size: 'd.file_size', chunks: 'chunk_count' }[q.sort]
    const [page, facets] = await Promise.all([
      pagedQuery(this.db, {
        params: p,
        page: q.page,
        pageSize: q.pageSize,
        select: `d.id, d.title, d.doc_type, d.file_url, d.file_size, d.mime_type, d.download_count, d.view_count, d.created_at,
          c.code AS course_code, u.id AS owner_id, u.username, u.display_name,
          (SELECT COUNT(*) FROM document_chunks dc WHERE dc.document_id = d.id)::int AS chunk_count`,
        from: `documents d JOIN users u ON u.id = d.owner_id LEFT JOIN courses c ON c.id = d.course_id ${whereOf(conds)}`,
        order: orderBy(sort, q.dir, 'd.id'),
        map: (row): AdminDocumentRow => ({
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
          createdAt: iso(row.created_at) as string,
          owner: { id: row.owner_id, username: row.username, displayName: row.display_name }
        })
      }),
      this.facet(`SELECT doc_type::text AS value, COUNT(*)::int AS count FROM documents GROUP BY 1 ORDER BY 2 DESC`)
    ])
    return { ...page, facets: { docType: facets } }
  }

  async communities(q: CommunitiesQuery): Promise<AdminPage<AdminCommunityRow>> {
    const p = new SqlParams()
    const conds = [searchCondition(p, q.q, { like: ['name', 'slug'] }), q.type && `community_type = ${p.add(q.type)}`, q.status && `status = ${p.add(q.status)}`]
    const sort = { members: 'members_count', posts: 'posts_count', recent: 'created_at' }[q.sort]
    const [page, facets, statuses] = await Promise.all([
      pagedQuery(this.db, {
        params: p,
        page: q.page,
        pageSize: q.pageSize,
        select: `id, slug, name, description, community_type, status, members_count, posts_count, created_at,
          (SELECT u.display_name FROM community_members m JOIN users u ON u.id = m.user_id WHERE m.community_id = communities.id AND m.role = 'owner') AS owner_name,
          (SELECT u.display_name FROM users u WHERE u.id = communities.created_by) AS created_by_name`,
        from: `communities ${whereOf(conds)}`,
        order: orderBy(sort, q.dir, 'id'),
        map: (row): AdminCommunityRow => ({
          id: row.id,
          slug: row.slug,
          name: row.name,
          description: row.description,
          communityType: row.community_type,
          status: row.status,
          ownerName: row.owner_name ?? null,
          createdByName: row.created_by_name ?? null,
          membersCount: row.members_count ?? 0,
          postsCount: row.posts_count ?? 0,
          createdAt: iso(row.created_at) as string
        })
      }),
      this.facet(`SELECT community_type AS value, COUNT(*)::int AS count FROM communities GROUP BY 1 ORDER BY 2 DESC`),
      this.facet(`SELECT status AS value, COUNT(*)::int AS count FROM communities GROUP BY 1 ORDER BY 2 DESC`)
    ])
    return { ...page, facets: { type: facets, status: statuses } }
  }

  // ── N7AI Skills ─────────────────────────────────────────────────────────

  async skills(q: SkillsQuery): Promise<AdminPage<AdminAiSkillRow>> {
    const p = new SqlParams()
    const status = { public: 's.is_public = TRUE AND s.enabled = TRUE', private: 's.is_public = FALSE AND s.enabled = TRUE', disabled: 's.enabled = FALSE' }
    const conds = [
      's.source_skill_id IS NULL',
      searchCondition(p, q.q, { username: 'u.username', like: ['s.name', 's.slug'] }),
      q.status && status[q.status]
    ]
    const sort = { installs: 's.install_count', uses: 's.use_count', recent: 's.created_at' }[q.sort]
    return pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `s.id, s.slug, s.name, s.description, s.is_public, s.enabled, s.install_count, s.use_count, s.created_at,
        u.id AS owner_id, u.username, u.display_name`,
      from: `ai_skills s JOIN users u ON u.id = s.owner_id ${whereOf(conds)}`,
      order: orderBy(sort, q.dir, 's.id'),
      map: (row): AdminAiSkillRow => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        description: row.description,
        isPublic: !!row.is_public,
        enabled: !!row.enabled,
        installCount: row.install_count ?? 0,
        useCount: row.use_count ?? 0,
        createdAt: iso(row.created_at) as string,
        owner: { id: row.owner_id, username: row.username, displayName: row.display_name }
      })
    })
  }

  // ── Nhật ký kiểm toán ───────────────────────────────────────────────────

  async audit(q: AuditQuery): Promise<AdminPage<AdminAuditLog>> {
    const p = new SqlParams()
    const conds = [
      q.action && `l.action = ${p.add(q.action)}`,
      q.admin && `lower(u.username) = ${p.add(q.admin.replace(/^@/, '').toLowerCase())}`,
      q.targetType && `l.target_type = ${p.add(q.targetType)}`,
      q.days && `l.created_at > NOW() - make_interval(days => ${p.add(Number(q.days))})`,
      q.q && `l.target_id LIKE ${p.add(`${likeEscape(q.q.trim())}%`)}`
    ]
    const page = pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `l.id, l.action, l.target_type, l.target_id, l.details, l.created_at,
        u.id AS admin_id, u.username, u.display_name, u.role AS admin_role`,
      from: `admin_audit_logs l LEFT JOIN users u ON u.id = l.admin_id ${whereOf(conds)}`,
      order: orderBy('l.created_at', q.dir, 'l.id'),
      map: (row): AdminAuditLog => ({
        id: String(row.id),
        action: row.action,
        targetType: row.target_type,
        targetId: row.target_id,
        details: row.details,
        createdAt: iso(row.created_at) as string,
        admin: row.admin_id ? { id: row.admin_id, username: row.username, displayName: row.display_name, role: row.admin_role } : null
      })
    })
    // Người thực hiện (cho bộ lọc)
    const admins = this.facet(
      `SELECT u.username AS value, COUNT(*)::int AS count FROM admin_audit_logs l JOIN users u ON u.id = l.admin_id GROUP BY 1 ORDER BY 2 DESC LIMIT 50`
    )
    const [res, adminFacet] = await Promise.all([page, admins])
    return { ...res, facets: { admin: adminFacet } }
  }

  // ── Nhật ký đăng nhập toàn hệ thống ─────────────────────────────────────

  async securityEvents(q: SecurityEventsQuery): Promise<AdminPage<AdminSecurityEventRow>> {
    const p = new SqlParams()
    const raw = q.q?.trim()
    const isIp = !!raw && /^[0-9a-f:.]+$/i.test(raw) && /[.:]/.test(raw)
    const conds = [
      raw && (isIp ? `host(e.ip) LIKE ${p.add(`${likeEscape(raw)}%`)}` : `lower(u.username) LIKE ${p.add(`${likeEscape(raw.replace(/^@/, '').toLowerCase())}%`)}`),
      q.event && `e.event = ${p.add(q.event)}`,
      q.result === 'failed' && 'NOT e.success',
      q.result === 'unusual' && 'e.unusual',
      q.country && `e.country = ${p.add(q.country.toUpperCase())}`,
      q.days && `e.created_at > NOW() - make_interval(days => ${p.add(Number(q.days))})`
    ]
    return pagedQuery(this.db, {
      params: p,
      page: q.page,
      pageSize: q.pageSize,
      select: `e.id, e.event, e.success, e.method, host(e.ip) AS ip, e.device, e.country, e.region, e.city, e.unusual, e.created_at,
        u.id AS user_id, u.username, u.display_name, u.avatar_url`,
      from: `user_security_events e LEFT JOIN users u ON u.id = e.user_id ${whereOf(conds)}`,
      order: orderBy('e.created_at', q.dir, 'e.id'),
      map: (r): AdminSecurityEventRow => ({
        id: String(r.id),
        event: r.event,
        success: r.success,
        method: r.method,
        ip: r.ip,
        device: r.device,
        location: formatLocation(r as never),
        country: r.country,
        unusual: r.unusual,
        createdAt: iso(r.created_at) as string,
        user: r.user_id ? { id: r.user_id, username: r.username, displayName: r.display_name, avatarUrl: r.avatar_url } : null
      })
    })
  }

  private async facet(sql: string) {
    const res = await this.db.query(sql)
    return res.rows.map((r: Row) => ({ value: String(r.value), count: r.count }))
  }
}
