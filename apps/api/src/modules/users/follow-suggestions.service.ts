import { Injectable } from '@nestjs/common'
import type { FollowSuggestion, FollowSuggestionReason } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { blockExistsSql } from '../blocks/blocks.sql'

export const FOLLOW_SUGGESTION_MAX = 50

// Gợi ý theo dõi (Who to follow): chấm điểm theo quan hệ & điểm chung, 1 query
// Score: follows you 6 · mutual 3/người (≤5) · cùng lớp 4 · tag trùng 1.5/tag (≤3)
//        · cùng khoa 2 · cùng khóa 1 · có bài 30 ngày 1 · giảng viên cùng khoa 1
@Injectable()
export class FollowSuggestionsService {
  constructor(private readonly db: DatabaseService) {}

  async list(viewerId: string, limit: number): Promise<FollowSuggestion[]> {
    const res = await this.db.query(
      `WITH me AS (
         SELECT id, faculty, class_name, academic_year,
                COALESCE(interests, '{}') || COALESCE(skills, '{}') AS tags
         FROM users WHERE id = $1
       ), my_following AS (
         SELECT following_id AS id FROM user_follows WHERE follower_id = $1
       ), mutual AS (
         SELECT f.following_id AS id, COUNT(*)::int AS n,
                (array_agg(f.follower_id ORDER BY f.created_at DESC))[1:3] AS via
         FROM user_follows f JOIN my_following mf ON mf.id = f.follower_id
         GROUP BY f.following_id
       ), active AS (
         SELECT DISTINCT author_id AS id FROM posts WHERE created_at > NOW() - INTERVAL '30 days'
       ), scored AS (
         SELECT u.id, u.username, u.display_name, u.avatar_url, u.bio, u.role, u.faculty, u.class_name,
                COALESCE(u.is_verified, FALSE) AS is_verified, u.reputation_points,
                COALESCE(m.n, 0) AS mutual_count, m.via,
                EXISTS (SELECT 1 FROM user_follows x WHERE x.follower_id = u.id AND x.following_id = $1) AS follows_you,
                (u.class_name IS NOT NULL AND u.class_name = me.class_name) AS same_class,
                (u.faculty IS NOT NULL AND u.faculty = me.faculty) AS same_faculty,
                (u.academic_year IS NOT NULL AND u.academic_year = me.academic_year) AS same_year,
                ARRAY(
                  SELECT t FROM unnest(COALESCE(u.interests, '{}') || COALESCE(u.skills, '{}')) AS t
                  WHERE lower(t) IN (SELECT lower(x) FROM unnest(me.tags) AS x)
                  GROUP BY t LIMIT 3
                ) AS shared_tags,
                a.id IS NOT NULL AS is_active
         FROM users u
         CROSS JOIN me
         LEFT JOIN mutual m ON m.id = u.id
         LEFT JOIN active a ON a.id = u.id
         WHERE u.account_type = 'human' AND u.status = 'active' AND u.id <> $1
           AND NOT EXISTS (SELECT 1 FROM my_following mf WHERE mf.id = u.id)
           AND NOT ${blockExistsSql('$1::uuid', 'u.id')}
       )
       SELECT s.*,
              (SELECT COALESCE(json_agg(json_build_object('username', v.username, 'displayName', v.display_name, 'avatarUrl', v.avatar_url)), '[]'::json)
               FROM users v WHERE v.id = ANY(s.via)) AS mutuals
       FROM scored s
       ORDER BY (CASE WHEN s.follows_you THEN 6 ELSE 0 END
                 + LEAST(s.mutual_count, 5) * 3
                 + CASE WHEN s.same_class THEN 4 ELSE 0 END
                 + cardinality(s.shared_tags) * 1.5
                 + CASE WHEN s.same_faculty THEN 2 ELSE 0 END
                 + CASE WHEN s.same_year THEN 1 ELSE 0 END
                 + CASE WHEN s.is_active THEN 1 ELSE 0 END
                 + CASE WHEN s.role = 'lecturer' AND s.same_faculty THEN 1 ELSE 0 END) DESC,
                s.reputation_points DESC NULLS LAST, s.id
       LIMIT $2`,
      [viewerId, Math.min(FOLLOW_SUGGESTION_MAX, Math.max(1, limit))]
    )
    return res.rows.map((r) => ({
      id: r.id,
      username: r.username,
      displayName: r.display_name || r.username,
      avatarUrl: r.avatar_url,
      bio: r.bio,
      role: r.role,
      faculty: r.faculty,
      className: r.class_name,
      isVerified: !!r.is_verified,
      reason: pickReason(r),
      mutualCount: r.mutual_count,
      mutuals: r.mutuals ?? [],
      sharedTags: r.shared_tags ?? []
    }))
  }
}

// Lý do hiển thị = tín hiệu mạnh nhất
function pickReason(r: any): FollowSuggestionReason {
  if (r.follows_you) return 'follows_you'
  if (r.mutual_count > 0) return 'mutual'
  if (r.same_class) return 'same_class'
  if (r.shared_tags?.length) return 'shared_interests'
  if (r.same_faculty) return 'same_faculty'
  return 'popular'
}
