import { Injectable, NotFoundException } from '@nestjs/common'
import type { AdminActivityItem, AdminActivityType, AdminPage, LoginSession } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { publicSessionId } from '../auth/security-log.service'
import { writeAudit } from './admin-audit'
import { iso, pagedQuery, SqlParams } from './admin-paging'

// Cột người liên quan (người theo dõi, người xem hồ sơ…) — alias "x"
const PERSON = `x.id AS user_id, x.username AS user_username, x.display_name AS user_name, x.avatar_url AS user_avatar`
const POST_TITLE = (p: string) => `COALESCE(NULLIF(${p}.title, ''), left(regexp_replace(${p}.content, '\\s+', ' ', 'g'), 120))`

interface Spec {
  select: string // phải có: id, title, subtitle, at, href, badge (+ PERSON nếu có người)
  from: string // $1 = user id
  order: string
}

// Mỗi loại hoạt động = 1 truy vấn, cùng dạng cột ⇒ 1 hàm map chung
const SPECS: Record<AdminActivityType, Spec> = {
  posts: {
    select: `p.id::text AS id, ${POST_TITLE('p')} AS title, p.likes_count || ' thích · ' || p.comments_count || ' bình luận · ' || p.views_count || ' xem' AS subtitle,
      p.created_at AS at, '/post/' || p.id AS href,
      CASE WHEN p.hidden_at IS NOT NULL THEN 'Đã ẩn' WHEN p.is_pinned THEN 'Ghim' END AS badge`,
    from: `posts p WHERE p.author_id = $1`,
    order: 'p.created_at DESC'
  },
  comments: {
    select: `c.id::text AS id, left(regexp_replace(c.content, '\\s+', ' ', 'g'), 200) AS title, 'trong: ' || ${POST_TITLE('p')} AS subtitle,
      c.created_at AS at, '/post/' || c.post_id AS href, CASE WHEN c.is_solution THEN 'Lời giải' END AS badge`,
    from: `comments c JOIN posts p ON p.id = c.post_id WHERE c.author_id = $1`,
    order: 'c.created_at DESC'
  },
  reactions: {
    select: `r.post_id::text AS id, ${POST_TITLE('p')} AS title, 'bài của @' || x.username AS subtitle, r.created_at AS at,
      '/post/' || r.post_id AS href, r.reaction::text AS badge, ${PERSON}`,
    from: `post_reactions r JOIN posts p ON p.id = r.post_id JOIN users x ON x.id = p.author_id WHERE r.user_id = $1`,
    order: 'r.created_at DESC'
  },
  saved: {
    select: `s.post_id::text AS id, ${POST_TITLE('p')} AS title, 'bộ sưu tập: ' || s.collection_name AS subtitle, s.saved_at AS at,
      '/post/' || s.post_id AS href, NULL AS badge`,
    from: `saved_posts s JOIN posts p ON p.id = s.post_id WHERE s.user_id = $1`,
    order: 's.saved_at DESC'
  },
  following: {
    select: `x.id::text AS id, x.display_name AS title, '@' || x.username AS subtitle, f.created_at AS at, '/' || x.username AS href, NULL AS badge, ${PERSON}`,
    from: `user_follows f JOIN users x ON x.id = f.following_id WHERE f.follower_id = $1`,
    order: 'f.created_at DESC'
  },
  followers: {
    select: `x.id::text AS id, x.display_name AS title, '@' || x.username AS subtitle, f.created_at AS at, '/' || x.username AS href, NULL AS badge, ${PERSON}`,
    from: `user_follows f JOIN users x ON x.id = f.follower_id WHERE f.following_id = $1`,
    order: 'f.created_at DESC'
  },
  communities: {
    select: `c.id::text AS id, c.name AS title, 'c/' || c.slug AS subtitle, m.joined_at AS at, '/c/' || c.slug AS href,
      NULLIF(m.role, 'member') AS badge`,
    from: `community_members m JOIN communities c ON c.id = m.community_id WHERE m.user_id = $1`,
    order: 'm.joined_at DESC'
  },
  groups: {
    select: `g.id::text AS id, g.name AS title, NULL AS subtitle, m.joined_at AS at, NULL AS href, NULLIF(m.role::text, 'member') AS badge`,
    from: `study_group_members m JOIN study_groups g ON g.id = m.group_id WHERE m.user_id = $1`,
    order: 'm.joined_at DESC'
  },
  documents: {
    select: `d.id::text AS id, d.title AS title, d.doc_type::text || ' · ' || d.download_count || ' lượt tải' AS subtitle, d.created_at AS at,
      d.file_url AS href, NULL AS badge`,
    from: `documents d WHERE d.owner_id = $1`,
    order: 'd.created_at DESC'
  },
  // Chỉ siêu dữ liệu — KHÔNG đọc nội dung tin nhắn
  conversations: {
    select: `cv.id::text AS id,
      CASE cv.type
        WHEN 'direct' THEN 'Nhắn riêng với @' || COALESCE((SELECT u2.username FROM conversation_members m2 JOIN users u2 ON u2.id = m2.user_id
                                                              WHERE m2.conversation_id = cv.id AND m2.user_id <> $1 LIMIT 1), '?')
        WHEN 'ai' THEN 'N7AI'
        ELSE COALESCE(cv.title, 'Nhóm chat')
      END AS title,
      (SELECT COUNT(*) FROM messages ms WHERE ms.conversation_id = cv.id AND ms.sender_id = $1)::int || ' tin đã gửi · '
        || (SELECT COUNT(*) FROM conversation_members m3 WHERE m3.conversation_id = cv.id AND m3.left_at IS NULL) || ' thành viên' AS subtitle,
      m.joined_at AS at, NULL AS href, CASE WHEN m.left_at IS NOT NULL THEN 'Đã rời' WHEN cv.type = 'group' THEN 'Nhóm' END AS badge`,
    from: `conversation_members m JOIN conversations cv ON cv.id = m.conversation_id WHERE m.user_id = $1`,
    order: 'm.joined_at DESC'
  },
  reports_filed: {
    select: `r.id::text AS id, ${POST_TITLE('p')} AS title, r.reason || COALESCE(' · ' || NULLIF(r.details, ''), '') AS subtitle, r.created_at AS at,
      '/post/' || r.post_id AS href, CASE WHEN r.status = 'pending' THEN 'Chờ xử lý' ELSE r.resolution END AS badge`,
    from: `post_reports r JOIN posts p ON p.id = r.post_id WHERE r.reporter_id = $1`,
    order: 'r.created_at DESC'
  },
  reports_received: {
    select: `r.id::text AS id, ${POST_TITLE('p')} AS title, r.reason || COALESCE(' · ' || NULLIF(r.details, ''), '') AS subtitle, r.created_at AS at,
      '/post/' || r.post_id AS href, CASE WHEN r.status = 'pending' THEN 'Chờ xử lý' ELSE r.resolution END AS badge, ${PERSON}`,
    from: `post_reports r JOIN posts p ON p.id = r.post_id JOIN users x ON x.id = r.reporter_id WHERE p.author_id = $1`,
    order: 'r.created_at DESC'
  },
  // Hành vi xem / tìm kiếm (dữ liệu cá nhân hóa — chỉ có khi người dùng bật)
  events: {
    select: `e.id::text AS id, e.type AS title,
      COALESCE(e.meta ->> 'q', e.meta ->> 'key', e.target_type) AS subtitle, e.created_at AS at,
      CASE WHEN e.target_type = 'post' THEN '/post/' || e.target_id END AS href, NULL AS badge`,
    from: `user_events e WHERE e.user_id = $1`,
    order: 'e.created_at DESC'
  },
  profile_viewers: {
    select: `v.id::text AS id, x.display_name AS title, '@' || x.username || ' · ' || v.views || ' lượt' AS subtitle, v.last_at AS at,
      '/' || x.username AS href, NULL AS badge, ${PERSON}`,
    from: `profile_views v JOIN users x ON x.id = v.viewer_id WHERE v.profile_id = $1`,
    order: 'v.last_at DESC'
  },
  profiles_viewed: {
    select: `v.id::text AS id, x.display_name AS title, '@' || x.username || ' · ' || v.views || ' lượt' AS subtitle, v.last_at AS at,
      '/' || x.username AS href, NULL AS badge, ${PERSON}`,
    from: `profile_views v JOIN users x ON x.id = v.profile_id WHERE v.viewer_id = $1`,
    order: 'v.last_at DESC'
  }
}

