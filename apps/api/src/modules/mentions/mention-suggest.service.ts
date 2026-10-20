import { Injectable } from '@nestjs/common'
import type { MentionCandidate } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { blockExistsSql } from '../blocks/blocks.sql'

export const MENTION_SUGGEST_LIMIT = 8

// Chuẩn hoá từ khoá: bỏ @, cắt 30 ký tự, escape ký tự đặc biệt của LIKE
export function normalizeMentionQuery(raw: unknown): string {
  const q = typeof raw === 'string' ? raw.replace(/^@/, '').trim().toLowerCase().slice(0, 30) : ''
  return q.replace(/[\\%_]/g, '\\$&')
}

@Injectable()
export class MentionSuggestService {
  constructor(private readonly db: DatabaseService) {}

  // Gợi ý @mention: người trong bài > đang theo dõi > khác (bot do client ghim riêng)
  // Rank: username prefix > word prefix > post context > following
  async suggest(viewerId: string, q: string, postId: string | null): Promise<MentionCandidate[]> {
    // Chưa gõ chữ ⇒ chỉ gợi ý người quen (tránh quét toàn bảng users)
    const match = q ? `c.hay LIKE '%' || immutable_unaccent($2) || '%'` : `(c.ctx_w > 0 OR c.is_following)`
    const res = await this.db.query(
      `WITH ctx AS (
         SELECT p.author_id AS id, 2 AS w FROM posts p WHERE p.id = $3::uuid AND NOT p.is_anonymous
         UNION ALL
         SELECT cm.author_id, 1 FROM comments cm WHERE cm.post_id = $3::uuid AND NOT cm.is_anonymous
       ), ctx_best AS (
         SELECT id, MAX(w) AS w FROM ctx GROUP BY id
       ), c AS (
         SELECT u.id, u.username, u.display_name, u.avatar_url, u.is_verified,
                COALESCE(cb.w, 0) AS ctx_w, f.following_id IS NOT NULL AS is_following,
                immutable_unaccent(lower(u.display_name || ' ' || u.username)) AS hay
         FROM users u
         LEFT JOIN ctx_best cb ON cb.id = u.id
         LEFT JOIN user_follows f ON f.follower_id = $1 AND f.following_id = u.id
         WHERE u.status = 'active' AND u.account_type = 'human' AND u.id <> $1
           AND NOT ${blockExistsSql('$1::uuid', 'u.id')}
       )
       SELECT c.id, c.username, c.display_name, c.avatar_url, c.is_verified, c.ctx_w, c.is_following
       FROM c
       WHERE ${match}
       ORDER BY (lower(c.username) LIKE $2 || '%') DESC,
                (' ' || c.hay LIKE '% ' || immutable_unaccent($2) || '%') DESC,
                c.ctx_w DESC, c.is_following DESC, c.username ASC
       LIMIT $4`,
      [viewerId, q, postId, MENTION_SUGGEST_LIMIT]
    )
    return res.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatarUrl: r.avatar_url,
      isVerified: !!r.is_verified,
      reason: r.ctx_w === 2 ? 'author' : r.ctx_w === 1 ? 'participant' : r.is_following ? 'following' : 'other'
    }))
  }
}
