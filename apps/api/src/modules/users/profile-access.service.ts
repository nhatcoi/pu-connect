import { Injectable, NotFoundException } from '@nestjs/common'
import type { PrivacySettings, ProfileActivityType } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { blockExistsSql } from '../blocks/blocks.sql'
import { ACTIVITY_PRIVACY_FLAG, ACTIVITY_TYPES, resolvePrivacySettings } from './dto/privacy.dto'

export interface ProfileAccess {
  ownerId: string
  isOwner: boolean
  privacy: PrivacySettings
  // Có quan hệ chặn 2 chiều ⇒ không thấy gì
  blocked: boolean
  // Hồ sơ riêng tư & người xem chưa theo dõi ⇒ ẩn bài, tài liệu, hoạt động
  locked: boolean
  // Tab hoạt động người xem được mở
  activityTabs: ProfileActivityType[]
}

// Quyền xem hồ sơ dùng chung cho REST + GraphQL (1 query)
// Single source of truth for profile visibility (owner / block / private / activity flags)
@Injectable()
export class ProfileAccessService {
  constructor(private readonly db: DatabaseService) {}

  async resolve(by: { id?: string; username?: string }, viewerId?: string | null): Promise<ProfileAccess> {
    const res = await this.db.query(
      `SELECT u.id, u.privacy_settings,
              ($2::uuid IS NOT NULL AND ${blockExistsSql('$2::uuid', 'u.id')}) AS blocked,
              ($2::uuid IS NOT NULL AND EXISTS (
                SELECT 1 FROM user_follows f WHERE f.follower_id = $2::uuid AND f.following_id = u.id
              )) AS is_follower
       FROM users u
       WHERE ${by.id ? 'u.id = $1::uuid' : 'u.username = lower(trim($1))'}
       LIMIT 1`,
      [by.id ?? by.username ?? '', viewerId ?? null]
    )
    const row = res.rows[0]
    if (!row) throw new NotFoundException('Không tìm thấy người dùng')

    const privacy = resolvePrivacySettings(row.privacy_settings)
    const isOwner = !!viewerId && viewerId === row.id
    const blocked = !isOwner && !!row.blocked
    const locked = !isOwner && privacy.isPrivateProfile && !row.is_follower
    const activityTabs =
      blocked || locked ? [] : ACTIVITY_TYPES.filter((t) => isOwner || privacy[ACTIVITY_PRIVACY_FLAG[t]])

    return { ownerId: row.id, isOwner, privacy, blocked, locked, activityTabs }
  }
}
