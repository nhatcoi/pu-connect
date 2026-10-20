import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common'
import type {
  AdminBotAccount,
  AdminBotActivity,
  AdminBotCommand,
  AdminBotCommandInput,
  AdminBotControlInput,
  AdminBotFeedAction,
  AdminBotFeedItem,
  AdminBotOverview,
  AdminBotProfileInput,
  AdminBotTopic,
  AdminBotTopicInput,
  AdminPage,
  BotFeedStatus,
  BotSessionStats
} from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { writeAudit } from './admin-audit'
import { iso, pagedQuery, SqlParams, whereOf } from './admin-paging'
import type { BotActivityQuery, BotFeedQuery } from './dto/admin-bots.dto'

const ONLINE_WINDOW_SECONDS = 30
const MAX_PENDING_COMMANDS = 10
const FEED_STATUSES: BotFeedStatus[] = ['new', 'review', 'approved', 'rejected', 'posted', 'skipped']

// Điều khiển Bot Simulator: admin ghi cấu hình/lệnh vào DB, daemon (tools/bot-simulator) đọc và thực thi
@Injectable()
export class AdminBotsService {
  constructor(private readonly db: DatabaseService) {}

  async overview(): Promise<AdminBotOverview> {
    const [control, bots, commands, feed, topics] = await Promise.all([
      this.db.query(
        `SELECT enabled, feed_enabled, feed_review, ai_model, ai_base_url, speed, heartbeat_at, started_at, stats,
                heartbeat_at IS NOT NULL AND heartbeat_at > NOW() - make_interval(secs => $1) AS online
         FROM bot_control WHERE id = 1`,
        [ONLINE_WINDOW_SECONDS]
      ),
      // Hạn mức dùng hôm nay (giờ VN) đếm từ bảng thật, cùng cách daemon tính; bài từ dữ liệu crawl không tính vào bài tự sinh
      this.db.query(
        `WITH day AS (SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS t)
         SELECT u.id, u.username, u.display_name, u.faculty, p.*,
           GREATEST(0, (SELECT COUNT(*) FROM posts x, day WHERE x.author_id = u.id AND x.created_at >= day.t)
                     - (SELECT COUNT(*) FROM bot_feed_items f, day WHERE f.posted_by = u.username AND f.posted_at >= day.t))::int AS used_post,
           (SELECT COUNT(*) FROM comments x, day WHERE x.author_id = u.id AND x.created_at >= day.t)::int AS used_comment,
           (SELECT COUNT(*) FROM post_reactions x, day WHERE x.user_id = u.id AND x.created_at >= day.t)::int AS used_like,
           (SELECT MAX(a.created_at) FROM bot_activity a WHERE a.bot_username = u.username AND a.action NOT IN ('warn', 'error')) AS last_action_at
         FROM users u JOIN bot_profiles p ON p.user_id = u.id
         WHERE u.is_bot ORDER BY u.username`
      ),
      this.db.query(
        `SELECT c.id, c.type, c.payload, c.status, c.result, c.created_at, c.finished_at, u.username AS created_by
         FROM bot_commands c LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.id DESC LIMIT 15`
      ),
      this.db.query(
        `SELECT status, COUNT(*)::int AS n FROM bot_feed_items GROUP BY status
         UNION ALL SELECT 'posted24h', COUNT(*)::int FROM bot_feed_items WHERE status = 'posted' AND posted_at > NOW() - INTERVAL '24 hours'
         UNION ALL SELECT 'last', EXTRACT(EPOCH FROM MAX(posted_at))::int FROM bot_feed_items WHERE status = 'posted'`
      ),
      this.db.query(`SELECT slug, label, keywords, enabled FROM bot_topics ORDER BY label`)
    ])

    const c = control.rows[0]
    const byStatus = Object.fromEntries(FEED_STATUSES.map((s) => [s, 0])) as Record<BotFeedStatus, number>
    let posted24h = 0
    let lastPostedAt: string | null = null
    for (const r of feed.rows) {
      if (r.status === 'posted24h') posted24h = r.n
      else if (r.status === 'last') lastPostedAt = r.n ? new Date(r.n * 1000).toISOString() : null
      else byStatus[r.status as BotFeedStatus] = r.n
    }

    return {
      enabled: c.enabled,
      feedEnabled: c.feed_enabled,
      feedReview: c.feed_review,
      feed: { byStatus, posted24h, lastPostedAt },
      ai: { model: c.ai_model, baseUrl: c.ai_base_url },
      speed: c.speed,
      online: c.online,
      heartbeatAt: iso(c.heartbeat_at),
      startedAt: iso(c.started_at),
      stats: Object.keys(c.stats ?? {}).length ? (c.stats as BotSessionStats) : null,
      topics: topics.rows.map((r): AdminBotTopic => ({ slug: r.slug, label: r.label, keywords: r.keywords, enabled: r.enabled })),
      bots: bots.rows.map(
        (r): AdminBotAccount => ({
          id: r.id,
          username: r.username,
          displayName: r.display_name,
          faculty: r.faculty,
          profile: {
            enabled: r.enabled,
            topics: r.topics,
            canPost: r.can_post,
            canComment: r.can_comment,
            canLike: r.can_like,
            interactHumans: r.interact_humans,
            feedPoster: r.feed_poster,
            maxPostsPerDay: r.max_posts_per_day,
            maxCommentsPerDay: r.max_comments_per_day,
            maxLikesPerDay: r.max_likes_per_day
          },
          usedToday: { post: r.used_post, comment: r.used_comment, like: r.used_like },
          lastActionAt: iso(r.last_action_at)
        })
      ),
      commands: commands.rows.map(
        (r): AdminBotCommand => ({
          id: String(r.id),
          type: r.type,
          payload: r.payload,
          status: r.status,
          result: r.result,
          createdBy: r.created_by,
          createdAt: iso(r.created_at)!,
          finishedAt: iso(r.finished_at)
        })
      )
    }
  }

