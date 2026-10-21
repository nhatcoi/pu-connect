import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import * as bcrypt from 'bcryptjs'
import type {
  AdminBotAccount,
  AdminBotAccountInput,
  AdminBotAccountUpdate,
  AdminBotActivity,
  AdminBotCommand,
  AdminBotCommandInput,
  AdminBotControlInput,
  AdminBotOverview,
  AdminBotProfileInput,
  AdminBotTopic,
  AdminBotTopicInput,
  AdminPage,
  BotCommandType,
  BotGenerateContentInput,
  BotGenerateContentResult,
  BotRecentPost
} from '@pu/schemas'
import type { PoolClient } from 'pg'
import { DatabaseService } from '../../database/database.service'
import { LlmService } from '../ai/llm.service'
import { writeAudit } from './admin-audit'
import { iso, pagedQuery, SqlParams, whereOf } from './admin-paging'
import type { BotActivityQuery } from './dto/admin-bots.dto'

const MAX_PENDING_COMMANDS = 500
const BCRYPT_ROUNDS = 10

// Điều khiển Bot & Bộ chỉ huy Bot: thực thi trực tiếp trên API, tích hợp AI persona, không phụ thuộc daemon bên ngoài
@Injectable()
export class AdminBotsService implements OnModuleInit, OnModuleDestroy {
  private timer: NodeJS.Timeout | null = null
  private readonly logger = new Logger(AdminBotsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly llm: LlmService
  ) {}

