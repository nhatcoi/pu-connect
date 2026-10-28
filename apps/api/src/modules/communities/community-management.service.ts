import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common'
import type { Community, CommunityHiddenPost, CommunityMemberItem, CommunityRole } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { NotificationsService } from '../notifications/notifications.service'
import { CommunitiesService } from './communities.service'
import {
  COMMUNITY_MAX_OWNED,
  COMMUNITY_MIN_ACCOUNT_DAYS,
  COMMUNITY_MIN_POSTS,
  type CreateCommunityBody,
  type MembersQuery,
  type UpdateCommunityBody
} from './communities.dto'

type Actor = { id: string; name: string; status: string; role: CommunityRole | null }

// Tạo cộng đồng và quản trị: chủ sở hữu (owner) + điều hành viên (moderator)
@Injectable()
export class CommunityManagementService {
  constructor(
    private readonly db: DatabaseService,
    private readonly communities: CommunitiesService,
    private readonly notifications: NotificationsService
  ) {}

  // Tích xanh, hoặc email đã xác thực + tài khoản đủ lâu + đủ bài viết mới được lập; cộng đồng mới ở trạng thái chờ admin duyệt
  async create(userId: string, body: CreateCommunityBody): Promise<Community> {
    await this.db.transaction(async (client) => {
      const u = await client.query(
        `SELECT is_verified, email_verified, status, account_type,
                created_at <= NOW() - make_interval(days => $2) AS old_enough,
                (SELECT COUNT(*)::int FROM posts WHERE author_id = $1 AND hidden_at IS NULL) AS posts
           FROM users WHERE id = $1`,
        [userId, COMMUNITY_MIN_ACCOUNT_DAYS]
      )
      const user = u.rows[0]
      if (!user || user.status !== 'active' || user.account_type !== 'human') throw new ForbiddenException('Tài khoản không đủ điều kiện tạo cộng đồng')
      if (!user.is_verified && !(user.email_verified && user.old_enough && user.posts >= COMMUNITY_MIN_POSTS)) {
        throw new ForbiddenException(
          `Cần tài khoản có tích xanh, hoặc email đã xác thực, tham gia từ ${COMMUNITY_MIN_ACCOUNT_DAYS} ngày và có ít nhất ${COMMUNITY_MIN_POSTS} bài viết để tạo cộng đồng`
        )
      }
      // Khóa theo người dùng để hai yêu cầu song song không vượt hạn mức
      await client.query(`SELECT 1 FROM users WHERE id = $1 FOR UPDATE`, [userId])
      const owned = await client.query(`SELECT COUNT(*)::int AS n FROM communities WHERE created_by = $1 AND status IN ('active', 'pending')`, [userId])
      if (owned.rows[0].n >= COMMUNITY_MAX_OWNED) throw new BadRequestException(`Mỗi người tạo tối đa ${COMMUNITY_MAX_OWNED} cộng đồng`)
      if ((await client.query(`SELECT 1 FROM communities WHERE slug = $1`, [body.slug])).rows[0])
        throw new ConflictException('Đường dẫn c/' + body.slug + ' đã được dùng')

      const ins = await client.query(
        `INSERT INTO communities (slug, name, description, community_type, rules, members_count, status, created_by)
         VALUES ($1, $2, $3, $4, $5::jsonb, 1, 'pending', $6) RETURNING id`,
        [body.slug, body.name, body.description, body.communityType, JSON.stringify(body.rules ?? []), userId]
      )
      await client.query(`INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'owner')`, [ins.rows[0].id, userId])
    })
    return this.communities.findBySlug(body.slug, userId)
  }

