import { Injectable, NotFoundException, ForbiddenException, BadRequestException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import type { CreatePostInput, PostItem, UpdatePostInput, ReportPostInput, PollData } from '@pu/schemas'

export interface FeedResult {
  data: PostItem[]
  total: number
  hasMore: boolean
  nextOffset: number
}

@Injectable()
export class PostsService {
  private readonly logger = new Logger(PostsService.name)

  constructor(private readonly db: DatabaseService) {}

  async findAll(
    currentUserId?: string,
    tag?: string,
    limit = 10,
    offset = 0,
    feedType = 'for_you'
  ): Promise<FeedResult> {
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    let scoreCalculation = `0.0`
    let joins = ` FROM posts p JOIN users u ON p.author_id = u.id LEFT JOIN courses c ON p.course_id = c.id`

    const params: any[] = []

    if (currentUserId) {
      params.push(currentUserId)
      joins += ` LEFT JOIN users cu ON cu.id = $1`

      scoreCalculation = `(
        (CASE WHEN u.faculty IS NOT NULL AND cu.faculty IS NOT NULL AND u.faculty = cu.faculty THEN 30.0 ELSE 0.0 END)
        + (CASE WHEN u.academic_year IS NOT NULL AND cu.academic_year IS NOT NULL AND u.academic_year = cu.academic_year THEN 15.0 ELSE 0.0 END)
        + (CASE WHEN EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = cu.id AND uf.following_id = p.author_id) THEN 35.0 ELSE 0.0 END)
        + (CASE WHEN cu.interests IS NOT NULL AND array_length(cu.interests, 1) > 0 AND p.tags && cu.interests THEN 35.0 ELSE 0.0 END)
        + (CASE WHEN cu.skills IS NOT NULL AND array_length(cu.skills, 1) > 0 AND p.tags && cu.skills THEN 25.0 ELSE 0.0 END)
        + (CASE WHEN p.is_resolved THEN 10.0 ELSE 0.0 END)
        + (p.likes_count * 2.0 + p.comments_count * 5.0)
        - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 * 2.0)
      )`
    } else {
      scoreCalculation = `(
        (CASE WHEN p.is_resolved THEN 10.0 ELSE 0.0 END)
        + (p.likes_count * 2.0 + p.comments_count * 5.0)
        - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 * 2.0)
      )`
    }

    let whereClause = ` WHERE 1=1`

    if (tag) {
      params.push(tag)
      whereClause += ` AND $${params.length} = ANY(p.tags)`
    }

    if (feedType === 'courses') {
      whereClause += ` AND (p.course_id IS NOT NULL OR p.post_type IN ('question', 'resource_share'))`
    } else if (feedType === 'bookmarks' && currentUserId) {
      whereClause += ` AND EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1)`
    }

    // 1. Get total count
    const countSql = `SELECT COUNT(*) as total ${joins} ${whereClause}`
    const countRes = await this.db.query(countSql, params)
    const total = parseInt(countRes.rows[0]?.total || '0', 10)

    // 2. Query posts with score
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name,
             ${scoreCalculation} as recommendation_score
    `

    if (currentUserId) {
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as is_liked_by_me,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $1) as is_bookmarked_by_me,
               EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $1 AND uf.following_id = p.author_id) as is_author_followed_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me, FALSE as is_bookmarked_by_me, FALSE as is_author_followed_by_me`
    }

    sql += `${joins} ${whereClause}`

    params.push(safeLimit, safeOffset)
    sql += ` ORDER BY recommendation_score DESC, p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

    const res = await this.db.query(sql, params)
    
    // 3. Batch fetch polls for these posts
    const postIds = res.rows.map((r) => r.id)
    const pollsMap = await this.fetchPollsForPosts(postIds, currentUserId)

    const items = res.rows.map((row) => this.mapRowToPostItem(row, pollsMap.get(row.id)))

    return {
      data: items,
      total,
      hasMore: safeOffset + items.length < total,
      nextOffset: safeOffset + items.length
    }
  }

  async findOne(id: string, currentUserId?: string): Promise<PostItem> {
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name
    `
    const params: any[] = [id]

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $2) as is_liked_by_me,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) as is_bookmarked_by_me,
               EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $2 AND uf.following_id = p.author_id) as is_author_followed_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me, FALSE as is_bookmarked_by_me, FALSE as is_author_followed_by_me`
    }

    sql += ` FROM posts p JOIN users u ON p.author_id = u.id LEFT JOIN courses c ON p.course_id = c.id WHERE p.id = $1 LIMIT 1`

    const res = await this.db.query(sql, params)
    if (res.rows.length === 0) {
      throw new NotFoundException(`Bài viết không tồn tại (ID: ${id})`)
    }

    const pollsMap = await this.fetchPollsForPosts([id], currentUserId)
    return this.mapRowToPostItem(res.rows[0], pollsMap.get(id))
  }

  async create(authorId: string, data: CreatePostInput): Promise<PostItem> {
    return this.db.transaction(async (client) => {
      // 1. Resolve author details
      const userRes = await client.query(
        `SELECT id, username, display_name, avatar_url, role, faculty, reputation_points FROM users WHERE id = $1 LIMIT 1`,
        [authorId]
      )

      if (userRes.rows.length === 0) {
        throw new NotFoundException('Tài khoản người dùng không tồn tại')
      }
      const authorUser = userRes.rows[0]

      // 2. Resolve course_id
      let courseUuid: string | null = null
      let courseCode: string | null = null
      let courseName: string | null = null

      if (data.courseId) {
        const courseRes = await client.query(
          `SELECT id, code, name FROM courses WHERE id::text = $1 OR code ILIKE $1 LIMIT 1`,
          [data.courseId]
        )
        if (courseRes.rows.length > 0) {
          courseUuid = courseRes.rows[0].id
          courseCode = courseRes.rows[0].code
          courseName = courseRes.rows[0].name
        }
      }

      // 3. Normalize post_type
      let dbPostType = 'general'
      if (data.postType === 'qa' || (data.postType as any) === 'question') {
        dbPostType = 'question'
      } else if (data.postType === 'document' || (data.postType as any) === 'resource_share') {
        dbPostType = 'resource_share'
      } else if (data.postType === 'group_recruit' || (data.postType as any) === 'pbl_recruitment') {
        dbPostType = 'pbl_recruitment'
      } else if (data.postType === 'review') {
        dbPostType = 'review'
      }

      // 4. Insert Post into PostgreSQL
      const insertRes = await client.query(
        `INSERT INTO posts (
          author_id, course_id, post_type, title, content, tags, media_urls, attached_document_ids, visibility
         ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
         RETURNING *`,
        [
          authorId,
          courseUuid,
          dbPostType,
          data.title || data.content.slice(0, 50),
          data.content,
          data.tags || [],
          data.mediaUrls || [],
          data.attachedDocumentIds || [],
          data.visibility || 'public'
        ]
      )

      const postRow = insertRes.rows[0]

      // 5. Create Poll if provided
      let pollData: PollData | null = null
      if (data.pollQuestion && data.pollOptions && data.pollOptions.length >= 2) {
        const pollRes = await client.query(
          `INSERT INTO post_polls (post_id, question, total_votes) VALUES ($1, $2, 0) RETURNING *`,
          [postRow.id, data.pollQuestion]
        )
        const pollRow = pollRes.rows[0]
        const optionsList: any[] = []

        for (let i = 0; i < data.pollOptions.length; i++) {
          const optText = data.pollOptions[i].trim()
          if (!optText) continue
          const optRes = await client.query(
            `INSERT INTO post_poll_options (poll_id, option_text, votes_count, display_order)
             VALUES ($1, $2, 0, $3) RETURNING *`,
            [pollRow.id, optText, i]
          )
          optionsList.push({
            id: optRes.rows[0].id,
            pollId: pollRow.id,
            optionText: optRes.rows[0].option_text,
            votesCount: 0,
            displayOrder: i
          })
        }

        pollData = {
          id: pollRow.id,
          postId: postRow.id,
          question: pollRow.question,
          totalVotes: 0,
          options: optionsList,
          myVotedOptionId: null
        }
      }

      // 6. Reward +5 reputation points for author
      await client.query(
        `UPDATE users SET reputation_points = reputation_points + 5 WHERE id = $1`,
        [authorId]
      )

      // 7. Increment post_count for course
      if (courseUuid) {
        await client.query(
          `UPDATE courses SET post_count = post_count + 1 WHERE id = $1`,
          [courseUuid]
        )
      }

      return {
        id: postRow.id,
        authorId: authorUser.id,
        author: {
          id: authorUser.id,
          username: authorUser.username,
          displayName: authorUser.display_name,
          avatarUrl: authorUser.avatar_url,
          role: authorUser.role,
          faculty: authorUser.faculty,
          reputationPoints: authorUser.reputation_points
        },
        title: postRow.title,
        content: postRow.content,
        postType: data.postType || 'general',
        courseId: courseUuid,
        courseCode,
        courseName,
        facultyCode: authorUser.faculty,
        targetAudience: data.targetAudience || 'everyone',
        isPinned: false,
        isResolved: false,
        recruitSlotsTotal: data.recruitSlotsTotal,
        recruitSlotsFilled: data.recruitSlotsFilled,
        tags: postRow.tags || [],
        mediaUrls: postRow.media_urls || [],
        attachedDocumentIds: postRow.attached_document_ids || [],
        likesCount: 0,
        commentsCount: 0,
        sharesCount: 0,
        isLikedByMe: false,
        isBookmarkedByMe: false,
        isAuthorFollowedByMe: false,
        poll: pollData,
        createdAt: postRow.created_at.toISOString(),
        updatedAt: postRow.updated_at.toISOString()
      }
    })
  }

  async update(postId: string, userId: string, data: UpdatePostInput): Promise<PostItem> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(
        `SELECT p.*, u.role as author_role FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = $1 LIMIT 1`,
        [postId]
      )
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền chỉnh sửa bài viết này')
      }

      const newTitle = data.title !== undefined ? data.title : post.title
      const newContent = data.content !== undefined ? data.content : post.content
      const newTags = data.tags !== undefined ? data.tags : post.tags

      await client.query(
        `UPDATE posts SET title = $1, content = $2, tags = $3, updated_at = NOW() WHERE id = $4`,
        [newTitle, newContent, newTags, postId]
      )

      return this.findOne(postId, userId)
    })
  }

  async delete(postId: string, userId: string): Promise<{ success: boolean }> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(
        `SELECT author_id, course_id FROM posts WHERE id = $1 LIMIT 1`,
        [postId]
      )
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền xóa bài viết này')
      }

      await client.query(`DELETE FROM posts WHERE id = $1`, [postId])

      if (post.course_id) {
        await client.query(
          `UPDATE courses SET post_count = GREATEST(0, post_count - 1) WHERE id = $1`,
          [post.course_id]
        )
      }

      return { success: true }
    })
  }

  async toggleLike(postId: string, userId: string): Promise<{ isLiked: boolean; likesCount: number }> {
    return this.db.transaction(async (client) => {
      const check = await client.query(
        `SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
        [postId, userId]
      )

      let isLiked = false
      if (check.rows.length > 0) {
        await client.query(
          `DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`,
          [postId, userId]
        )
        const res = await client.query(
          `UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1 RETURNING likes_count`,
          [postId]
        )
        isLiked = false
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      } else {
        await client.query(
          `INSERT INTO post_reactions (post_id, user_id, reaction) VALUES ($1, $2, 'like')`,
          [postId, userId]
        )
        const res = await client.query(
          `UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1 RETURNING likes_count`,
          [postId]
        )
        isLiked = true
        return { isLiked, likesCount: res.rows[0]?.likes_count || 0 }
      }
    })
  }

  async toggleBookmark(postId: string, userId: string): Promise<{ isBookmarked: boolean }> {
    return this.db.transaction(async (client) => {
      const check = await client.query(
        `SELECT 1 FROM saved_posts WHERE post_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
        [postId, userId]
      )

      if (check.rows.length > 0) {
        await client.query(
          `DELETE FROM saved_posts WHERE post_id = $1 AND user_id = $2`,
          [postId, userId]
        )
        return { isBookmarked: false }
      } else {
        await client.query(
          `INSERT INTO saved_posts (post_id, user_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`,
          [postId, userId]
        )
        return { isBookmarked: true }
      }
    })
  }

  async votePoll(postId: string, userId: string, optionId: string): Promise<PollData> {
    return this.db.transaction(async (client) => {
      const pollRes = await client.query(`SELECT id FROM post_polls WHERE post_id = $1 LIMIT 1`, [postId])
      if (pollRes.rows.length === 0) {
        throw new NotFoundException('Khảo sát không tồn tại cho bài viết này')
      }
      const pollId = pollRes.rows[0].id

      const optRes = await client.query(
        `SELECT id FROM post_poll_options WHERE id = $1 AND poll_id = $2 LIMIT 1`,
        [optionId, pollId]
      )
      if (optRes.rows.length === 0) {
        throw new BadRequestException('Phương án bình chọn không hợp lệ')
      }

      // Check existing vote
      const voteCheck = await client.query(
        `SELECT option_id FROM post_poll_votes WHERE poll_id = $1 AND user_id = $2 LIMIT 1 FOR UPDATE`,
        [pollId, userId]
      )

      if (voteCheck.rows.length > 0) {
        const prevOptId = voteCheck.rows[0].option_id
        if (prevOptId === optionId) {
          // Already voted this option
        } else {
          // Change vote
          await client.query(
            `UPDATE post_poll_options SET votes_count = GREATEST(0, votes_count - 1) WHERE id = $1`,
            [prevOptId]
          )
          await client.query(
            `UPDATE post_poll_options SET votes_count = votes_count + 1 WHERE id = $1`,
            [optionId]
          )
          await client.query(
            `UPDATE post_poll_votes SET option_id = $1, voted_at = NOW() WHERE poll_id = $2 AND user_id = $3`,
            [optionId, pollId, userId]
          )
        }
      } else {
        // New vote
        await client.query(
          `INSERT INTO post_poll_votes (poll_id, option_id, user_id) VALUES ($1, $2, $3)`,
          [pollId, optionId, userId]
        )
        await client.query(
          `UPDATE post_poll_options SET votes_count = votes_count + 1 WHERE id = $1`,
          [optionId]
        )
        await client.query(
          `UPDATE post_polls SET total_votes = total_votes + 1 WHERE id = $1`,
          [pollId]
        )
      }

      const map = await this.fetchPollsForPosts([postId], userId)
      const updatedPoll = map.get(postId)
      if (!updatedPoll) {
        throw new NotFoundException('Không tìm thấy thông tin khảo sát sau khi bình chọn')
      }
      return updatedPoll
    })
  }

  async togglePin(postId: string, userId: string): Promise<{ isPinned: boolean }> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(
        `SELECT author_id, is_pinned FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [postId]
      )
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền ghim bài viết này')
      }

      const nextIsPinned = !post.is_pinned
      await client.query(`UPDATE posts SET is_pinned = $1, updated_at = NOW() WHERE id = $2`, [
        nextIsPinned,
        postId
      ])

      return { isPinned: nextIsPinned }
    })
  }

  async toggleResolve(postId: string, userId: string): Promise<{ isResolved: boolean }> {
    return this.db.transaction(async (client) => {
      const postRes = await client.query(
        `SELECT author_id, is_resolved FROM posts WHERE id = $1 LIMIT 1 FOR UPDATE`,
        [postId]
      )
      if (postRes.rows.length === 0) {
        throw new NotFoundException('Bài viết không tồn tại')
      }

      const post = postRes.rows[0]
      const userRes = await client.query(`SELECT role FROM users WHERE id = $1 LIMIT 1`, [userId])
      const userRole = userRes.rows[0]?.role

      if (post.author_id !== userId && userRole !== 'admin') {
        throw new ForbiddenException('Bạn không có quyền thay đổi trạng thái câu hỏi này')
      }

      const nextIsResolved = !post.is_resolved
      await client.query(`UPDATE posts SET is_resolved = $1, updated_at = NOW() WHERE id = $2`, [
        nextIsResolved,
        postId
      ])

      return { isResolved: nextIsResolved }
    })
  }

  async report(postId: string, reporterId: string, data: ReportPostInput): Promise<{ success: boolean }> {
    await this.db.query(
      `INSERT INTO post_reports (post_id, reporter_id, reason, details) VALUES ($1, $2, $3, $4)`,
      [postId, reporterId, data.reason, data.details || null]
    )
    return { success: true }
  }

  private async fetchPollsForPosts(postIds: string[], currentUserId?: string): Promise<Map<string, PollData>> {
    const map = new Map<string, PollData>()
    if (postIds.length === 0) return map

    const pollsRes = await this.db.query(
      `SELECT p.id as poll_id, p.post_id, p.question, p.total_votes, p.expires_at, p.created_at,
              o.id as option_id, o.option_text, o.votes_count, o.display_order
       FROM post_polls p
       JOIN post_poll_options o ON p.id = o.poll_id
       WHERE p.post_id = ANY($1)
       ORDER BY p.post_id, o.display_order ASC`,
      [postIds]
    )

    let myVotesMap = new Map<string, string>()
    if (currentUserId) {
      const pollIds = Array.from(new Set(pollsRes.rows.map((r) => r.poll_id)))
      if (pollIds.length > 0) {
        const votesRes = await this.db.query(
          `SELECT poll_id, option_id FROM post_poll_votes WHERE user_id = $1 AND poll_id = ANY($2)`,
          [currentUserId, pollIds]
        )
        for (const row of votesRes.rows) {
          myVotesMap.set(row.poll_id, row.option_id)
        }
      }
    }

    for (const row of pollsRes.rows) {
      let poll = map.get(row.post_id)
      if (!poll) {
        poll = {
          id: row.poll_id,
          postId: row.post_id,
          question: row.question,
          totalVotes: row.total_votes || 0,
          options: [],
          myVotedOptionId: myVotesMap.get(row.poll_id) || null,
          expiresAt: row.expires_at ? new Date(row.expires_at).toISOString() : null
        }
        map.set(row.post_id, poll)
      }

      poll.options.push({
        id: row.option_id,
        pollId: row.poll_id,
        optionText: row.option_text,
        votesCount: row.votes_count || 0,
        displayOrder: row.display_order || 0
      })
    }

    return map
  }

  private mapRowToPostItem(row: any, poll?: PollData | null): PostItem {
    let postType: any = 'general'
    if (row.post_type === 'question' || row.post_type === 'qa') {
      postType = 'qa'
    } else if (row.post_type === 'resource_share' || row.post_type === 'document') {
      postType = 'document'
    } else if (row.post_type === 'pbl_recruitment' || row.post_type === 'group_recruit') {
      postType = 'group_recruit'
    } else if (row.post_type === 'review') {
      postType = 'review'
    } else {
      postType = 'general'
    }

    return {
      id: row.id,
      authorId: row.author_id,
      author: {
        id: row.author_user_id || row.author_id,
        username: row.author_username || 'user',
        displayName: row.author_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.author_avatar_url || null,
        role: row.author_role || 'student',
        faculty: row.author_faculty || null,
        reputationPoints: row.author_reputation_points || 100
      },
      title: row.title,
      content: row.content,
      postType,
      courseId: row.course_id,
      courseCode: row.course_code || null,
      courseName: row.course_name || null,
      facultyCode: row.faculty_code || row.author_faculty || null,
      targetAudience: 'everyone',
      isPinned: !!row.is_pinned,
      isResolved: row.is_resolved || false,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: row.is_liked_by_me || false,
      isBookmarkedByMe: row.is_bookmarked_by_me || false,
      isAuthorFollowedByMe: !!row.is_author_followed_by_me,
      poll: poll || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }
  }
}