// Loại nhạy cảm ⇒ mỗi lần mở trang đầu đều ghi audit
const SENSITIVE: AdminActivityType[] = ['events', 'profile_viewers', 'profiles_viewed', 'conversations']
const SESSION_USER = `sess::jsonb #>> '{passport,user,id}'`

@Injectable()
export class AdminUserDataService {
  constructor(private readonly db: DatabaseService) {}

  async activity(adminId: string, userId: string, type: AdminActivityType, page: number, pageSize: number): Promise<AdminPage<AdminActivityItem>> {
    const spec = SPECS[type]
    const p = new SqlParams()
    p.add(userId)
    const result = await pagedQuery(this.db, {
      params: p,
      page,
      pageSize,
      select: spec.select,
      from: spec.from,
      order: spec.order,
      map: (r): AdminActivityItem => ({
        id: r.id,
        title: r.title ?? '',
        subtitle: r.subtitle ?? null,
        at: iso(r.at) as string,
        href: r.href ?? null,
        badge: r.badge ?? null,
        user: r.user_id ? { id: r.user_id, username: r.user_username, displayName: r.user_name, avatarUrl: r.user_avatar } : null
      })
    })
    if (SENSITIVE.includes(type) && page === 1) {
      await this.db.transaction((client) =>
        writeAudit(client, adminId, { action: 'user.data_view', targetType: 'user', targetId: userId, details: { type } })
      )
    }
    return result
  }