  async update(slug: string, userId: string, body: UpdateCommunityBody): Promise<Community> {
    const sets: string[] = []
    const params: unknown[] = []
    const set = (col: string, value: unknown, cast = '') => {
      params.push(value)
      sets.push(`${col} = $${params.length}${cast}`)
    }
    if (body.description !== undefined) set('description', body.description)
    if (body.rules !== undefined) set('rules', JSON.stringify(body.rules), '::jsonb')
    if (body.avatarUrl !== undefined) set('avatar_url', body.avatarUrl)
    if (body.bannerUrl !== undefined) set('banner_url', body.bannerUrl)
    if (sets.length === 0) throw new BadRequestException('Không có thay đổi nào')

    const actor = await this.requireManager(slug, userId)
    params.push(actor.id)
    await this.db.query(`UPDATE communities SET ${sets.join(', ')}, updated_at = NOW() WHERE id = $${params.length}`, params)
    return this.communities.findBySlug(slug, userId)
  }

  async members(slug: string, userId: string, q: MembersQuery): Promise<{ items: CommunityMemberItem[]; total: number }> {
    const actor = await this.requireManager(slug, userId)
    const term = q.q ? `%${q.q}%` : null
    const where = `m.community_id = $1 AND ($2::text IS NULL OR u.username ILIKE $2 OR u.display_name ILIKE $2)`
    const [rows, total] = await Promise.all([
      this.db.query(
        `SELECT u.id, u.username, u.display_name, u.avatar_url, m.role, m.joined_at
           FROM community_members m JOIN users u ON u.id = m.user_id WHERE ${where}
          ORDER BY (m.role = 'owner') DESC, (m.role = 'moderator') DESC, m.joined_at DESC LIMIT $3 OFFSET $4`,
        [actor.id, term, q.limit, q.offset]
      ),
      this.db.query(`SELECT COUNT(*)::int AS n FROM community_members m JOIN users u ON u.id = m.user_id WHERE ${where}`, [actor.id, term])
    ])
    return {
      total: total.rows[0].n,
      items: rows.rows.map((r) => ({
        userId: r.id,
        username: r.username,
        displayName: r.display_name,
        avatarUrl: r.avatar_url,
        role: r.role as CommunityRole,
        joinedAt: new Date(r.joined_at).toISOString()
      }))
    }
  }

  // Chỉ chủ sở hữu đặt / gỡ điều hành viên
  async setRole(slug: string, userId: string, targetId: string, role: 'moderator' | 'member'): Promise<{ role: CommunityRole }> {
    const actor = await this.requireManager(slug, userId, true)
    if (targetId === userId) throw new BadRequestException('Không thể đổi vai trò của chính mình')
    const res = await this.db.query(`UPDATE community_members SET role = $3 WHERE community_id = $1 AND user_id = $2 AND role <> 'owner' RETURNING role`, [
      actor.id,
      targetId,
      role
    ])
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy thành viên hợp lệ')
    return { role: res.rows[0].role }
  }

  // Chủ xóa được điều hành viên và thành viên; điều hành viên chỉ xóa được thành viên thường
  async removeMember(slug: string, userId: string, targetId: string): Promise<{ membersCount: number }> {
    const actor = await this.requireManager(slug, userId)
    if (targetId === userId) throw new BadRequestException('Dùng nút Rời cộng đồng để tự rời')
    return this.db.transaction(async (client) => {
      await client.query(`SELECT 1 FROM communities WHERE id = $1 FOR UPDATE`, [actor.id])
      const t = await client.query(`SELECT role FROM community_members WHERE community_id = $1 AND user_id = $2`, [actor.id, targetId])
      const targetRole = t.rows[0]?.role as CommunityRole | undefined
      if (!targetRole) throw new NotFoundException('Không tìm thấy thành viên')
      if (targetRole === 'owner') throw new ForbiddenException('Không thể xóa chủ cộng đồng')
      if (targetRole === 'moderator' && actor.role !== 'owner') throw new ForbiddenException('Chỉ chủ cộng đồng xóa được điều hành viên')
      await client.query(`DELETE FROM community_members WHERE community_id = $1 AND user_id = $2`, [actor.id, targetId])
      const up = await client.query(
        `UPDATE communities SET members_count = GREATEST(0, members_count - 1), updated_at = NOW() WHERE id = $1 RETURNING members_count`,
        [actor.id]
      )
      return { membersCount: up.rows[0].members_count as number }
    })
  }

