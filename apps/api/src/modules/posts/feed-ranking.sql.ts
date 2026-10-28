import { sharedFieldSql } from '../units/unit-sql'
import { interestBoostSql } from '../personalization/interest-profile.sql'

// Xếp hạng "Dành cho bạn" kiểu hot-rank (HN/Reddit): (độ hợp + log tương tác) / tuổi^gravity
// Hot-rank feed: affinity + log(engagement), divided by age^gravity so fresh posts surface
export const FEED_RANKING = {
  // Điểm nền để bài mới chưa ai tương tác vẫn > 0
  base: 10,
  // log(1 + like×2 + comment×5) × hệ số ⇒ 100 like không đè chết bài mới
  engagementWeight: 12,
  // Độ dốc suy giảm theo giờ (HN dùng 1.8; cộng đồng nhỏ ⇒ thoải hơn)
  gravity: 1.2,
  ageOffsetHours: 2,
  // Bài thứ 3+ của cùng tác giả trong feed bị nhân dần 0.5 ⇒ một người không chiếm cả trang
  authorFreeSlots: 2,
  authorPenalty: 0.5,
  // Mỗi lần đã lướt qua (post_view) nhân 0.7, tối đa 5 lần ⇒ feed đổi giữa các lần vào
  seenPenalty: 0.7,
  seenMaxCount: 5
} as const

const R = FEED_RANKING

// Độ hợp với người xem: lĩnh vực quan tâm, trường, follow, sở thích/kỹ năng, hồ sơ quan tâm suy ra
// Viewer affinity (viewer row aliased `cu`, viewer id = $1)
const affinitySql = (viewer: string) => `(
  (CASE WHEN ${sharedFieldSql('u', 'cu')} THEN 30.0 ELSE 0.0 END)
  + (CASE WHEN u.university_id IS NOT NULL AND u.university_id = cu.university_id THEN 15.0 ELSE 0.0 END)
  + (CASE WHEN EXISTS(SELECT 1 FROM user_follows uf WHERE uf.follower_id = ${viewer} AND uf.following_id = p.author_id) THEN 35.0 ELSE 0.0 END)
  + (CASE WHEN cu.interests IS NOT NULL AND array_length(cu.interests, 1) > 0 AND p.tags && cu.interests THEN 35.0 ELSE 0.0 END)
  + (CASE WHEN cu.skills IS NOT NULL AND array_length(cu.skills, 1) > 0 AND p.tags && cu.skills THEN 25.0 ELSE 0.0 END)
  + ${interestBoostSql(viewer, 'p')}
)`

// Điểm hot của bài, tuổi tính theo mốc snapshot (không dùng NOW) ⇒ phân trang offset ổn định
// Hot score; age measured against the snapshot so pages stay consistent
export const hotScoreSql = (snapshot: string, viewer?: string) => `(
  (${R.base}.0
    + ${viewer ? affinitySql(viewer) : '0.0'}
    + (CASE WHEN p.is_resolved THEN 10.0 ELSE 0.0 END)
    + ${R.engagementWeight}.0 * ln(1.0 + GREATEST(p.likes_count, 0) * 2.0 + GREATEST(p.comments_count, 0) * 5.0))
  / power(GREATEST(EXTRACT(EPOCH FROM (${snapshot}::timestamptz - p.created_at)) / 3600.0, 0) + ${R.ageOffsetHours}.0, ${R.gravity})
)`

// Hệ số giảm cho bài đã lướt qua (cần seenJoinSql)
export const seenFactorSql = `power(${R.seenPenalty}, LEAST(COALESCE(seen.n, 0), ${R.seenMaxCount}))`

// Số lần người xem đã lướt qua từng bài trước mốc snapshot (LEFT JOIN alias `seen`)
// Per-post view count for the viewer, frozen at the snapshot
export const seenJoinSql = (viewer: string, snapshot: string) => ` LEFT JOIN (
  SELECT target_id, COUNT(*)::int AS n FROM user_events
  WHERE user_id = ${viewer} AND type = 'post_view' AND target_type = 'post' AND created_at <= ${snapshot}::timestamptz
  GROUP BY target_id
) seen ON seen.target_id = p.id`

// Tính điểm một lần (LATERAL `rk.score`) rồi đa dạng tác giả bằng thứ hạng trong nhóm tác giả
// Author diversity: nth post of the same author (n > free slots) decays geometrically
export const rankedScoreSql = `rk.score * power(${R.authorPenalty}, GREATEST(ROW_NUMBER() OVER (PARTITION BY p.author_id ORDER BY rk.score DESC) - ${R.authorFreeSlots}, 0))`
