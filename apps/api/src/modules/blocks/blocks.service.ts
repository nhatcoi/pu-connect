import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type { BlockState, BlockedUser } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { RealtimeGateway } from '../realtime/realtime.gateway'
import { blockStateSql } from './blocks.sql'

// Chặn người dùng: chính sách 2 chiều, các module khác lọc bằng blockExistsSql
// User blocking; other modules enforce it via blockExistsSql in their own queries
@Injectable()
export class BlocksService {
  constructor(
    private readonly db: DatabaseService,
    private readonly realtime: RealtimeGateway
  ) {}

  // ACID: thêm chặn + hủy theo dõi 2 chiều
  async block(userId: string, targetId: string): Promise<void> {
    if (userId === targetId) throw new BadRequestException('Không thể tự chặn chính mình')
    const target = await this.db.query(`SELECT account_type FROM users WHERE id = $1`, [targetId])
    if (!target.rows[0]) throw new NotFoundException('Người dùng không tồn tại')
    if (target.rows[0].account_type !== 'human') throw new BadRequestException('Không thể chặn tài khoản này')

    await this.db.transaction(async (client) => {
      await client.query(`INSERT INTO user_blocks (blocker_id, blocked_id) VALUES ($1, $2) ON CONFLICT DO NOTHING`, [userId, targetId])
      await client.query(
        `DELETE FROM user_follows WHERE (follower_id = $1 AND following_id = $2) OR (follower_id = $2 AND following_id = $1)`,
        [userId, targetId]
      )
    })
    this.notifyChanged(userId, targetId)
  }

  async unblock(userId: string, targetId: string): Promise<void> {
    const res = await this.db.query(`DELETE FROM user_blocks WHERE blocker_id = $1 AND blocked_id = $2`, [userId, targetId])
    if (res.rowCount) this.notifyChanged(userId, targetId)
  }

  async list(userId: string): Promise<BlockedUser[]> {
    const res = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.avatar_url, b.created_at
       FROM user_blocks b JOIN users u ON u.id = b.blocked_id
       WHERE b.blocker_id = $1
       ORDER BY b.created_at DESC`,
      [userId]
    )
    return res.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name,
      avatarUrl: r.avatar_url,
      blockedAt: new Date(r.created_at).toISOString()
    }))
  }

  async state(viewerId: string, otherId: string): Promise<BlockState> {
    if (viewerId === otherId) return 'none'
    const res = await this.db.query(`SELECT ${blockStateSql('$1::uuid', '$2::uuid')} AS state`, [viewerId, otherId])
    return res.rows[0]?.state ?? 'none'
  }

  // Báo cả 2 phía làm mới hồ sơ / hội thoại (khung nhắn tin khóa/mở ngay)
  private notifyChanged(userId: string, targetId: string) {
    this.realtime.emitToUser(userId, 'block.changed', { userId: targetId })
    this.realtime.emitToUser(targetId, 'block.changed', { userId })
  }
}