  onModuleInit() {
    this.timer = setInterval(() => void this.processPendingCommands(), 15_000)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async overview(): Promise<AdminBotOverview> {
    const [control, bots, commands, topics, statsRes] = await Promise.all([
      this.db.query(`SELECT enabled, ai_model, ai_base_url, speed, heartbeat_at, started_at, stats FROM bot_control WHERE id = 1`),
      this.db.query(
        `WITH day AS (SELECT date_trunc('day', NOW() AT TIME ZONE 'Asia/Ho_Chi_Minh') AT TIME ZONE 'Asia/Ho_Chi_Minh' AS t)
         SELECT u.id, u.username, u.display_name, u.faculty, u.role, u.bio, p.*,
           (SELECT COUNT(*) FROM posts x, day WHERE x.author_id = u.id AND x.created_at >= day.t)::int AS used_post,
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
      this.db.query(`SELECT slug, label, keywords, enabled FROM bot_topics ORDER BY label`),
      this.db.query(
        `SELECT
           (SELECT COUNT(*) FROM posts p JOIN users u ON u.id = p.author_id WHERE u.is_bot)::int AS posts_count,
           (SELECT COUNT(*) FROM comments c JOIN users u ON u.id = c.author_id WHERE u.is_bot)::int AS comments_count,
           (SELECT COUNT(*) FROM post_reactions r JOIN users u ON u.id = r.user_id WHERE u.is_bot)::int AS likes_count`
      )
    ])

    const c = control.rows[0]
    const s = statsRes.rows[0]
    return {
      enabled: c?.enabled ?? true,
      ai: { model: c?.ai_model ?? 'v10', baseUrl: c?.ai_base_url ?? null },
      speed: c?.speed ?? 'normal',
      online: true,
      heartbeatAt: iso(new Date()),
      startedAt: iso(c?.started_at ?? new Date()),
      stats: {
        postsCount: Number(s?.posts_count) || 0,
        commentsCount: Number(s?.comments_count) || 0,
        likesCount: Number(s?.likes_count) || 0
      },
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
          soul: r.soul ?? '',
          profile: {
            enabled: r.enabled,
            topics: r.topics,
            canPost: r.can_post,
            canComment: r.can_comment,
            canLike: r.can_like,
            interactHumans: r.interact_humans,
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

  async recentPosts(): Promise<BotRecentPost[]> {
    const res = await this.db.query(
      `SELECT p.id, p.title, left(p.content, 120) AS snippet, p.likes_count, p.comments_count, p.created_at,
              u.display_name AS author_name, u.username AS author_username, u.is_bot AS author_is_bot
       FROM posts p
       JOIN users u ON u.id = p.author_id
       WHERE p.hidden_at IS NULL
       ORDER BY p.created_at DESC
       LIMIT 20`
    )
    return res.rows.map((r) => ({
      id: String(r.id),
      title: r.title || '(Không có tiêu đề)',
      snippet: r.snippet || '',
      likesCount: Number(r.likes_count) || 0,
      commentsCount: Number(r.comments_count) || 0,
      createdAt: iso(r.created_at)!,
      authorName: r.author_name || 'Người dùng',
      authorUsername: r.author_username || '',
      authorIsBot: Boolean(r.author_is_bot)
    }))
  }

  async generateContent(input: BotGenerateContentInput): Promise<BotGenerateContentResult> {
    const botRes = await this.db.query(
      `SELECT u.id, u.username, u.display_name, u.role, u.faculty, u.bio, p.tone, p.major, p.soul
       FROM users u JOIN bot_profiles p ON p.user_id = u.id
       WHERE u.username = $1 AND u.is_bot`,
      [input.bot]
    )
    if (!botRes.rowCount) throw new NotFoundException(`Bot @${input.bot} không tồn tại`)
    const bot = botRes.rows[0]
    const roleStr = bot.role === 'lecturer' ? 'Giảng viên' : bot.role === 'ta' ? 'Trợ giảng' : 'Sinh viên'

    if (input.type === 'post') {
      const systemPrompt = `Bạn là bot "${bot.display_name}" (@${bot.username}) trên mạng xã hội nội bộ Đại học Phenikaa (PU Connector).
Vai trò: ${roleStr}.
Khoa: ${bot.faculty || 'Đại cương'}, Chuyên ngành: ${bot.major || 'Đại cương'}.
Giọng điệu: ${bot.tone || 'tự nhiên, thân thiện, chia sẻ'}.
Linh hồn / Persona (Soul): ${bot.soul || 'Sinh viên năng động, thích học hỏi, hay chia sẻ kinh nghiệm học tập và tài liệu'}.
Yêu cầu: Viết một bài đăng ngắn gọn, hữu ích, mang tính thảo luận học đường tích cực.
BẮT BUỘC trả về định dạng JSON thuần túy (không kèm markdown \`\`\`json):
{
  "title": "Tiêu đề bài viết ngắn gọn (dưới 80 ký tự)",
  "content": "Nội dung bài viết (2-4 đoạn văn tự nhiên, có cảm xúc)",
  "tags": ["tag1", "tag2"]
}`
      const userPrompt = input.prompt ? `Chủ đề bài viết: ${input.prompt}` : 'Hãy viết một bài chia sẻ thú vị hoặc thảo luận học tập phù hợp với chuyên ngành của bạn.'
      try {
        const { text } = await this.llm.complete([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ])
        const cleaned = text.replace(/^```json/i, '').replace(/^```/i, '').replace(/```$/i, '').trim()
        try {
          const parsed = JSON.parse(cleaned)
          return {
            title: parsed.title || input.prompt || 'Chia sẻ từ ' + bot.display_name,
            content: parsed.content || cleaned,
            tags: Array.isArray(parsed.tags) ? parsed.tags : ['phenikaa', 'sinhvien']
          }
        } catch {
          return {
            title: input.prompt || 'Chia sẻ từ ' + bot.display_name,
            content: cleaned,
            tags: ['phenikaa', 'sinhvien']
          }
        }
      } catch (err) {
        this.logger.error('LLM generate post content failed', err)
        return {
          title: input.prompt || 'Chia sẻ học tập cùng ' + bot.display_name,
          content: input.prompt ? `Hôm nay mình muốn cùng mọi người thảo luận về: ${input.prompt}. Các bạn có góc nhìn hay tài liệu nào về phần này không?` : `Chào mọi người! Chúc mọi người một tuần học tập thật hiệu quả. Đừng quên ôn tập đều đặn nhé!`,
          tags: ['phenikaa']
        }
      }
    } else {
      let postContext = ''
      if (input.postId) {
        const postRes = await this.db.query(
          `SELECT p.title, p.content, u.display_name AS author_name FROM posts p JOIN users u ON u.id = p.author_id WHERE p.id = $1`,
          [input.postId]
        )
        if (postRes.rowCount) {
          const p = postRes.rows[0]
          postContext = `Bài viết của ${p.author_name}:\nTiêu đề: ${p.title}\nNội dung: ${p.content.slice(0, 500)}`
        }
      }

      const systemPrompt = `Bạn là bot "${bot.display_name}" (@${bot.username}) trên PU Connector.
Vai trò: ${roleStr}. Khoa: ${bot.faculty || 'Đại cương'}, Ngành: ${bot.major || 'Đại cương'}.
Giọng điệu: ${bot.tone || 'tự nhiên, thân thiện'}.
Linh hồn / Persona (Soul): ${bot.soul || 'Sinh viên cởi mở, tích cực'}.
Nhiệm vụ: Viết 1 bình luận ngắn (1 - 2 câu) phản hồi tự nhiên cho bài viết.
Chỉ trả về trực tiếp nội dung bình luận, không bọc dấu ngoặc kép.`
      const userPrompt = `${postContext}\n${input.prompt ? `Gợi ý thêm: ${input.prompt}` : ''}\nHãy viết một bình luận phù hợp:`

      try {
        const { text } = await this.llm.complete([
          { role: 'system', content: systemPrompt },
          { role: 'user', content: userPrompt }
        ])
        return { content: text.replace(/^"|"$/g, '').trim() }
      } catch (err) {
        this.logger.error('LLM generate comment failed', err)
        return { content: 'Cảm ơn bạn đã chia sẻ bài viết rất hữu ích nhé!' }
      }
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

  // ACID Transaction: update control row & write audit log
  async setControl(adminId: string, input: AdminBotControlInput) {
    await this.db.transaction(async (client) => {
      await client.query(
        `UPDATE bot_control SET
           enabled = COALESCE($1, enabled), speed = COALESCE($2, speed), ai_model = COALESCE($3, ai_model),
           ai_base_url = CASE WHEN $4 THEN $5 ELSE ai_base_url END,
           updated_by = $6, updated_at = NOW()
         WHERE id = 1`,
        [input.enabled ?? null, input.speed ?? null, input.aiModel ?? null, input.aiBaseUrl !== undefined, input.aiBaseUrl ?? null, adminId]
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
           max_posts_per_day = COALESCE($8, max_posts_per_day),
           max_comments_per_day = COALESCE($9, max_comments_per_day), max_likes_per_day = COALESCE($10, max_likes_per_day),
           updated_by = $11, updated_at = NOW()
         WHERE user_id = $1`,
        [
          bot.rows[0].id,
          input.enabled ?? null,
          input.topics ?? null,
          input.canPost ?? null,
          input.canComment ?? null,
          input.canLike ?? null,
          input.interactHumans ?? null,
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

  // Mật khẩu chung của bot: daemon đăng nhập bằng cùng giá trị (BOT_PASSWORD); dev local dùng mặc định
  private botPassword() {
    const pw = process.env.BOT_PASSWORD || (process.env.NODE_ENV === 'production' ? '' : 'BotPassword@123')
    if (!pw) throw new BadRequestException('Thiếu BOT_PASSWORD trên server, chưa thể tạo bot')
    return pw
  }

  // ACID Transaction: tạo user (is_bot) + hồ sơ bot (mặc định sẵn sàng hoạt động) + audit
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
      await client.query(
        `INSERT INTO bot_profiles (user_id, tone, major, soul, updated_by, enabled, can_post, can_comment, can_like, interact_humans, max_posts_per_day, max_comments_per_day, max_likes_per_day)
         VALUES ($1, $2, $3, $4, $5, true, true, true, true, true, 10, 30, 50)`,
        [user.rows[0].id, input.tone ?? '', input.major ?? '', input.soul ?? '', adminId]
      )
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
      await client.query(`UPDATE bot_profiles SET tone = COALESCE($2, tone), major = COALESCE($3, major), soul = COALESCE($4, soul), updated_by = $5, updated_at = NOW() WHERE user_id = $1`, [
        bot.rows[0].id,
        input.tone ?? null,
        input.major ?? null,
        input.soul ?? null,
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

  // Hủy lệnh chờ của 1 bot
  private async cancelPendingOf(client: PoolClient, username: string) {
    await client.query(`UPDATE bot_commands SET status = 'cancelled', result = 'Bot đã bị xóa', finished_at = NOW() WHERE status = 'pending' AND payload->>'bot' = $1`, [username])
  }

  // Hủy lệnh đang chờ (chưa tới giờ)
  async cancelCommand(adminId: string, id: number) {
    await this.db.transaction(async (client) => {
      const res = await client.query(`UPDATE bot_commands SET status = 'cancelled', result = 'Admin hủy', finished_at = NOW() WHERE id = $1 AND status = 'pending'`, [id])
      if (!res.rowCount) throw new BadRequestException('Lệnh không còn ở trạng thái chờ')
      await writeAudit(client, adminId, { action: 'bot.command_cancel', targetType: 'bot', targetId: String(id) })
    })
    return this.overview()
  }

  // Thực thi trực tiếp lệnh bot trên database (đăng bài, bình luận, thả tim)
  async executeCommand(cmdId: number, type: BotCommandType, payload: any, _adminId?: string) {
    let botRow: any = null
    if (payload.bot) {
      const res = await this.db.query(
        `SELECT u.id, u.username, u.display_name, u.role, u.faculty, p.tone, p.major, p.soul, p.enabled
         FROM users u JOIN bot_profiles p ON p.user_id = u.id
         WHERE u.username = $1 AND u.is_bot`,
        [payload.bot]
      )
      botRow = res.rows[0]
    }
    if (!botRow) {
      const res = await this.db.query(
        `SELECT u.id, u.username, u.display_name, u.role, u.faculty, p.tone, p.major, p.soul, p.enabled
         FROM users u JOIN bot_profiles p ON p.user_id = u.id
         WHERE u.is_bot AND p.enabled
         ORDER BY RANDOM() LIMIT 1`
      )
      botRow = res.rows[0]
    }
    if (!botRow) {
      throw new BadRequestException('Không tìm thấy tài khoản bot đang hoạt động nào')
    }

    let resultStr = 'OK'

    if (type === 'post') {
      let title = payload.title?.trim() || ''
      let content = payload.content?.trim() || ''
      let tags: string[] = ['phenikaa']

      if (!content) {
        const gen = await this.generateContent({ bot: botRow.username, type: 'post', prompt: payload.topic })
        title = title || gen.title || 'Chia sẻ từ ' + botRow.display_name
        content = gen.content
        if (gen.tags?.length) tags = gen.tags
      } else if (payload.enhance === 'ai') {
        const gen = await this.generateContent({ bot: botRow.username, type: 'post', prompt: `Nội dung gốc: ${content}. Hãy viết lại cho sinh động và đúng phong cách.` })
        content = gen.content || content
        if (!title && gen.title) title = gen.title
        if (gen.tags?.length) tags = gen.tags
      }

      if (!title) {
        title = content.slice(0, 50).replace(/\n/g, ' ').trim() + (content.length > 50 ? '...' : '')
      }

      const postRes = await this.db.query(
        `INSERT INTO posts (id, author_id, post_type, title, content, tags, visibility, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, 'general', $2, $3, $4, 'public', NOW(), NOW())
         RETURNING id, title`,
        [botRow.id, title, content, tags]
      )
      const postId = postRes.rows[0].id
      resultStr = `Đã đăng bài: "${title}" (ID: ${postId})`

      await this.db.query(
        `INSERT INTO bot_activity (bot_username, action, details, level, created_at)
         VALUES ($1, 'post', $2, 'info', NOW())`,
        [botRow.username, `Đã đăng bài: "${title}"`]
      )
    } else if (type === 'comment') {
      if (!payload.postId) throw new BadRequestException('Thiếu ID bài viết để bình luận')
      let text = payload.content?.trim() || ''
      if (!text) {
        const gen = await this.generateContent({ bot: botRow.username, type: 'comment', postId: payload.postId })
        text = gen.content
      } else if (payload.enhance === 'ai') {
        const gen = await this.generateContent({ bot: botRow.username, type: 'comment', postId: payload.postId, prompt: `Nội dung: ${text}` })
        text = gen.content || text
      }

      await this.db.query(
        `INSERT INTO comments (id, post_id, author_id, content, created_at, updated_at)
         VALUES (gen_random_uuid(), $1, $2, $3, NOW(), NOW())`,
        [payload.postId, botRow.id, text]
      )
      await this.db.query(`UPDATE posts SET comments_count = (SELECT COUNT(*) FROM comments WHERE post_id = $1) WHERE id = $1`, [payload.postId])

      resultStr = `Đã bình luận vào bài ${payload.postId.slice(0, 8)}…`
      await this.db.query(
        `INSERT INTO bot_activity (bot_username, action, details, level, created_at)
         VALUES ($1, 'comment', $2, 'info', NOW())`,
        [botRow.username, `Bình luận vào bài ${payload.postId.slice(0, 8)}…: "${text.slice(0, 60)}…"`]
      )
    } else if (type === 'like') {
      if (!payload.postId) throw new BadRequestException('Thiếu ID bài viết để thả tim')
      await this.db.query(
        `INSERT INTO post_reactions (post_id, user_id, reaction, created_at)
         VALUES ($1, $2, 'like', NOW())
         ON CONFLICT (post_id, user_id) DO NOTHING`,
        [payload.postId, botRow.id]
      )
      await this.db.query(`UPDATE posts SET likes_count = (SELECT COUNT(*) FROM post_reactions WHERE post_id = $1) WHERE id = $1`, [payload.postId])

      resultStr = `Đã thả tim bài ${payload.postId.slice(0, 8)}…`
      await this.db.query(
        `INSERT INTO bot_activity (bot_username, action, details, level, created_at)
         VALUES ($1, 'like', $2, 'info', NOW())`,
        [botRow.username, `Thả tim bài viết ${payload.postId.slice(0, 8)}…`]
      )
    }

    await this.db.query(
      `UPDATE bot_commands SET status = 'done', result = $2, finished_at = NOW() WHERE id = $1`,
      [cmdId, resultStr]
    )
  }

  // Quét và thực thi các lệnh hẹn giờ đã đến hạn
  async processPendingCommands() {
    try {
      const due = await this.db.query(
        `UPDATE bot_commands SET status = 'running'
         WHERE id = (SELECT id FROM bot_commands WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
         RETURNING id, type, payload`
      )
      const cmd = due.rows[0]
      if (!cmd) return
      try {
        await this.executeCommand(cmd.id, cmd.type, cmd.payload)
      } catch (err: any) {
        this.logger.error(`Lệnh #${cmd.id} thất bại: ${err.message}`, err)
        await this.db.query(
          `UPDATE bot_commands SET status = 'failed', result = $2, finished_at = NOW() WHERE id = $1`,
          [cmd.id, String(err?.message || 'Lỗi không xác định').slice(0, 300)]
        )
        await this.db.query(
          `INSERT INTO bot_activity (bot_username, action, details, level, created_at)
           VALUES ($1, 'error', $2, 'error', NOW())`,
          [cmd.payload?.bot || '', `Lệnh #${cmd.id} (${cmd.type}) lỗi: ${err.message}`]
        )
      }
    } catch (err) {
      this.logger.error('processPendingCommands error', err)
    }
  }

  // Giao lệnh cho bot: chạy ngay hoặc lên lịch
  async enqueue(adminId: string, input: AdminBotCommandInput) {
    const { type, scheduledAt, ...payload } = input
    const isNow = !scheduledAt || new Date(scheduledAt).getTime() <= Date.now()

    let commandId: number = 0
    await this.db.transaction(async (client) => {
      if (input.bot) {
        const found = await client.query(`SELECT 1 FROM users WHERE is_bot AND username = $1`, [input.bot])
        if (!found.rowCount) throw new BadRequestException(`Không phải bot: ${input.bot}`)
      }
      await client.query(`SELECT 1 FROM bot_control WHERE id = 1 FOR UPDATE`)
      const pending = await client.query(`SELECT COUNT(*)::int AS n FROM bot_commands WHERE status IN ('pending', 'running')`)
      if (pending.rows[0].n >= MAX_PENDING_COMMANDS) throw new BadRequestException('Hàng đợi lệnh đầy, chờ bot xử lý xong')

      const initialStatus = isNow ? 'running' : 'pending'
      const res = await client.query(
        `INSERT INTO bot_commands (type, payload, status, created_by, scheduled_at)
         VALUES ($1, $2, $3, $4, COALESCE($5::timestamptz, NOW())) RETURNING id`,
        [type, JSON.stringify(payload), initialStatus, adminId, scheduledAt ?? null]
      )
      commandId = Number(res.rows[0].id)
      await writeAudit(client, adminId, { action: 'bot.command', targetType: 'bot', targetId: String(commandId), details: { type, scheduledAt, ...payload } })
    })

    if (isNow && commandId) {
      try {
        await this.executeCommand(commandId, type, payload, adminId)
      } catch (err: any) {
        this.logger.error(`Thực thi lệnh #${commandId} thất bại: ${err.message}`, err)
        await this.db.query(
          `UPDATE bot_commands SET status = 'failed', result = $2, finished_at = NOW() WHERE id = $1`,
          [commandId, String(err?.message || 'Lỗi thực thi').slice(0, 300)]
        )
        await this.db.query(
          `INSERT INTO bot_activity (bot_username, action, details, level, created_at)
           VALUES ($1, 'error', $2, 'error', NOW())`,
          [payload.bot || '', `Lệnh #${commandId} (${type}) lỗi: ${err.message}`]
        )
        throw err
      }
    }

    return this.overview()
  }
}
