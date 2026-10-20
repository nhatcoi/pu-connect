import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import type {
  AdminBotAccount,
  AdminBotAccountInput,
  AdminBotAccountUpdate,
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
import type { PoolClient } from 'pg'
import { DatabaseService } from '../../database/database.service'
import { writeAudit } from './admin-audit'
import { iso, pagedQuery, SqlParams, whereOf } from './admin-paging'
import type { BotActivityQuery, BotFeedQuery } from './dto/admin-bots.dto'

const ONLINE_WINDOW_SECONDS = 30
const MAX_PENDING_COMMANDS = 50
const BCRYPT_ROUNDS = 10
const FEED_STATUSES: BotFeedStatus[] = ['new', 'review', 'approved', 'rejected', 'scheduled', 'posted', 'skipped']

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
         SELECT u.id, u.username, u.display_name, u.faculty, u.role, u.bio, p.*,
           GREATEST(0, (SELECT COUNT(*) FROM posts x, day WHERE x.author_id = u.id AND x.created_at >= day.t)
                     - (SELECT COUNT(*) FROM bot_feed_items f, day WHERE f.posted_by = u.username AND f.posted_at >= day.t))::int AS used_post,
           (SELECT COUNT(*) FROM comments x, day WHERE x.author_id = u.id AND x.created_at >= day.t)::int AS used_comment,
           (SELECT COUNT(*) FROM post_reactions x, day WHERE x.user_id = u.id AND x.created_at >= day.t)::int AS used_like,
           (SELECT MAX(a.created_at) FROM bot_activity a WHERE a.bot_username = u.username AND a.action NOT IN ('warn', 'error')) AS last_action_at
         FROM users u JOIN bot_profiles p ON p.user_id = u.id
         WHERE u.is_bot ORDER BY u.username`
      ),
      this.db.query(
        `SELECT c.id, c.type, c.payload, c.status, c.result, c.scheduled_at, c.created_at, c.finished_at, u.username AS created_by
         FROM bot_commands c LEFT JOIN users u ON u.id = c.created_by
         ORDER BY c.id DESC LIMIT 30`
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
          role: r.role,
          faculty: r.faculty,
          bio: r.bio ?? '',
          tone: r.tone ?? '',
          major: r.major ?? '',
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
          scheduledAt: iso(r.scheduled_at)!,
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

  // Mật khẩu chung của bot: daemon đăng nhập bằng cùng giá trị (BOT_PASSWORD); dev local dùng mặc định
  private botPassword() {
    const pw = process.env.BOT_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'BotPassword@123')
    if (!pw) throw new BadRequestException('Thiếu BOT_PASSWORD trên server, chưa thể tạo bot')
    return pw
  }

  // ACID Transaction: tạo user (is_bot) + hồ sơ bot (mọi quyền tắt) + audit
  async createAccount(adminId: string, input: AdminBotAccountInput) {
    const hash = await bcrypt.hash(this.botPassword(), BCRYPT_ROUNDS)
    await this.db.transaction(async (client) => {
      const taken = await client.query(`SELECT 1 FROM users WHERE username = $1 OR email = $2`, [input.username, `${input.username}@seed.pu-connector.test`])
      if (taken.rowCount) throw new ConflictException('Username đã tồn tại')
      const user = await client.query(
        `INSERT INTO users (id, email, username, password_hash, display_name, role, status, is_onboarded, email_verified, email_verified_at, faculty, bio, is_bot, created_at)
         VALUES (gen_random_uuid(), $1, $2, $3, $4, $5, 'active', true, true, NOW(), $6, $7, true, NOW()) RETURNING id`,
        [`${input.username}@seed.pu-connector.test`, input.username, hash, input.displayName, input.role, input.faculty, input.bio ?? '']
      )
      await client.query(`INSERT INTO bot_profiles (user_id, tone, major, updated_by) VALUES ($1, $2, $3, $4)`, [user.rows[0].id, input.tone ?? '', input.major ?? '', adminId])
      await writeAudit(client, adminId, { action: 'bot.account_create', targetType: 'bot', targetId: input.username, details: { ...input } })
    })
    return this.overview()
  }

  async updateAccount(adminId: string, username: string, input: AdminBotAccountUpdate) {
    await this.db.transaction(async (client) => {
      const bot = await client.query(
        `UPDATE users SET display_name = COALESCE($2, display_name), role = COALESCE($3::user_role_enum, role), faculty = COALESCE($4, faculty), bio = COALESCE($5, bio)
         WHERE username = $1 AND is_bot RETURNING id`,
        [username, input.displayName ?? null, input.role ?? null, input.faculty ?? null, input.bio ?? null]
      )
      if (!bot.rowCount) throw new NotFoundException('Không phải bot')
      await client.query(`UPDATE bot_profiles SET tone = COALESCE($2, tone), major = COALESCE($3, major), updated_by = $4, updated_at = NOW() WHERE user_id = $1`, [
        bot.rows[0].id,
        input.tone ?? null,
        input.major ?? null,
        adminId
      ])
      await writeAudit(client, adminId, { action: 'bot.account_update', targetType: 'bot', targetId: username, details: { ...input } })
    })
    return this.overview()
  }

  // ACID Transaction: xóa hẳn bot (bài/bình luận/tim của bot xóa theo, CASCADE), tính lại bộ đếm các bài bị ảnh hưởng, hủy lệnh đang chờ của bot
  async deleteAccount(adminId: string, username: string) {
    await this.db.transaction(async (client) => {
      const bot = await client.query(`SELECT id FROM users WHERE username = $1 AND is_bot FOR UPDATE`, [username])
      if (!bot.rowCount) throw new NotFoundException('Không phải bot')
      const id = bot.rows[0].id
      const touched = await client.query(
        `SELECT post_id FROM comments WHERE author_id = $1 UNION SELECT post_id FROM post_reactions WHERE user_id = $1`,
        [id]
      )
      await this.cancelPendingOf(client, username)
      await client.query(`DELETE FROM users WHERE id = $1`, [id])
      await client.query(
        `UPDATE posts p SET
           likes_count = (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id),
           comments_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id)
         WHERE p.id = ANY($1::uuid[])`,
        [touched.rows.map((r) => r.post_id)]
      )
      await writeAudit(client, adminId, { action: 'bot.account_delete', targetType: 'bot', targetId: username })
    })
    return this.overview()
  }

  // Hủy lệnh chờ của 1 bot; bài crawl đã giao cho lệnh đó quay về hàng sẵn đăng
  private async cancelPendingOf(client: PoolClient, username: string) {
    const res = await client.query(
      `UPDATE bot_commands SET status = 'cancelled', result = 'Bot đã bị xóa', finished_at = NOW()
       WHERE status = 'pending' AND payload->>'bot' = $1 RETURNING payload`,
      [username]
    )
    await this.releaseFeedItems(client, res.rows.map((r) => r.payload?.feedItemId))
  }

  private async releaseFeedItems(client: PoolClient, ids: (string | undefined)[]) {
    const items = ids.filter((x): x is string => !!x).map(Number)
    if (items.length) await client.query(`UPDATE bot_feed_items SET status = 'approved' WHERE id = ANY($1::bigint[]) AND status = 'scheduled'`, [items])
  }

  // Hủy lệnh đang chờ (chưa tới giờ / chưa được daemon nhận)
  async cancelCommand(adminId: string, id: number) {
    await this.db.transaction(async (client) => {
      const res = await client.query(`UPDATE bot_commands SET status = 'cancelled', result = 'Admin hủy', finished_at = NOW() WHERE id = $1 AND status = 'pending' RETURNING payload`, [id])
      if (!res.rowCount) throw new BadRequestException('Lệnh không còn ở trạng thái chờ')
      await this.releaseFeedItems(client, [res.rows[0].payload?.feedItemId])
      await writeAudit(client, adminId, { action: 'bot.command_cancel', targetType: 'bot', targetId: String(id) })
    })
    return this.overview()
  }

  // ACID Transaction: validate bot/bài crawl, cap queue, enqueue command & audit
  async enqueue(adminId: string, input: AdminBotCommandInput) {
    const { type, scheduledAt, ...payload } = input
    await this.db.transaction(async (client) => {
      if (input.bot) {
        const found = await client.query(`SELECT 1 FROM users WHERE is_bot AND username = $1`, [input.bot])
        if (!found.rowCount) throw new BadRequestException(`Không phải bot: ${input.bot}`)
      }
      if (input.type === 'post' && input.feedItemId) {
        if (!input.bot) throw new BadRequestException('Đăng bài crawl cần chọn bot')
        // Giữ bài khỏi FeedPoster: chỉ bài còn chờ mới giao được, đổi sang 'scheduled' trong cùng transaction
        const held = await client.query(`UPDATE bot_feed_items SET status = 'scheduled' WHERE id = $1 AND status IN ('new', 'review', 'approved', 'rejected') RETURNING id`, [input.feedItemId])
        if (!held.rowCount) throw new BadRequestException('Bài crawl không còn ở trạng thái giao được (đã đăng/đã hẹn)')
      }
      // Khóa dòng điều khiển để đếm hàng đợi không bị race giữa 2 admin
      await client.query(`SELECT 1 FROM bot_control WHERE id = 1 FOR UPDATE`)
      const pending = await client.query(`SELECT COUNT(*)::int AS n FROM bot_commands WHERE status IN ('pending', 'running')`)
      if (pending.rows[0].n >= MAX_PENDING_COMMANDS) throw new BadRequestException('Hàng đợi lệnh đầy, chờ bot xử lý xong')
      const res = await client.query(`INSERT INTO bot_commands (type, payload, created_by, scheduled_at) VALUES ($1, $2, $3, COALESCE($4::timestamptz, NOW())) RETURNING id`, [
        type,
        JSON.stringify(payload),
        adminId,
        scheduledAt ?? null
      ])
      await writeAudit(client, adminId, { action: 'bot.command', targetType: 'bot', targetId: String(res.rows[0].id), details: { type, scheduledAt, ...payload } })
    })
    return this.overview()
  }
}
