import { HttpException, HttpStatus } from '@nestjs/common'
import type { NotifyInput } from '../notifications/notification.types'

// Runtime constants redeclared (API only imports types from @pu/schemas) — keep in sync with packages/schemas/src/constants/anonymity.ts
export const ANONYMOUS_AUTHOR = { id: 'anonymous', username: 'an-danh', displayName: 'Ẩn danh', avatarUrl: null } as const
export const ANONYMOUS_DAILY_LIMIT = { posts: 3, comments: 20 } as const

// Tác giả giả cho bài / bình luận ẩn danh (không để lộ role, khoa, điểm uy tín)
// Placeholder author: no role / interest field / reputation leaks
export function anonymousAuthor() {
  return { ...ANONYMOUS_AUTHOR, role: 'student', interestField: null, reputationPoints: 0 }
}

// Sự kiện thông báo do hành động ẩn danh: không nêu actor, không gộp nhóm (gộp theo actor sẽ lộ người)
// Anonymous action ⇒ no actor, no grouping
export function anonymizeNotification(event: NotifyInput): NotifyInput {
  return { ...event, actorId: null, groupKey: null, verb: `${event.verb.startsWith('Một người') ? '' : 'Một người ẩn danh '}${event.verb}` }
}

// Hạn mức ẩn danh trong 24 giờ; vượt ⇒ 429
// Rolling 24h quota to curb abuse
export async function assertAnonymousQuota(
  client: { query: (sql: string, params: any[]) => Promise<{ rows: any[] }> },
  table: 'posts' | 'comments',
  userId: string
): Promise<void> {
  const res = await client.query(`SELECT COUNT(*)::int AS n FROM ${table} WHERE author_id = $1 AND is_anonymous AND created_at > NOW() - INTERVAL '24 hours'`, [
    userId
  ])
  if ((res.rows[0]?.n ?? 0) >= ANONYMOUS_DAILY_LIMIT[table]) {
    throw new HttpException(`Bạn đã dùng hết lượt ${table === 'posts' ? 'đăng bài' : 'bình luận'} ẩn danh hôm nay`, HttpStatus.TOO_MANY_REQUESTS)
  }
}
