import { Injectable, Logger, OnModuleDestroy, OnModuleInit } from '@nestjs/common'
import type { CreatePostInput } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { LlmService } from '../../ai/llm.service'
import { CommentsService } from '../../posts/comments.service'
import { PostsService } from '../../posts/posts.service'

const TICK_MS = 15_000
const PUBLISH_PER_TICK = 5
const ENGAGE_PER_TICK = 5
// Chờ một chút cho bot trả lời tự nhiên hơn; chỉ xử lý bình luận gần đây
const REPLY_DELAY_SEC = 20
const COMMENT_WINDOW_DAYS = 7
// Trần số bình luận bot trên mỗi bài ⇒ chặn tranh luận dài vô tận và chi phí AI
const MAX_REPLIES_PER_POST = 20
const STALE_POSTING_MIN = 5

// Chạy job bằng một vòng lặp duy nhất: (1) đăng bài đến hạn, (2) trả lời/thả tim bình luận ở bài của job
@Injectable()
export class BotJobRunner implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotJobRunner.name)
  private timer: NodeJS.Timeout | null = null
  private busy = false

  constructor(
    private readonly db: DatabaseService,
    private readonly posts: PostsService,
    private readonly comments: CommentsService,
    private readonly llm: LlmService
  ) {}

  async onModuleInit() {
    // Bài kẹt 'posting' (API tắt giữa chừng) ⇒ đánh lỗi, không đăng lại để tránh trùng
    await this.db
      .query(`UPDATE bot_job_posts SET status = 'failed', error = 'Bị gián đoạn khi đăng, kiểm tra bảng tin rồi thử lại' WHERE status = 'posting' AND scheduled_at < NOW() - make_interval(mins => $1)`, [STALE_POSTING_MIN])
      .catch((err) => this.logger.warn(`Dọn bài kẹt lỗi: ${err.message}`))
    this.timer = setInterval(() => void this.tick(), TICK_MS)
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer)
  }

  async tick() {
    if (this.busy) return
    this.busy = true
    try {
      await this.publishDue()
      await this.engage()
    } catch (err: any) {
      this.logger.error(`Vòng chạy job lỗi: ${err?.message}`, err?.stack)
    } finally {
      this.busy = false
    }
  }

  // Nhận từng bài đến hạn của job đang chạy (SKIP LOCKED) rồi đăng qua PostsService như người thật
  private async publishDue() {
    for (let i = 0; i < PUBLISH_PER_TICK; i++) {
      const claimed = await this.db.query(
        `UPDATE bot_job_posts p SET status = 'posting'
         FROM bot_jobs j
         WHERE j.id = p.job_id AND p.id = (
           SELECT p2.id FROM bot_job_posts p2 JOIN bot_jobs j2 ON j2.id = p2.job_id
           WHERE p2.status = 'pending' AND p2.scheduled_at <= NOW() AND j2.status = 'active'
           ORDER BY p2.scheduled_at, p2.id FOR UPDATE OF p2 SKIP LOCKED LIMIT 1
         )
         RETURNING p.id, p.data, j.bot_id`
      )
      const item = claimed.rows[0]
      if (!item) return
      try {
        const post = await this.posts.create(item.bot_id, {
          targetAudience: 'everyone',
          attachedDocumentIds: [],
          isAnonymous: false,
          ...item.data
        } as CreatePostInput)
        await this.db.query(`UPDATE bot_job_posts SET status = 'posted', post_id = $2, posted_at = NOW(), error = NULL WHERE id = $1`, [item.id, post.id])
      } catch (err: any) {
        this.logger.warn(`Đăng bài job #${item.id} lỗi: ${err?.message}`)
        await this.db.query(`UPDATE bot_job_posts SET status = 'failed', error = $2 WHERE id = $1`, [item.id, String(err?.message ?? 'Lỗi không xác định').slice(0, 300)])
      }
    }
  }

  // Bình luận mới của người thật ở bài job đã đăng, chưa xử lý ⇒ thả tim và/hoặc trả lời theo cấu hình job
  private async engage() {
    const pending = await this.db.query(
      `SELECT c.id, c.post_id, c.content, j.id AS job_id, j.bot_id, j.auto_reply, j.auto_react,
              p.title AS post_title, p.content AS post_content, a.display_name AS author_name
       FROM bot_job_posts jp
       JOIN bot_jobs j ON j.id = jp.job_id AND j.status = 'active' AND (j.auto_reply OR j.auto_react)
       JOIN posts p ON p.id = jp.post_id AND p.hidden_at IS NULL
       JOIN comments c ON c.post_id = p.id
       JOIN users a ON a.id = c.author_id
       WHERE jp.status = 'posted' AND NOT a.is_bot
         AND c.created_at > NOW() - make_interval(days => $1) AND c.created_at < NOW() - make_interval(secs => $2)
         AND NOT EXISTS (SELECT 1 FROM bot_job_handled h WHERE h.comment_id = c.id)
       ORDER BY c.created_at LIMIT $3`,
      [COMMENT_WINDOW_DAYS, REPLY_DELAY_SEC, ENGAGE_PER_TICK]
    )
    for (const c of pending.rows) {
      // Ghi trước để mỗi bình luận chỉ xử lý một lần, kể cả khi bước sau lỗi
      const claim = await this.db.query(`INSERT INTO bot_job_handled (comment_id, job_id) VALUES ($1, $2) ON CONFLICT DO NOTHING RETURNING comment_id`, [c.id, c.job_id])
      if (!claim.rowCount) continue
      const done = { replied: false, reacted: false, error: null as string | null }
      try {
        if (c.auto_react) done.reacted = await this.react(c.id, c.bot_id)
        if (c.auto_reply) done.replied = await this.reply(c)
      } catch (err: any) {
        done.error = String(err?.message ?? 'Lỗi không xác định').slice(0, 300)
        this.logger.warn(`Bot tương tác bình luận ${c.id} lỗi: ${done.error}`)
      }
      await this.db.query(`UPDATE bot_job_handled SET replied = $2, reacted = $3, error = $4 WHERE comment_id = $1`, [c.id, done.replied, done.reacted, done.error])
    }
  }

  // toggleLike đảo trạng thái ⇒ chỉ gọi khi bot chưa thích
  private async react(commentId: string, botId: string) {
    const liked = await this.db.query(`SELECT 1 FROM comment_reactions WHERE comment_id = $1 AND user_id = $2`, [commentId, botId])
    if (liked.rowCount) return false
    await this.comments.toggleLike(commentId, botId)
    return true
  }

  // AI trả lời theo persona của bot; trả "SKIP" khi bình luận không cần đáp (spam, chỉ icon...)
  private async reply(c: { id: string; post_id: string; content: string; bot_id: string; post_title: string; post_content: string; author_name: string }) {
    const count = await this.db.query(`SELECT COUNT(*)::int AS n FROM comments WHERE post_id = $1 AND author_id = $2`, [c.post_id, c.bot_id])
    if (count.rows[0].n >= MAX_REPLIES_PER_POST) return false

    const bot = await this.db.query(
      `SELECT u.display_name, u.role, u.faculty, u.bio, p.tone, p.major, p.soul FROM users u LEFT JOIN bot_profiles p ON p.user_id = u.id WHERE u.id = $1`,
      [c.bot_id]
    )
    const b = bot.rows[0]
    if (!b) return false
    const role = b.role === 'lecturer' ? 'Giảng viên' : b.role === 'ta' ? 'Trợ giảng' : 'Sinh viên'
    const system = [
      `Bạn là "${b.display_name}" (${role}${b.faculty ? `, khoa ${b.faculty}` : ''}${b.major ? `, ngành ${b.major}` : ''}) trên mạng xã hội sinh viên Đại học Phenikaa.`,
      b.bio && `Giới thiệu: ${b.bio}`,
      b.tone && `Giọng điệu: ${b.tone}`,
      b.soul && `Tính cách & phong cách: ${b.soul}`,
      'Bạn là tác giả của bài viết dưới đây và đang trả lời bình luận của một bạn đọc.',
      'Viết 1–2 câu tiếng Việt tự nhiên, đúng vai, không giới thiệu bản thân là AI hay bot, không dùng ngoặc kép. Không bịa thông tin ngoài nội dung bài.',
      'Nếu bình luận là spam, quảng cáo hoặc không cần đáp, chỉ trả về đúng một từ: SKIP.'
    ]
      .filter(Boolean)
      .join('\n')
    const user = `Bài viết${c.post_title ? ` "${c.post_title}"` : ''}:\n${String(c.post_content).slice(0, 1500)}\n\nBình luận của ${c.author_name}:\n${String(c.content).slice(0, 600)}`

    const { text } = await this.llm.complete(
      [
        { role: 'system', content: system },
        { role: 'user', content: user }
      ],
      300
    )
    const reply = text.replace(/^"|"$/g, '').trim()
    if (!reply || /^skip\b/i.test(reply)) return false
    await this.comments.create(c.bot_id, { postId: c.post_id, parentId: c.id, content: reply, mediaUrls: [], isAnonymous: false })
    return true
  }
}
