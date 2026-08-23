import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type {
  SearchQueryInput,
  SearchResult,
  Course,
  DocumentItem,
  PostItem,
  UserSummary,
  StudyGroup
} from '@pu/schemas'

@Injectable()
export class SearchService {
  private readonly logger = new Logger(SearchService.name)

  constructor(private readonly db: DatabaseService) {}

  async search(queryInput: SearchQueryInput, currentUserId?: string): Promise<SearchResult> {
    const { q, type = 'all', faculty, limit = 20, offset = 0 } = queryInput
    const term = `%${q.trim()}%`
    const rawTag = q.trim().replace(/^#/, '')

    let courses: Course[] = []
    let documents: DocumentItem[] = []
    let posts: PostItem[] = []
    let users: UserSummary[] = []
    let groups: StudyGroup[] = []

    const shouldSearchAll = type === 'all'

    // 1. Search Courses
    if (shouldSearchAll || type === 'courses') {
      courses = await this.searchCourses(term, faculty, shouldSearchAll ? 4 : limit, offset)
    }

    // 2. Search Documents & Exam Papers
    if (shouldSearchAll || type === 'documents') {
      documents = await this.searchDocuments(term, rawTag, faculty, shouldSearchAll ? 5 : limit, offset)
    }

    // 3. Search Academic Posts & Q&A
    if (shouldSearchAll || type === 'posts') {
      posts = await this.searchPosts(term, rawTag, faculty, shouldSearchAll ? 6 : limit, offset, currentUserId)
    }

    // 4. Search Users (Students & Lecturers)
    if (shouldSearchAll || type === 'users') {
      users = await this.searchUsers(term, rawTag, faculty, shouldSearchAll ? 4 : limit, offset, currentUserId)
    }

    // 5. Search PBL Study Groups
    if (shouldSearchAll || type === 'groups') {
      groups = await this.searchGroups(term, rawTag, faculty, shouldSearchAll ? 4 : limit, offset)
    }

    const counts = {
      courses: courses.length,
      documents: documents.length,
      posts: posts.length,
      users: users.length,
      groups: groups.length,
      total: courses.length + documents.length + posts.length + users.length + groups.length
    }

    return {
      query: q,
      type,
      counts,
      courses,
      documents,
      posts,
      users,
      groups
    }
  }

  // ── 1. Search Courses ──────────────────────────────────────────
  private async searchCourses(
    term: string,
    faculty?: string,
    limit = 10,
    offset = 0
  ): Promise<Course[]> {
    const params: any[] = [term]
    let sql = `
      SELECT c.*, f.name as faculty_name
      FROM courses c
      LEFT JOIN faculties f ON c.faculty_id = f.id
      WHERE (c.code ILIKE $1 OR c.name ILIKE $1 OR c.description ILIKE $1)
    `

    if (faculty) {
      params.push(faculty)
      sql += ` AND (c.faculty_code = $${params.length} OR f.code = $${params.length})`
    }

    params.push(limit, offset)
    sql += `
      ORDER BY
        CASE WHEN c.code ILIKE $1 THEN 1 ELSE 2 END,
        c.rating_avg DESC,
        c.post_count DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const res = await this.db.query(sql, params)
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
  }

  // ── 2. Search Documents & Exam Papers ──────────────────────────
  private async searchDocuments(
    term: string,
    rawTag: string,
    faculty?: string,
    limit = 10,
    offset = 0
  ): Promise<DocumentItem[]> {
    const params: any[] = [term, rawTag]
    let sql = `
      SELECT d.*,
             u.id as owner_id, u.username as owner_username, u.display_name as owner_display_name,
             u.avatar_url as owner_avatar_url,
             c.code as course_code, c.name as course_name
      FROM documents d
      JOIN users u ON d.owner_id = u.id
      LEFT JOIN courses c ON d.course_id = c.id
      WHERE (d.title ILIKE $1 OR d.description ILIKE $1 OR $2 = ANY(d.tags) OR c.code ILIKE $1 OR c.name ILIKE $1)
    `

    if (faculty) {
      params.push(faculty)
      sql += ` AND (c.faculty_code = $${params.length} OR u.faculty = $${params.length})`
    }

    params.push(limit, offset)
    sql += `
      ORDER BY d.download_count DESC, d.view_count DESC, d.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const res = await this.db.query(sql, params)
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
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }))
  }

  // ── 3. Search Posts & Q&A Discussions ──────────────────────────
  private async searchPosts(
    term: string,
    rawTag: string,
    faculty?: string,
    limit = 10,
    offset = 0,
    currentUserId?: string
  ): Promise<PostItem[]> {
    const params: any[] = [term, rawTag]
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name
    `

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $${params.length}) as is_liked_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me`
    }

    sql += `
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN courses c ON p.course_id = c.id
      WHERE (p.title ILIKE $1 OR p.content ILIKE $1 OR $2 = ANY(p.tags) OR c.code ILIKE $1 OR c.name ILIKE $1)
    `

    if (faculty) {
      params.push(faculty)
      sql += ` AND (u.faculty = $${params.length} OR c.faculty_code = $${params.length})`
    }

    params.push(limit, offset)
    sql += `
      ORDER BY p.is_pinned DESC, p.is_resolved DESC, (p.likes_count * 2 + p.comments_count * 5) DESC, p.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => ({
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
      postType: row.post_type || 'general',
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
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }))
  }

  // ── 4. Search Users (Students & Lecturers) ───────────────────────
  private async searchUsers(
    term: string,
    rawTag: string,
    faculty?: string,
    limit = 10,
    offset = 0,
    currentUserId?: string
  ): Promise<UserSummary[]> {
    const params: any[] = [term, rawTag]
    let sql = `
      SELECT u.id, u.username, u.display_name, u.avatar_url, u.faculty, u.role,
             u.reputation_points, u.academic_year
    `

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $${params.length} AND uf.following_id = u.id) as is_followed_by_me`
    } else {
      sql += `, FALSE as is_followed_by_me`
    }

    sql += `
      FROM users u
      WHERE (u.username ILIKE $1 OR u.display_name ILIKE $1 OR u.student_id ILIKE $1 OR u.bio ILIKE $1 OR $2 = ANY(u.skills) OR $2 = ANY(u.interests))
    `

    if (faculty) {
      params.push(faculty)
      sql += ` AND u.faculty = $${params.length}`
    }

    params.push(limit, offset)
    sql += `
      ORDER BY u.reputation_points DESC, u.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const res = await this.db.query(sql, params)
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
  }

  // ── 5. Search PBL Study Groups ──────────────────────────────────
  private async searchGroups(
    term: string,
    rawTag: string,
    faculty?: string,
    limit = 10,
    offset = 0
  ): Promise<StudyGroup[]> {
    const params: any[] = [term, rawTag]
    let sql = `
      SELECT g.*,
             u.id as leader_user_id, u.username as leader_username, u.display_name as leader_display_name,
             u.avatar_url as leader_avatar_url
      FROM study_groups g
      JOIN users u ON g.leader_id = u.id
      WHERE (g.name ILIKE $1 OR g.topic ILIKE $1 OR g.course_code ILIKE $1 OR g.course_name ILIKE $1 OR $2 = ANY(g.tech_stack))
    `

    if (faculty) {
      params.push(faculty)
      sql += ` AND u.faculty = $${params.length}`
    }

    params.push(limit, offset)
    sql += `
      ORDER BY g.created_at DESC
      LIMIT $${params.length - 1} OFFSET $${params.length}
    `

    const res = await this.db.query(sql, params)
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
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }))
  }
}
