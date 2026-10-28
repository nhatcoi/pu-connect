import { Injectable, NotFoundException, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { blockExistsSql } from '../blocks/blocks.sql'
import type { Community, CommunityRule } from '@pu/schemas'
import { postListedSql } from '../posts/post-access.sql'
import { fieldNameSql } from '../units/unit-sql'

export interface CommunityPostsResult {
  community: Community
  posts: any[]
  total: number
  hasMore: boolean
  nextOffset: number
}

@Injectable()
export class CommunitiesService {
  private readonly logger = new Logger(CommunitiesService.name)

  constructor(private readonly db: DatabaseService) {}

  /**
   * Danh sách tất cả cộng đồng / diễn đàn
   */
  async findAll(type?: string, search?: string, currentUserId?: string): Promise<Community[]> {
    let sql = `
      SELECT c.*
    `
    const params: any[] = []

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1) as is_member,
               (SELECT role FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $1 LIMIT 1) as user_role`
    } else {
      sql += `, FALSE as is_member, NULL as user_role`
    }

    sql += ` FROM communities c WHERE 1=1`

    if (type && type !== 'all') {
      params.push(type)
      sql += ` AND c.community_type = $${params.length}`
    }

    if (search && search.trim()) {
      params.push(`%${search.trim().toLowerCase()}%`)
      sql += ` AND (LOWER(c.name) ILIKE $${params.length} OR LOWER(c.slug) ILIKE $${params.length} OR LOWER(c.description) ILIKE $${params.length})`
    }

    sql += ` ORDER BY c.members_count DESC, c.posts_count DESC`

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => this.mapRowToCommunity(row))
  }

  /**
   * Lấy chi tiết cộng đồng theo slug
   */
  async findBySlug(slug: string, currentUserId?: string): Promise<Community> {
    let sql = `
      SELECT c.*
    `
    const params: any[] = [slug.toLowerCase().trim()]

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $2) as is_member,
               (SELECT role FROM community_members cm WHERE cm.community_id = c.id AND cm.user_id = $2 LIMIT 1) as user_role`
    } else {
      sql += `, FALSE as is_member, NULL as user_role`
    }

    sql += ` FROM communities c WHERE c.slug = $1 LIMIT 1`

    const res = await this.db.query(sql, params)
    if (res.rows.length === 0) {
      throw new NotFoundException(`Không tìm thấy cộng đồng c/${slug}`)
    }

    return this.mapRowToCommunity(res.rows[0])
  }

  /**
   * Tham gia / Hủy tham gia cộng đồng (ACID Transaction)
   */
  async toggleJoin(slug: string, userId: string): Promise<{ isMember: boolean; membersCount: number; message: string }> {
    return this.db.transaction(async (client) => {
      // 1. Check community existence with lock
      const commRes = await client.query(`SELECT id, name, members_count FROM communities WHERE slug = $1 LIMIT 1 FOR UPDATE`, [slug.toLowerCase().trim()])

      if (commRes.rows.length === 0) {
        throw new NotFoundException(`Không tìm thấy cộng đồng c/${slug}`)
      }

      const community = commRes.rows[0]

      // 2. Check if already member
      const memberRes = await client.query(`SELECT 1 FROM community_members WHERE community_id = $1 AND user_id = $2 LIMIT 1`, [community.id, userId])

      const isCurrentlyMember = memberRes.rows.length > 0

      if (isCurrentlyMember) {
        // Leave community
        await client.query(`DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`, [community.id, userId])
        const updatedRes = await client.query(
          `UPDATE communities SET members_count = GREATEST(0, members_count - 1), updated_at = NOW() WHERE id = $1 RETURNING members_count`,
          [community.id]
        )
        const newCount = updatedRes.rows[0]?.members_count || 0
        this.logger.log(`User ${userId} left community c/${slug}`)
        return {
          isMember: false,
          membersCount: newCount,
          message: `Đã rời khỏi cộng đồng ${community.name}`
        }
      } else {
        // Join community
        await client.query(`INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'member')`, [community.id, userId])
        const updatedRes = await client.query(
          `UPDATE communities SET members_count = members_count + 1, updated_at = NOW() WHERE id = $1 RETURNING members_count`,
          [community.id]
        )
        const newCount = updatedRes.rows[0]?.members_count || 1
        this.logger.log(`User ${userId} joined community c/${slug}`)
        return {
          isMember: true,
          membersCount: newCount,
          message: `Đã gia nhập cộng đồng ${community.name}`
        }
      }
    })
  }

  /**
   * Lấy bài viết trong cộng đồng kèm phân trang & sắp xếp
   */
  async getCommunityPosts(slug: string, currentUserId?: string, limit = 10, offset = 0, sort: 'hot' | 'new' | 'top' = 'hot'): Promise<CommunityPostsResult> {
    const community = await this.findBySlug(slug, currentUserId)
    const safeLimit = Math.min(50, Math.max(1, limit))
    const safeOffset = Math.max(0, offset)

    // 1. Get total count of posts in this community
    const countRes = await this.db.query(
      `SELECT COUNT(*) as total FROM posts p
       WHERE p.community_id = $1 AND p.hidden_at IS NULL AND ${postListedSql('$2::uuid')}
         AND ($2::uuid IS NULL OR NOT ${blockExistsSql('$2::uuid', 'p.author_id')})`,
      [community.id, currentUserId ?? null]
    )
    const total = parseInt(countRes.rows[0]?.total || '0', 10)

    // 2. Query posts
    let orderBy = `p.created_at DESC`
    if (sort === 'hot') {
      orderBy = `(p.likes_count * 2.0 + p.comments_count * 5.0 - (EXTRACT(EPOCH FROM (NOW() - p.created_at)) / 86400.0 * 2.0)) DESC, p.created_at DESC`
    } else if (sort === 'top') {
      orderBy = `(p.likes_count + p.comments_count) DESC, p.created_at DESC`
    }

    const params: any[] = [community.id]
    let sql = `
      SELECT p.*,
             u.id as author_user_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, ${fieldNameSql('u')} as author_interest_field, u.reputation_points as author_reputation_points,
             c.code as course_code, c.name as course_name,
             comm.slug as community_slug, comm.name as community_name
    `

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $2) as is_liked_by_me,
               EXISTS(SELECT 1 FROM saved_posts sp WHERE sp.post_id = p.id AND sp.user_id = $2) as is_bookmarked_by_me,
               EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = $2 AND uf.following_id = p.author_id) as is_author_followed_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me, FALSE as is_bookmarked_by_me, FALSE as is_author_followed_by_me`
    }

    sql += `
      FROM posts p
      JOIN users u ON p.author_id = u.id
      LEFT JOIN courses c ON p.course_id = c.id
      LEFT JOIN communities comm ON p.community_id = comm.id
      WHERE p.community_id = $1 AND p.hidden_at IS NULL AND ${postListedSql(currentUserId ? '$2' : undefined)}
    `
    if (currentUserId) sql += ` AND NOT ${blockExistsSql('$2', 'p.author_id')}`

    params.push(safeLimit, safeOffset)
    sql += ` ORDER BY ${orderBy} LIMIT $${params.length - 1} OFFSET $${params.length}`

    const res = await this.db.query(sql, params)

    const items = res.rows.map((row) => ({
      id: row.id,
      authorId: row.author_user_id,
      author: {
        id: row.author_user_id,
        username: row.author_username,
        displayName: row.author_display_name,
        avatarUrl: row.author_avatar_url,
        role: row.author_role,
        interestField: row.author_interest_field,
        reputationPoints: row.author_reputation_points
      },
      title: row.title,
      content: row.content,
      postType: row.post_type || 'general',
      courseId: row.course_id,
      courseCode: row.course_code,
      courseName: row.course_name,
      communityId: row.community_id,
      communitySlug: row.community_slug || community.slug,
      communityName: row.community_name || community.name,
      targetAudience: row.visibility === 'public' ? 'everyone' : 'followers',
      isPinned: !!row.is_pinned,
      isResolved: !!row.is_resolved,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: !!row.is_liked_by_me,
      isBookmarkedByMe: !!row.is_bookmarked_by_me,
      isAuthorFollowedByMe: !!row.is_author_followed_by_me,
      poll: null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : new Date().toISOString()
    }))

    return {
      community,
      posts: items,
      total,
      hasMore: safeOffset + items.length < total,
      nextOffset: safeOffset + items.length
    }
  }

  private mapRowToCommunity(row: any): Community {
    let parsedRules: CommunityRule[] = []
    if (Array.isArray(row.rules)) {
      parsedRules = row.rules
    } else if (typeof row.rules === 'string') {
      try {
        parsedRules = JSON.parse(row.rules)
      } catch {
        parsedRules = []
      }
    }

    return {
      id: row.id,
      slug: row.slug,
      name: row.name,
      description: row.description,
      communityType: row.community_type || 'academic',
      avatarUrl: row.avatar_url || null,
      bannerUrl: row.banner_url || null,
      rules: parsedRules,
      membersCount: parseInt(row.members_count || '0', 10),
      postsCount: parseInt(row.posts_count || '0', 10),
      isMember: !!row.is_member,
      userRole: row.user_role || null,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      updatedAt: row.updated_at ? new Date(row.updated_at).toISOString() : undefined
    }
  }
}