  async activity(q: BotActivityQuery): Promise<AdminPage<AdminBotActivity>> {
    const p = new SqlParams()
    const where = whereOf([q.bot && `bot_username = ${p.add(q.bot)}`, q.level && `level = ${p.add(q.level)}`])
    return pagedQuery(this.db, {
      select: 'id, bot_username, action, details, level, created_at',
      from: `bot_activity ${where}`,
      params: p,
      order: 'created_at DESC, id DESC',
      page: q.page,
      pageSize: q.pageSize,
      map: (r) => ({ id: String(r.id), botUsername: r.bot_username, action: r.action, details: r.details, level: r.level, createdAt: iso(r.created_at)! })
    })
  }

  async feedItems(q: BotFeedQuery): Promise<AdminPage<AdminBotFeedItem>> {
    const p = new SqlParams()
    const where = whereOf([q.status && `status = ${p.add(q.status)}`])
    return pagedQuery(this.db, {
      select: 'id, status, topic, content, raw_content, cardinality(image_urls) AS images, verdict, posted_by, created_at, posted_at',
      from: `bot_feed_items ${where}`,
      params: p,
      order: 'id DESC',
      page: q.page,
      pageSize: q.pageSize,
      map: (r) => ({
        id: String(r.id),
        status: r.status,
        topic: r.topic,
        content: r.content,
        rawContent: r.raw_content,
        imageCount: r.images,
        verdict: r.verdict,
        postedBy: r.posted_by,
        createdAt: iso(r.created_at)!,
        postedAt: iso(r.posted_at)
      })
    })
  }