  // Phiên đăng nhập đang mở của 1 người (id công khai = băm sid)
  async sessions(userId: string): Promise<LoginSession[]> {
    const res = await this.db.query(
      `SELECT sid, sess::jsonb -> 'meta' AS meta, expire FROM user_sessions WHERE ${SESSION_USER} = $1 AND expire > NOW() ORDER BY expire DESC`,
      [userId]
    )
    return res.rows.map((r) => {
      const meta = (r.meta ?? {}) as { ip?: string; device?: string; method?: string; createdAt?: string }
      return {
        id: publicSessionId(r.sid),
        device: meta.device ?? 'Phiên cũ (trước khi có nhật ký)',
        ip: meta.ip ?? null,
        method: (meta.method as LoginSession['method']) ?? null,
        createdAt: meta.createdAt ?? null,
        lastActiveAt: new Date(new Date(r.expire).getTime() - 7 * 86_400_000).toISOString(),
        current: false
      }
    })
  }

  // Ép đăng xuất 1 phiên cụ thể
  async revokeSession(adminId: string, userId: string, sessionId: string): Promise<LoginSession[]> {
    const res = await this.db.query(`SELECT sid FROM user_sessions WHERE ${SESSION_USER} = $1`, [userId])
    const sid = res.rows.map((r) => r.sid as string).find((s) => publicSessionId(s) === sessionId)
    if (!sid) throw new NotFoundException('Phiên không tồn tại hoặc đã hết hạn')
    await this.db.transaction(async (client) => {
      await client.query(`DELETE FROM user_sessions WHERE sid = $1`, [sid])
      // method 'admin' = do quản trị viên thực hiện (không phải thiết bị của người dùng)
      await client.query(`INSERT INTO user_security_events (user_id, event, success, method) VALUES ($1, 'session_revoked', TRUE, 'admin')`, [userId])
      await writeAudit(client, adminId, { action: 'user.session_revoke', targetType: 'user', targetId: userId, details: { session: sessionId } })
    })
    return this.sessions(userId)
  }
}
