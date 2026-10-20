import { Resolver, Query, Mutation, Args, Int, Context } from '@nestjs/graphql'
import { assertNotRestricted } from '../../../common/guards/not-restricted.guard'
import { PostType } from '../types/post.type'
import { CreatePostInput } from '../dto/create-post.input'
import { DatabaseService } from '../../../database/database.service'
import { UnauthorizedException } from '@nestjs/common'
import { hotScoreSql } from '../../posts/feed-ranking.sql'

@Resolver(() => PostType)
export class FeedResolver {
  constructor(private readonly db: DatabaseService) {}

  @Query(() => [PostType], { name: 'feed' })
  async getFeed(
    @Args('limit', { type: () => Int, defaultValue: 20 }) limit: number,
    @Args('offset', { type: () => Int, defaultValue: 0 }) offset: number,
    @Args('tag', { type: () => String, nullable: true }) tag?: string,
    @Context() context?: any
  ): Promise<PostType[]> {
    const currentUserId = context?.req?.user?.id || null

    let sql = `
      SELECT p.*,
             u.id as author_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             u.created_at as author_created_at
    `
    const params: any[] = []

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $1) as is_liked_by_me`
      sql += `, ${hotScoreSql('NOW()', '$1')} as recommendation_score`
    } else {
      sql += `, FALSE as is_liked_by_me`
      sql += `, ${hotScoreSql('NOW()')} as recommendation_score`
    }

    sql += ` FROM posts p JOIN users u ON p.author_id = u.id`

    if (currentUserId) {
      sql += ` LEFT JOIN users cu ON cu.id = $1`
    }

    // Bài ẩn danh không đi qua GraphQL (resolver này trả tác giả thật)
    sql += ` WHERE p.hidden_at IS NULL AND NOT p.is_anonymous`
    if (tag) {
      params.push(tag)
      sql += ` AND $${params.length} = ANY(p.tags)`
    }

    params.push(limit, offset)
    sql += ` ORDER BY recommendation_score DESC, p.created_at DESC LIMIT $${params.length - 1} OFFSET $${params.length}`

    const res = await this.db.query(sql, params)
    return res.rows.map((row) => this.mapRowToPost(row))
  }

  @Query(() => PostType, { name: 'post', nullable: true })
  async getPost(@Args('id', { type: () => String }) id: string, @Context() context?: any): Promise<PostType | null> {
    const currentUserId = context?.req?.user?.id || null

    let sql = `
      SELECT p.*,
             u.id as author_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, u.faculty as author_faculty, u.reputation_points as author_reputation_points,
             u.created_at as author_created_at
    `
    const params: any[] = [id]

    if (currentUserId) {
      params.push(currentUserId)
      sql += `, EXISTS(SELECT 1 FROM post_reactions pr WHERE pr.post_id = p.id AND pr.user_id = $2) as is_liked_by_me`
    } else {
      sql += `, FALSE as is_liked_by_me`
    }

    sql += ` FROM posts p JOIN users u ON p.author_id = u.id WHERE p.id = $1 AND p.hidden_at IS NULL AND NOT p.is_anonymous LIMIT 1`

    const res = await this.db.query(sql, params)
    if (res.rows.length === 0) return null
    return this.mapRowToPost(res.rows[0])
  }

  @Mutation(() => PostType)
  async createPost(@Args('input') input: CreatePostInput, @Context() context: any): Promise<PostType> {
    const user = context?.req?.user
    assertNotRestricted(user)
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập để đăng bài viết')
    }

    const insertRes = await this.db.query(
      `INSERT INTO posts (
        author_id, course_id, post_type, title, content, tags, media_urls, attached_document_ids
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [
        user.id,
        input.courseId || null,
        input.postType || 'general',
        input.title,
        input.content,
        input.tags || [],
        input.mediaUrls || [],
        input.attachedDocumentIds || []
      ]
    )

    const postRow = insertRes.rows[0]
    return {
      ...this.mapRowToPost(postRow),
      author: user,
      isLikedByMe: false
    }
  }

  @Mutation(() => Boolean)
  async toggleLikePost(@Args('postId') postId: string, @Context() context: any): Promise<boolean> {
    const user = context?.req?.user
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập để tương tác bài viết')
    }

    const check = await this.db.query(`SELECT 1 FROM post_reactions WHERE post_id = $1 AND user_id = $2 LIMIT 1`, [postId, user.id])

    if (check.rows.length > 0) {
      await this.db.query(`DELETE FROM post_reactions WHERE post_id = $1 AND user_id = $2`, [postId, user.id])
      await this.db.query(`UPDATE posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1`, [postId])
      return false
    } else {
      await this.db.query(`INSERT INTO post_reactions (post_id, user_id, reaction) VALUES ($1, $2, 'like')`, [postId, user.id])
      await this.db.query(`UPDATE posts SET likes_count = likes_count + 1 WHERE id = $1`, [postId])
      return true
    }
  }

  private mapRowToPost(row: any): PostType {
    return {
      id: row.id,
      authorId: row.author_id,
      courseId: row.course_id,
      postType: row.post_type || 'general',
      title: row.title,
      slug: row.slug,
      content: row.content,
      tags: row.tags || [],
      mediaUrls: row.media_urls || [],
      attachedDocumentIds: row.attached_document_ids || [],
      visibility: row.visibility || 'public',
      isPinned: !!row.is_pinned,
      isResolved: !!row.is_resolved,
      likesCount: row.likes_count || 0,
      commentsCount: row.comments_count || 0,
      sharesCount: row.shares_count || 0,
      isLikedByMe: !!row.is_liked_by_me,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      author: {
        id: row.author_id,
        email: row.author_email || '',
        username: row.author_username || '',
        displayName: row.author_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.author_avatar_url || null,
        role: row.author_role || 'student',
        faculty: row.author_faculty || null,
        reputationPoints: row.author_reputation_points || 100,
        createdAt: row.author_created_at ? new Date(row.author_created_at).toISOString() : ''
      }
    }
  }
}