  // ACID Transaction: update control row & write audit log
  async setControl(adminId: string, input: AdminBotControlInput) {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE bot_control SET
           enabled = COALESCE($1, enabled), speed = COALESCE($2, speed), feed_enabled = COALESCE($3, feed_enabled),
           feed_review = COALESCE($4, feed_review), ai_model = COALESCE($5, ai_model),
           ai_base_url = CASE WHEN $6 THEN $7 ELSE ai_base_url END,
           updated_by = $8, updated_at = NOW()
         WHERE id = 1`,
        [input.enabled ?? null, input.speed ?? null, input.feedEnabled ?? null, input.feedReview ?? null, input.aiModel ?? null, input.aiBaseUrl !== undefined, input.aiBaseUrl ?? null, adminId]
      )
      await writeAudit(client, adminId, { action: 'bot.control', targetType: 'bot', targetId: 'simulator', details: { ...input } })
    })
    return this.overview()
  }

  // Cập nhật quyền/chủ đề/hạn mức 1 bot; chủ đề phải tồn tại
  async updateProfile(adminId: string, username: string, input: AdminBotProfileInput) {
    await this.db.transaction(async (client) => {
      const bot = await client.query(`SELECT id FROM users WHERE username = $1 AND is_bot`, [username])
      if (!bot.rowCount) throw new NotFoundException('Không phải bot')
      if (input.topics?.length) {
        const known = await client.query(`SELECT slug FROM bot_topics WHERE slug = ANY($1::text[])`, [input.topics])
        const missing = input.topics.filter((t) => !known.rows.some((r) => r.slug === t))
        if (missing.length) throw new BadRequestException(`Chủ đề không tồn tại: ${missing.join(', ')}`)
      }
      await client.query(
        `UPDATE bot_profiles SET
           enabled = COALESCE($2, enabled), topics = COALESCE($3, topics), can_post = COALESCE($4, can_post),
           can_comment = COALESCE($5, can_comment), can_like = COALESCE($6, can_like), interact_humans = COALESCE($7, interact_humans),
           feed_poster = COALESCE($8, feed_poster), max_posts_per_day = COALESCE($9, max_posts_per_day),
           max_comments_per_day = COALESCE($10, max_comments_per_day), max_likes_per_day = COALESCE($11, max_likes_per_day),
           updated_by = $12, updated_at = NOW()
         WHERE user_id = $1`,
        [
          bot.rows[0].id,
          input.enabled ?? null,
          input.topics ?? null,
          input.canPost ?? null,
          input.canComment ?? null,
          input.canLike ?? null,
          input.interactHumans ?? null,
          input.feedPoster ?? null,
          input.maxPostsPerDay ?? null,
          input.maxCommentsPerDay ?? null,
          input.maxLikesPerDay ?? null,
          adminId
        ]
      )
      await writeAudit(client, adminId, { action: 'bot.profile', targetType: 'bot', targetId: username, details: { ...input } })
    })
    return this.overview()
  }

  async upsertTopic(adminId: string, input: AdminBotTopicInput) {
    await this.db.transaction(async (client) => {
      await client.query(
        `INSERT INTO bot_topics (slug, label, keywords, enabled) VALUES ($1, $2, $3, $4)
         ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label, keywords = EXCLUDED.keywords, enabled = EXCLUDED.enabled`,
        [input.slug, input.label, input.keywords, input.enabled]
      )
      await writeAudit(client, adminId, { action: 'bot.topic', targetType: 'bot', targetId: input.slug, details: { ...input } })
    })
    return this.overview()
  }

  // Xóa chủ đề: gỡ khỏi hồ sơ mọi bot trong cùng transaction
  async deleteTopic(adminId: string, slug: string) {
    await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM bot_topics WHERE slug = $1`, [slug])
      if (!res.rowCount) throw new NotFoundException('Chủ đề không tồn tại')
      await client.query(`UPDATE bot_profiles SET topics = array_remove(topics, $1) WHERE $1 = ANY(topics)`, [slug])
      await writeAudit(client, adminId, { action: 'bot.topic_delete', targetType: 'bot', targetId: slug })
    })
    return this.overview()
  }

  // Duyệt tay bài crawl: chỉ bài đang chờ duyệt/AI từ chối/chưa duyệt mới đổi được
  async reviewFeedItem(adminId: string, id: number, action: AdminBotFeedAction) {
    await this.db.transaction(async (client) => {
      const next = action === 'approve' ? 'approved' : 'rejected'
      const res = await client.query(`UPDATE bot_feed_items SET status = $2 WHERE id = $1 AND status IN ('new', 'review', 'rejected', 'approved') RETURNING id`, [id, next])
      if (!res.rowCount) throw new BadRequestException('Bài không còn ở trạng thái duyệt được (đã đăng hoặc bỏ qua)')
      await writeAudit(client, adminId, { action: 'bot.feed_review', targetType: 'bot', targetId: String(id), details: { action } })
    })
    return { id, status: action === 'approve' ? 'approved' : 'rejected' }
  }

  // ACID Transaction: validate target bot, cap queue, enqueue command & audit
  async enqueue(adminId: string, input: AdminBotCommandInput) {
    const { type, ...payload } = input
    await this.db.transaction(async (client) => {
      if ('bot' in input && input.bot) {
        const found = await client.query(`SELECT 1 FROM users WHERE is_bot AND username = $1`, [input.bot])
        if (!found.rowCount) throw new BadRequestException(`Không phải bot: ${input.bot}`)
      }
      // Khóa dòng điều khiển để đếm hàng đợi không bị race giữa 2 admin
      await client.query(`SELECT 1 FROM bot_control WHERE id = 1 FOR UPDATE`)
      const pending = await client.query(`SELECT COUNT(*)::int AS n FROM bot_commands WHERE status IN ('pending', 'running')`)
      if (pending.rows[0].n >= MAX_PENDING_COMMANDS) throw new BadRequestException('Hàng đợi lệnh đầy, chờ bot xử lý xong')
      const res = await client.query(`INSERT INTO bot_commands (type, payload, created_by) VALUES ($1, $2, $3) RETURNING id`, [type, JSON.stringify(payload), adminId])
      await writeAudit(client, adminId, { action: 'bot.command', targetType: 'bot', targetId: String(res.rows[0].id), details: { type, ...payload } })
    })
    return this.overview()
  }
}
