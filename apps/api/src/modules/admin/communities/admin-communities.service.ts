import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import type { PoolClient } from 'pg'
import { DatabaseService } from '../../../database/database.service'
import { NotificationsService } from '../../notifications/notifications.service'
import { writeAudit } from '../admin-audit'
import type { AdminCreateCommunityBody } from './admin-communities.dto'

// Admin: tạo / duyệt / từ chối / gỡ cộng đồng, chuyển quyền chủ sở hữu
@Injectable()
export class AdminCommunitiesService {
  constructor(
    private readonly db: DatabaseService,
    private readonly notifications: NotificationsService
  ) {}

  // Admin tạo ⇒ hoạt động ngay, không qua duyệt
  async create(adminId: string, body: AdminCreateCommunityBody): Promise<{ id: string }> {
    return this.db.transaction(async (client) => {
      if ((await client.query(`SELECT 1 FROM communities WHERE slug = $1`, [body.slug])).rows[0])
        throw new ConflictException(`Đường dẫn c/${body.slug} đã được dùng`)
      const ins = await client.query(
        `INSERT INTO communities (slug, name, description, community_type, status, created_by, reviewed_by, reviewed_at)
         VALUES ($1, $2, $3, $4, 'active', $5, $5, NOW()) RETURNING id`,
        [body.slug, body.name, body.description, body.communityType, adminId]
      )
      const id = ins.rows[0].id as string
      if (body.ownerUsername) await this.setOwner(client, id, body.ownerUsername)
      await writeAudit(client, adminId, {
        action: 'community.create',
        targetType: 'community',
        targetId: id,
        details: { slug: body.slug, owner: body.ownerUsername }
      })
      return { id }
    })
  }

  async approve(adminId: string, id: string): Promise<void> {
    const c = await this.review(adminId, id, 'active', null)
    await this.notifyOwner(id, `Cộng đồng "${c.name}" đã được duyệt`, 'Bạn có thể mời bạn bè tham gia và bắt đầu đăng bài.')
  }

  async reject(adminId: string, id: string, note?: string): Promise<void> {
    const c = await this.review(adminId, id, 'rejected', note ?? null)
    await this.notifyOwner(id, `Cộng đồng "${c.name}" chưa được duyệt`, note ? `Lý do: ${note}` : undefined)
  }

  async changeOwner(adminId: string, id: string, username: string): Promise<void> {
    await this.db.transaction(async (client) => {
      await this.setOwner(client, id, username)
      await writeAudit(client, adminId, { action: 'community.owner', targetType: 'community', targetId: id, details: { username } })
    })
  }

  // Gỡ cộng đồng: thành viên xóa theo; bài viết giữ lại (community_id về NULL)
  async remove(adminId: string, id: string): Promise<void> {
    const owner = await this.ownerId(id)
    const name = await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM communities WHERE id = $1 RETURNING name, slug, members_count`, [id])
      if (!res.rows[0]) throw new NotFoundException('Không tìm thấy cộng đồng')
      await writeAudit(client, adminId, { action: 'community.delete', targetType: 'community', targetId: id, details: res.rows[0] })
      return res.rows[0].name as string
    })
    if (owner)
      await this.notifications.notify({
        type: 'account_notice',
        recipientId: owner,
        actorId: null,
        verb: `Cộng đồng "${name}" đã bị gỡ`,
        message: 'Bài viết của bạn vẫn được giữ lại.'
      })
  }

  private async review(adminId: string, id: string, status: 'active' | 'rejected', note: string | null): Promise<{ name: string }> {
    return this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE communities SET status = $2, review_note = $3, reviewed_by = $4, reviewed_at = NOW(), updated_at = NOW()
          WHERE id = $1 AND status = 'pending' RETURNING name`,
        [id, status, note, adminId]
      )
      if (!res.rows[0]) throw new NotFoundException('Cộng đồng không tồn tại hoặc đã được xử lý')
      await writeAudit(client, adminId, {
        action: status === 'active' ? 'community.approve' : 'community.reject',
        targetType: 'community',
        targetId: id,
        details: { note }
      })
      return res.rows[0] as { name: string }
    })
  }

  // Đặt chủ sở hữu: chủ cũ xuống điều hành viên, người mới vào (nếu chưa là thành viên) với vai trò owner
  private async setOwner(client: PoolClient, communityId: string, username: string): Promise<void> {
    const u = await client.query(`SELECT id FROM users WHERE username = $1 AND account_type = 'human' AND status = 'active'`, [username])
    if (!u.rows[0]) throw new BadRequestException(`Không tìm thấy người dùng @${username}`)
    if (!(await client.query(`SELECT 1 FROM communities WHERE id = $1 FOR UPDATE`, [communityId])).rows[0])
      throw new NotFoundException('Không tìm thấy cộng đồng')
    await client.query(`UPDATE community_members SET role = 'moderator' WHERE community_id = $1 AND role = 'owner' AND user_id <> $2`, [
      communityId,
      u.rows[0].id
    ])
    const ins = await client.query(
      `INSERT INTO community_members (community_id, user_id, role) VALUES ($1, $2, 'owner')
       ON CONFLICT (community_id, user_id) DO UPDATE SET role = 'owner' RETURNING (xmax = 0) AS inserted`,
      [communityId, u.rows[0].id]
    )
    if (ins.rows[0].inserted) await client.query(`UPDATE communities SET members_count = members_count + 1 WHERE id = $1`, [communityId])
  }

  private async ownerId(id: string): Promise<string | null> {
    const res = await this.db.query(`SELECT user_id FROM community_members WHERE community_id = $1 AND role = 'owner'`, [id])
    return res.rows[0]?.user_id ?? null
  }

  private async notifyOwner(id: string, verb: string, message?: string): Promise<void> {
    const owner = await this.ownerId(id)
    if (owner) await this.notifications.notify({ type: 'account_notice', recipientId: owner, actorId: null, verb, message })
  }
}
