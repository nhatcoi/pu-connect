import { logger } from './logger.mjs'

const POLL_MS = 3_000
const HEARTBEAT_MS = 10_000
const FLUSH_MS = 2_000
const PRUNE_MS = 6 * 60 * 60_000
const ACTIVITY_RETENTION_DAYS = 7

// Vòng lặp không chồng lấp: chờ fn xong rồi mới hẹn lần kế tiếp
function every(ms, fn) {
  let stopped = false
  let timer
  const run = async () => {
    try {
      await fn()
    } catch (err) {
      console.error('control-sync loop error:', err.message)
    }
    if (!stopped) timer = setTimeout(run, ms)
  }
  timer = setTimeout(run, 0)
  return () => {
    stopped = true
    clearTimeout(timer)
  }
}

// Cầu nối Admin ↔ daemon qua DB: trạng thái bật/tắt, tốc độ, lệnh thủ công, heartbeat, nhật ký
export class ControlSync {
  constructor(pool, scheduler) {
    this.pool = pool
    this.scheduler = scheduler
    this.buffer = []
    this.cancel = []
  }

  async start() {
    await this.pool.query(`UPDATE bot_commands SET status = 'failed', result = 'Daemon khởi động lại', finished_at = NOW() WHERE status = 'running'`)
    // Bài crawl đã giao cho lệnh không còn chờ/chạy ⇒ trả về hàng sẵn đăng
    await this.pool.query(
      `UPDATE bot_feed_items SET status = 'approved' WHERE status = 'scheduled'
         AND id::text NOT IN (SELECT payload->>'feedItemId' FROM bot_commands WHERE status IN ('pending', 'running') AND payload ? 'feedItemId')`
    )
    await this.pool.query(`UPDATE bot_control SET started_at = NOW(), heartbeat_at = NOW() WHERE id = 1`)
    logger.setSink((entry) => this.buffer.push(entry))

    let lastBeat = 0
    this.cancel = [
      every(POLL_MS, async () => {
        await this.pullControl()
        if (Date.now() - lastBeat >= HEARTBEAT_MS) {
          lastBeat = Date.now()
          await this.heartbeat()
        }
      }),
      every(POLL_MS, () => this.runNextCommand()),
      every(FLUSH_MS, () => this.flushActivity()),
      every(PRUNE_MS, () => this.prune())
    ]
  }

  async stop() {
    this.cancel.forEach((c) => c())
    logger.setSink(null)
    await this.flushActivity()
    // heartbeat NULL ⇒ Admin hiện Offline ngay
    await this.pool.query(`UPDATE bot_control SET heartbeat_at = NULL WHERE id = 1`).catch(() => {})
  }

  async pullControl() {
    const { rows } = await this.pool.query(`SELECT enabled, speed, ai_model, ai_base_url FROM bot_control WHERE id = 1`)
    const { enabled, speed, ai_model: model, ai_base_url: baseUrl } = rows[0]
    this.scheduler.contentGen.setAi({ model, baseUrl })
    if (this.scheduler.isPaused === enabled) logger.info(enabled ? 'Admin bật mô phỏng' : 'Admin tạm dừng mô phỏng')
    this.scheduler.isPaused = !enabled
    this.scheduler.speed = speed
  }

  async heartbeat() {
    const { startedAt, ...counters } = this.scheduler.stats
    await this.pool.query(`UPDATE bot_control SET heartbeat_at = NOW(), stats = $1 WHERE id = 1`, [JSON.stringify(counters)])
  }

  // Nhận 1 lệnh (SKIP LOCKED) và chạy qua scheduler để không đè lên vòng tự động
  async runNextCommand() {
    const claimed = await this.pool.query(
      `UPDATE bot_commands SET status = 'running'
       WHERE id = (SELECT id FROM bot_commands WHERE status = 'pending' AND scheduled_at <= NOW() ORDER BY scheduled_at, id FOR UPDATE SKIP LOCKED LIMIT 1)
       RETURNING id, type, payload`
    )
    const cmd = claimed.rows[0]
    if (!cmd) return

    let status = 'done'
    let result = 'OK'
    try {
      await this.scheduler.runExclusive(() => this.execute(cmd))
    } catch (err) {
      status = 'failed'
      result = String(err.message || err).slice(0, 500)
      logger.error(`Lệnh #${cmd.id} (${cmd.type}) lỗi:`, err)
      if (cmd.payload.feedItemId) await this.pool.query(`UPDATE bot_feed_items SET status = 'approved' WHERE id = $1 AND status = 'scheduled'`, [cmd.payload.feedItemId])
    }
    await this.pool.query(`UPDATE bot_commands SET status = $2, result = $3, finished_at = NOW() WHERE id = $1`, [cmd.id, status, result])
  }

  async execute({ type, payload: p }) {
    const { scheduler } = this
    if (p.bot && !scheduler.clients.has(p.bot)) throw new Error(`Bot không tồn tại trong daemon: ${p.bot}`)

    switch (type) {
      case 'post':
        if (p.feedItemId) return this.postFeedItem(p)
        if (p.content) return scheduler.executeAdminPost(p.bot, { title: p.title, content: p.content, enhance: p.enhance })
        return scheduler.executePost(p.bot, p.topic)
      case 'comment':
        if (p.content) return scheduler.executeAdminComment(p.bot, p.postId, p.content, p.enhance)
        return scheduler.executeCommentFeed(p.postId, p.bot)
      case 'like':
        return scheduler.executeLike(p.bot, p.postId)
      default:
        throw new Error(`Lệnh không hỗ trợ: ${type}`)
    }
  }

  // Đăng bài crawl do admin giao (đã giữ ở trạng thái 'scheduled'), đánh dấu 'posted' khi xong
  async postFeedItem(p) {
    const { rows } = await this.pool.query(`SELECT content, image_urls FROM bot_feed_items WHERE id = $1 AND status = 'scheduled'`, [p.feedItemId])
    if (!rows[0]) throw new Error('Bài crawl không còn ở trạng thái đã hẹn')
    const post = await this.scheduler.executeAdminPost(p.bot, { title: p.title, content: rows[0].content, imageUrls: rows[0].image_urls, enhance: p.enhance })
    await this.pool.query(`UPDATE bot_feed_items SET status = 'posted', posted_by = $2, post_id = $3, posted_at = NOW() WHERE id = $1`, [p.feedItemId, p.bot, post?.id ?? null])
  }

  // Ghi hàng loạt 1 câu SQL (unnest) thay vì mỗi dòng 1 query
  async flushActivity() {
    if (!this.buffer.length) return
    const batch = this.buffer.splice(0)
    try {
      await this.pool.query(
        `INSERT INTO bot_activity (bot_username, action, details, level)
         SELECT * FROM unnest($1::text[], $2::text[], $3::text[], $4::text[])`,
        [batch.map((e) => e.bot), batch.map((e) => e.action), batch.map((e) => String(e.details).slice(0, 500)), batch.map((e) => e.level)]
      )
    } catch (err) {
      console.error('flushActivity lỗi:', err.message)
    }
  }

  async prune() {
    await this.pool.query(`DELETE FROM bot_activity WHERE created_at < NOW() - make_interval(days => $1)`, [ACTIVITY_RETENTION_DAYS])
    await this.pool.query(`DELETE FROM bot_commands WHERE finished_at < NOW() - INTERVAL '30 days'`)
  }
}
