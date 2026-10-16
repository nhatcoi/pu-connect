import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { parseQuery, type ParsedQuery } from './search-query'
import { blockExistsSql } from '../blocks/blocks.sql'
import type { SearchQueryInput, SearchResult, Course, DocumentItem, PostItem, UserSummary, StudyGroup } from '@pu/schemas'

type Queryable = { query: (sql: string, params?: any[]) => Promise<{ rows: any[] }> }
type Mode = 'fts' | 'fuzzy'

const LOG_RETENTION_DAYS = 180
// Truy vấn ≤ 5 kết quả là typeahead (gõ tới đâu gợi ý tới đó) ⇒ không ghi log
const TYPEAHEAD_MAX_LIMIT = 5
const FUZZY_THRESHOLD = 0.35

// Tìm kiếm: full-text bỏ dấu (khớp tiền tố) → gõ sai (trigram) khi thiếu kết quả.
// Xếp hạng: độ liên quan chữ (A>B>C) + khớp tên + độ phổ biến/mới. Chi tiết: docs/core/07-search.md
@Injectable()
export class SearchService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(SearchService.name)
  private cleanupTimer?: NodeJS.Timeout

  constructor(private readonly db: DatabaseService) {}

  onModuleInit() {
    // Dọn log tìm kiếm quá hạn mỗi 24h
    this.cleanupTimer = setInterval(() => void this.cleanupLogs(), 24 * 60 * 60 * 1000)
    this.cleanupTimer.unref()
  }

  onModuleDestroy() {
    if (this.cleanupTimer) clearInterval(this.cleanupTimer)
  }

  private async cleanupLogs() {
    try {
      await this.db.query(`DELETE FROM search_logs WHERE created_at < NOW() - make_interval(days => $1)`, [LOG_RETENTION_DAYS])
    } catch (err: any) {
      this.logger.warn(`Dọn search_logs thất bại: ${err?.message}`)
    }
  }

  async search(queryInput: SearchQueryInput, currentUserId?: string): Promise<SearchResult> {
    const { q, type = 'all', faculty, limit = 20, offset = 0 } = queryInput
    const parsed = parseQuery(q)
    const all = type === 'all'

    let courses: Course[] = []
    let documents: DocumentItem[] = []
    let posts: PostItem[] = []
    let users: UserSummary[] = []
    let groups: StudyGroup[] = []

    // Chỉ có ký tự đặc biệt ⇒ không có gì để tìm
    if (!parsed.isEmpty) {
      ;[courses, documents, posts, users, groups] = await Promise.all([
        all || type === 'courses' ? this.searchCourses(parsed, faculty, all ? 4 : limit, offset) : [],
        all || type === 'documents' ? this.searchDocuments(parsed, faculty, all ? 5 : limit, offset, currentUserId) : [],
        all || type === 'posts' ? this.searchPosts(parsed, faculty, all ? 6 : limit, offset, currentUserId) : [],
        all || type === 'users' ? this.searchUsers(parsed, faculty, all ? 4 : limit, offset, currentUserId) : [],
        all || type === 'groups' ? this.searchGroups(parsed, faculty, all ? 4 : limit, offset) : []
      ])
    }

    const counts = {
      courses: courses.length,
      documents: documents.length,
      posts: posts.length,
      users: users.length,
      groups: groups.length,
      total: courses.length + documents.length + posts.length + users.length + groups.length
    }

    if (!parsed.isEmpty && limit > TYPEAHEAD_MAX_LIMIT && offset === 0) {
      this.logQuery(parsed, type, counts.total)
    }

    return { query: q, type, counts, courses, documents, posts, users, groups }
  }

  // Ghi nền, không chặn phản hồi, không lưu danh tính
  private logQuery(parsed: ParsedQuery, type: string, resultCount: number) {
    const norm = (parsed.tag ? `#${parsed.tag}` : parsed.plain).slice(0, 100)
    void this.db
      .query(`INSERT INTO search_logs (q_norm, search_type, result_count) VALUES ($1, $2, $3)`, [norm, type, resultCount])
      .catch((err) => this.logger.warn(`Ghi search_logs thất bại: ${err?.message}`))
  }

  // ── Khối dùng chung ─────────────────────────────────────────────

  // Tham số cố định cho mọi truy vấn: $1 tsquery · $2 từ khóa bỏ dấu · $3 tag
  private baseParams(q: ParsedQuery): any[] {
    return [q.tsquery ?? '', q.plain, q.tag ?? '']
  }

  /**
   * WHERE + điểm văn bản cho từng chế độ.
   *  fts   : to_tsquery khớp tiền tố trên search_tsv (có chỉ mục GIN)
   *  fuzzy : word_similarity (trigram) cho lỗi gõ sai, loại bản ghi fts đã có
   *  #tag  : chỉ khớp chính xác tag
   */
  private match(alias: string, nameExpr: string, tagExpr: string | undefined, q: ParsedQuery, mode: Mode): { where: string; score: string } | null {
    // Gán kiểu cho cả 3 tham số cố định (Postgres không suy ra kiểu của tham số không dùng)
    const typed = `$1::text IS NOT NULL AND $2::text IS NOT NULL AND $3::text IS NOT NULL`
    if (q.tag) {
      if (!tagExpr) return null
      return { where: `${typed} AND EXISTS (SELECT 1 FROM unnest(${tagExpr}) t WHERE lower(t) = $3)`, score: '0' }
    }
    const tsq = `to_tsquery('simple', $1)`
    if (mode === 'fuzzy') {
      return {
        where: `${typed} AND ($2 <% ${nameExpr} AND NOT (${alias}.search_tsv @@ ${tsq}))`,
        score: `word_similarity($2, ${nameExpr})`
      }
    }
    // Khớp tên: đúng hệt > bắt đầu bằng > chứa từ
    const nameBoost = `(CASE WHEN ${nameExpr} = $2 THEN 1.0
                             WHEN ${nameExpr} LIKE $2 || '%' THEN 0.5
                             WHEN ${nameExpr} LIKE '% ' || $2 || '%' THEN 0.2 ELSE 0 END)`
    return {
      where: `${typed} AND ${alias}.search_tsv @@ ${tsq}`,
      score: `(ts_rank_cd(${alias}.search_tsv, ${tsq}, 32) + ${nameBoost})`
    }
  }

  // Pha 1: full-text. Thiếu kết quả (trang đầu) ⇒ pha 2: gõ sai, trong transaction để đặt ngưỡng trigram
  private async twoPhase<T>(
    q: ParsedQuery,
    limit: number,
    offset: number,
    run: (mode: Mode, limit: number, offset: number, db: Queryable) => Promise<T[]>
  ): Promise<T[]> {
    const primary = await run('fts', limit, offset, this.db)
    if (primary.length >= limit || offset > 0 || q.tag || q.plain.length < 3) return primary

    const fuzzy = await this.db.transaction(async (client) => {
      await client.query(`SET LOCAL pg_trgm.word_similarity_threshold = ${FUZZY_THRESHOLD}`)
      return run('fuzzy', limit - primary.length, 0, client)
    })
    return [...primary, ...fuzzy]
  }

  private iso(value: any): string {
    return value ? new Date(value).toISOString() : new Date().toISOString()
  }

  // ── 1. Học phần ──────────────────────────────────────────────────
  private searchCourses(q: ParsedQuery, faculty: string | undefined, limit: number, offset: number): Promise<Course[]> {
    return this.twoPhase(q, limit, offset, async (mode, lim, off, db) => {
      const m = this.match('c', `immutable_unaccent(lower(c.name))`, undefined, q, mode)
      if (!m) return []
      const params = this.baseParams(q)
      let sql = `
        SELECT c.*, f.name as faculty_name
        FROM courses c
        LEFT JOIN faculties f ON c.faculty_id = f.id
        WHERE ${m.where}`
      if (faculty) {
        params.push(faculty)
        sql += ` AND (c.faculty_code = $${params.length} OR f.code = $${params.length})`
      }
      params.push(lim, off)
      sql += `
        ORDER BY ${m.score}
                 + ln(1 + coalesce(c.post_count, 0) + coalesce(c.document_count, 0)) * 0.05
                 + coalesce(c.rating_avg, 0) / 5.0 * 0.05 DESC,
                 c.code ASC
        LIMIT $${params.length - 1} OFFSET $${params.length}`
      const res = await db.query(sql, params)
      return res.rows.map((row) => ({
        id: row.id,
        code: row.code,
        name: row.name,
        credits: row.credits,
        departmentId: row.faculty_id || row.faculty_code || 'FIT',
        departmentName: row.faculty_name || row.faculty_code,
        description: row.description || '',
        rating: parseFloat(row.rating_avg) || 5.0,
        documentCount: row.document_count || 0,
        postCount: row.post_count || 0
      }))
    })
  }

  // ── 2. Tài liệu & đề thi ─────────────────────────────────────────
  private searchDocuments(q: ParsedQuery, faculty: string | undefined, limit: number, offset: number, currentUserId?: string): Promise<DocumentItem[]> {
    return this.twoPhase(q, limit, offset, async (mode, lim, off, db) => {
      const m = this.match('d', `immutable_unaccent(lower(d.title))`, 'd.tags', q, mode)
      if (!m) return []
      const params = this.baseParams(q)
      // Quyền xem: chỉ tài liệu công khai, hoặc của chính người tìm
      params.push(currentUserId ?? null)
      const viewer = `$${params.length}`
      let sql = `
        SELECT d.*,
               u.id as owner_id, u.username as owner_username, u.display_name as owner_display_name,
               u.avatar_url as owner_avatar_url,
               c.code as course_code, c.name as course_name
        FROM documents d
        JOIN users u ON d.owner_id = u.id
        LEFT JOIN courses c ON d.course_id = c.id
        WHERE ${m.where}
          AND (d.visibility = 'public' OR d.owner_id = ${viewer}::uuid)`
      if (faculty) {
        params.push(faculty)
        sql += ` AND (c.faculty_code = $${params.length} OR u.faculty = $${params.length})`
      }
      params.push(lim, off)
      sql += `
        ORDER BY ${m.score}
                 + ln(1 + coalesce(d.download_count, 0) * 2 + coalesce(d.view_count, 0)) * 0.05
                 + exp(-extract(epoch FROM (NOW() - d.created_at)) / 86400.0 / 180) * 0.1 DESC,
                 d.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`
      const res = await db.query(sql, params)
      return res.rows.map((row) => ({
        id: row.id,
        ownerId: row.owner_id,
        owner: {
          id: row.owner_id,
          username: row.owner_username || 'user',
          displayName: row.owner_display_name || 'Sinh viên Phenikaa',
          avatarUrl: row.owner_avatar_url || null
        },
        courseId: row.course_id,
        courseCode: row.course_code,
        title: row.title,
        description: row.description,
        type: row.type || 'pdf',
        fileUrl: row.file_url,
        fileSize: parseInt(row.file_size, 10) || 1024 * 1024,
        mimeType: row.mime_type || 'application/pdf',
        tags: row.tags || [],
        downloadCount: row.download_count || 0,
        viewCount: row.view_count || 0,
        visibility: row.visibility || 'public',
        createdAt: this.iso(row.created_at),
        updatedAt: this.iso(row.updated_at)
      }))
    })
  }

  // ── 3. Bài viết & hỏi đáp ────────────────────────────────────────
  private searchPosts(q: ParsedQuery, faculty: string | undefined, limit: number, offset: number, currentUserId?: string): Promise<PostItem[]> {
    return this.twoPhase(q, limit, offset, async (mode, lim, off, db) => {
      const m = this.match('p', `immutable_unaccent(lower(p.title))`, 'p.tags', q, mode)
      if (!m) return []
      const params = this.baseParams(q)
      params.push(currentUserId ?? null)
      const viewer = `$${params.length}`
      let sql = `
        SELECT p.*,
               u.id as author_user_id, u.email as author_email, u.username as author_username,
               u.display_name as author_display_name, u.avatar_url as author_avatar_url,
               u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
               c.code as course_code, c.name as course_name,
               (${currentUserId ? `EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = ${viewer}::uuid)` : 'FALSE'}) as is_liked_by_me
        FROM posts p
        JOIN users u ON p.author_id = u.id
        LEFT JOIN courses c ON p.course_id = c.id
        WHERE ${m.where}
          AND p.hidden_at IS NULL
          AND (p.visibility = 'public' OR p.author_id = ${viewer}::uuid)
          AND (${viewer}::uuid IS NULL OR NOT ${blockExistsSql(`${viewer}::uuid`, 'p.author_id')})`
      if (faculty) {
        params.push(faculty)
        sql += ` AND (u.faculty = $${params.length} OR c.faculty_code = $${params.length})`
      }
      params.push(lim, off)
      // Phổ biến + mới (bán rã 90 ngày) + câu hỏi đã có lời giải được cộng nhẹ
      sql += `
        ORDER BY ${m.score}
                 + ln(1 + coalesce(p.likes_count, 0) + coalesce(p.comments_count, 0) * 2) * 0.05
                 + exp(-extract(epoch FROM (NOW() - p.created_at)) / 86400.0 / 90) * 0.15
                 + (CASE WHEN p.is_resolved THEN 0.05 ELSE 0 END) DESC,
                 p.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`
      const res = await db.query(sql, params)
      return res.rows.map((row) => this.mapPost(row))
    })
  }

  private mapPost(row: any): PostItem {
    let postType: PostItem['postType'] = 'general'
    if (row.post_type === 'question' || row.post_type === 'qa') postType = 'qa'
    else if (row.post_type === 'resource_share' || row.post_type === 'document') postType = 'document'
    else if (row.post_type === 'pbl_recruitment' || row.post_type === 'group_recruit') postType = 'group_recruit'
    else if (row.post_type === 'review') postType = 'review'

    return {
      id: row.id,
      authorId: row.author_id,
      author: {
        id: row.author_user_id || row.author_id,
        username: row.author_username || 'user',
        displayName: row.author_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.author_avatar_url || null
      },
      title: row.title,
      content: row.content,
      postType,
      courseId: row.course_id,
      courseCode: row.course_code || null,
      courseName: row.course_name || null,
      facultyCode: row.author_faculty || null,
      targetAudience: 'everyone',
      isResolved: row.is_resolved || false,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: row.is_liked_by_me || false,
      createdAt: this.iso(row.created_at),
      updatedAt: this.iso(row.updated_at)
    } as PostItem
  }

  // ── 4. Người dùng ────────────────────────────────────────────────
  private searchUsers(q: ParsedQuery, faculty: string | undefined, limit: number, offset: number, currentUserId?: string): Promise<UserSummary[]> {
    return this.twoPhase(q, limit, offset, async (mode, lim, off, db) => {
      const m = this.match('u', `immutable_unaccent(lower(u.display_name || ' ' || u.username))`, '(u.skills || u.interests)', q, mode)
      if (!m) return []
      const params = this.baseParams(q)
      // Tham số người xem chỉ thêm khi có đăng nhập (khác posts/documents: ở đây chỉ dùng cho cờ "đã theo dõi")
      if (currentUserId) params.push(currentUserId)
      const viewer = `$${params.length}`
      // Chỉ tài khoản hoạt động; bot (@puai) tìm được, tài khoản hệ thống thì không
      let sql = `
        SELECT u.id, u.username, u.display_name, u.avatar_url, u.faculty, u.role,
               u.reputation_points, u.academic_year,
               (${currentUserId ? `EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = ${viewer}::uuid AND uf.following_id = u.id)` : 'FALSE'}) as is_followed_by_me
        FROM users u
        WHERE ${m.where}
          AND u.status = 'active' AND u.account_type IN ('human', 'bot')`
      if (faculty) {
        params.push(faculty)
        sql += ` AND u.faculty = $${params.length}`
      }
      params.push(lim, off)
      // Username khớp hệt/tiền tố được ưu tiên; người có uy tín & đã xác thực nhỉnh hơn
      sql += `
        ORDER BY ${m.score}
                 + (CASE WHEN lower(u.username) = $2 THEN 1.0 WHEN lower(u.username) LIKE $2 || '%' THEN 0.4 ELSE 0 END)
                 + ln(1 + coalesce(u.reputation_points, 0)) * 0.03
                 + (CASE WHEN u.is_verified THEN 0.1 ELSE 0 END) DESC,
                 u.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`
      const res = await db.query(sql, params)
      return res.rows.map((row) => ({
        id: row.id,
        username: row.username,
        displayName: row.display_name,
        avatarUrl: row.avatar_url || null,
        faculty: row.faculty || null,
        role: row.role || 'student',
        reputationPoints: row.reputation_points || 100,
        academicYear: row.academic_year || null,
        isFollowedByMe: !!row.is_followed_by_me
      }))
    })
  }

  // ── 5. Nhóm đồ án (PBL) ──────────────────────────────────────────
  private searchGroups(q: ParsedQuery, faculty: string | undefined, limit: number, offset: number): Promise<StudyGroup[]> {
    return this.twoPhase(q, limit, offset, async (mode, lim, off, db) => {
      const m = this.match('g', `immutable_unaccent(lower(g.name))`, 'g.tech_stack', q, mode)
      if (!m) return []
      const params = this.baseParams(q)
      let sql = `
        SELECT g.*,
               u.id as leader_user_id, u.username as leader_username, u.display_name as leader_display_name,
               u.avatar_url as leader_avatar_url
        FROM study_groups g
        JOIN users u ON g.leader_id = u.id
        WHERE ${m.where}`
      if (faculty) {
        params.push(faculty)
        sql += ` AND u.faculty = $${params.length}`
      }
      params.push(lim, off)
      // Nhóm đang tuyển được ưu tiên
      sql += `
        ORDER BY ${m.score}
                 + (CASE WHEN g.status = 'recruiting' THEN 0.1 ELSE 0 END)
                 + exp(-extract(epoch FROM (NOW() - g.created_at)) / 86400.0 / 60) * 0.1 DESC,
                 g.created_at DESC
        LIMIT $${params.length - 1} OFFSET $${params.length}`
      const res = await db.query(sql, params)
      return res.rows.map((row) => ({
        id: row.id,
        name: row.name,
        topic: row.topic,
        courseId: row.course_id,
        courseCode: row.course_code,
        courseName: row.course_name,
        description: row.description || row.topic || '',
        techStack: row.tech_stack || [],
        maxMembers: row.max_members || 5,
        currentMembersCount: row.current_members || 1,
        members: [],
        status: row.status || 'recruiting',
        leaderId: row.leader_id,
        leaderName: row.leader_display_name || row.leader_username || 'Trưởng nhóm',
        createdAt: this.iso(row.created_at),
        updatedAt: this.iso(row.updated_at)
      }))
    })
  }
}