  // Ẩn bài vi phạm trong cộng đồng (hidden_by = người điều hành, để khôi phục được)
  async hidePost(slug: string, userId: string, postId: string, reason?: string): Promise<{ hidden: true }> {
    const actor = await this.requireManager(slug, userId)
    const res = await this.db.query(
      `UPDATE posts SET hidden_at = NOW(), hidden_by = $3, hidden_reason = $4
        WHERE id = $1 AND community_id = $2 AND hidden_at IS NULL RETURNING author_id`,
      [postId, actor.id, userId, reason || null]
    )
    if (!res.rows[0]) throw new NotFoundException('Không tìm thấy bài viết trong cộng đồng này')
    if (res.rows[0].author_id !== userId) {
      await this.notifications.notify({
        type: 'account_notice',
        recipientId: res.rows[0].author_id,
        actorId: null,
        verb: `Bài viết của bạn trong ${actor.name} đã bị ẩn`,
        message: reason ? `Lý do: ${reason}` : 'Bài viết vi phạm quy tắc của cộng đồng.'
      })
    }
    return { hidden: true }
  }

  // Chỉ khôi phục được bài do người điều hành cộng đồng ẩn (bài admin ẩn thì không)
  async unhidePost(slug: string, userId: string, postId: string): Promise<{ hidden: false }> {
    const actor = await this.requireManager(slug, userId)
    const res = await this.db.query(
      `UPDATE posts SET hidden_at = NULL, hidden_by = NULL, hidden_reason = NULL
        WHERE id = $1 AND community_id = $2 AND hidden_at IS NOT NULL
          AND hidden_by IN (SELECT user_id FROM community_members WHERE community_id = $2 AND role IN ('owner', 'moderator')) RETURNING id`,
      [postId, actor.id]
    )
    if (!res.rows[0]) throw new NotFoundException('Bài viết không có hoặc do quản trị viên hệ thống ẩn')
    return { hidden: false }
  }

  async hiddenPosts(slug: string, userId: string): Promise<CommunityHiddenPost[]> {
    const actor = await this.requireManager(slug, userId)
    const res = await this.db.query(
      `SELECT p.id, p.title, LEFT(p.content, 200) AS excerpt, u.display_name, p.hidden_at, p.hidden_reason
         FROM posts p JOIN users u ON u.id = p.author_id
        WHERE p.community_id = $1 AND p.hidden_at IS NOT NULL
          AND p.hidden_by IN (SELECT user_id FROM community_members WHERE community_id = $1 AND role IN ('owner', 'moderator'))
        ORDER BY p.hidden_at DESC LIMIT 50`,
      [actor.id]
    )
    return res.rows.map((r) => ({
      id: r.id,
      title: r.title,
      excerpt: r.excerpt ?? '',
      authorName: r.display_name,
      hiddenAt: new Date(r.hidden_at).toISOString(),
      hiddenReason: r.hidden_reason
    }))
  }

  // Xác định cộng đồng + vai trò người gọi; thiếu quyền ⇒ 403 (cộng đồng không tồn tại ⇒ 404)
  private async requireManager(slug: string, userId: string, ownerOnly = false): Promise<Actor> {
    const res = await this.db.query(
      `SELECT c.id, c.name, c.status, m.role FROM communities c
         LEFT JOIN community_members m ON m.community_id = c.id AND m.user_id = $2
        WHERE c.slug = $1`,
      [slug.toLowerCase().trim(), userId]
    )
    const row = res.rows[0]
    if (!row) throw new NotFoundException(`Không tìm thấy cộng đồng c/${slug}`)
    const role = (row.role ?? null) as CommunityRole | null
    const allowed = ownerOnly ? role === 'owner' : role === 'owner' || role === 'moderator'
    if (!allowed)
      throw new ForbiddenException(ownerOnly ? 'Chỉ chủ cộng đồng được thực hiện thao tác này' : 'Chỉ chủ hoặc điều hành viên được thực hiện thao tác này')
    return { id: row.id, name: row.name, status: row.status, role }
  }
}
