import { Resolver, Query, Mutation, Args, ID, Context } from '@nestjs/graphql'
import { assertNotRestricted } from '../../../common/guards/not-restricted.guard'
import { CommentType } from '../types/comment.type'
import { CreateCommentInput } from '../dto/create-comment.input'
import { DatabaseService } from '../../../database/database.service'
import { setTrashActor } from '../../../database/trash'
import { UnauthorizedException, NotFoundException } from '@nestjs/common'
import { fieldNameSql } from '../../units/unit-sql'

@Resolver(() => CommentType)
export class CommentResolver {
  constructor(private readonly db: DatabaseService) {}

  @Query(() => [CommentType], { name: 'comments' })
  async getComments(@Args('postId', { type: () => ID }) postId: string, @Context() _context?: any): Promise<CommentType[]> {
    const sql = `
      SELECT c.*,
             u.id as author_id, u.email as author_email, u.username as author_username,
             u.display_name as author_display_name, u.avatar_url as author_avatar_url,
             u.role as author_role, ${fieldNameSql('u')} as author_interest_field, u.reputation_points as author_reputation_points,
             u.created_at as author_created_at
      FROM comments c
      JOIN users u ON c.author_id = u.id
      WHERE c.post_id = $1 AND NOT c.is_anonymous AND c.hidden_at IS NULL
      ORDER BY c.created_at ASC
    `
    const res = await this.db.query(sql, [postId])

    return res.rows.map((row) => ({
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      parentId: row.parent_id || null,
      content: row.content,
      likesCount: row.likes_count || 0,
      isSolution: !!row.is_solution,
      isLikedByMe: false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      author: {
        id: row.author_id,
        email: row.author_email || '',
        username: row.author_username || '',
        displayName: row.author_display_name || 'Sinh viên Phenikaa',
        avatarUrl: row.author_avatar_url || null,
        role: row.author_role || 'student',
        interestField: row.author_interest_field || null,
        reputationPoints: row.author_reputation_points || 100,
        createdAt: row.author_created_at ? new Date(row.author_created_at).toISOString() : ''
      }
    }))
  }

  @Mutation(() => CommentType)
  async createComment(@Args('input') input: CreateCommentInput, @Context() context: any): Promise<CommentType> {
    const user = context?.req?.user
    assertNotRestricted(user)
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập để bình luận')
    }

    const insertRes = await this.db.query(
      `INSERT INTO comments (post_id, author_id, parent_id, content)
       VALUES ($1, $2, $3, $4)
       RETURNING *`,
      [input.postId, user.id, input.parentId || null, input.content]
    )

    // Increment post comments count
    await this.db.query(`UPDATE posts SET comments_count = comments_count + 1 WHERE id = $1`, [input.postId])

    const row = insertRes.rows[0]

    return {
      id: row.id,
      postId: row.post_id,
      authorId: row.author_id,
      parentId: row.parent_id || null,
      content: row.content,
      likesCount: 0,
      isSolution: false,
      isLikedByMe: false,
      createdAt: row.created_at ? new Date(row.created_at).toISOString() : new Date().toISOString(),
      author: user
    }
  }

  @Mutation(() => Boolean)
  async deleteComment(@Args('id', { type: () => ID }) id: string, @Context() context: any): Promise<boolean> {
    const user = context?.req?.user
    if (!user) {
      throw new UnauthorizedException('Vui lòng đăng nhập')
    }

    const commentRes = await this.db.query(`SELECT post_id, author_id FROM comments WHERE id = $1`, [id])

    if (commentRes.rows.length === 0) {
      throw new NotFoundException('Không tìm thấy bình luận')
    }

    const comment = commentRes.rows[0]
    if (comment.author_id !== user.id && user.role !== 'admin') {
      throw new UnauthorizedException('Bạn không có quyền xóa bình luận này')
    }

    await this.db.transaction(async (client) => {
      await setTrashActor(client, user.id)
      await client.query(`DELETE FROM comments WHERE id = $1`, [id])
      await client.query(`UPDATE posts SET comments_count = GREATEST(0, comments_count - 1) WHERE id = $1`, [comment.post_id])
    })

    return true
  }
}
