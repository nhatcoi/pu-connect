import { logger } from './logger.mjs'
import { sleep } from './scheduler.mjs'

const TICK_MS = 30_000
const EMPTY_QUEUE_RECHECK_MS = 5 * 60_000
const QUIET_RECHECK_MS = 10 * 60_000

const vnHour = () => (new Date().getUTCHours() + 7) % 24

// Đăng bài đã được AI duyệt (status 'approved') từ hàng đợi bot_feed_items: các bot feed_poster thay phiên, mỗi 30–120 phút/bài, không đăng trùng
export class FeedPoster {
  constructor(pool, scheduler, config, policy) {
    this.pool = pool
    this.scheduler = scheduler
    this.policy = policy
    this.cfg = config.feedPosting
    this.running = false
    this.nextAt = 0
  }

  async start() {
    this.running = true
    // Khởi động lại không đăng dồn: tính mốc tiếp theo từ lần đăng gần nhất
    const last = await this.pool.query(`SELECT MAX(posted_at) AS t FROM bot_feed_items WHERE status = 'posted'`)
    const lastAt = last.rows[0].t ? new Date(last.rows[0].t).getTime() : 0
    this.nextAt = Math.max(Date.now() + 10_000, lastAt + this.randomInterval())

    while (this.running) {
      await sleep(TICK_MS)
      try {
        await this.tick()
      } catch (err) {
        logger.error('FeedPoster lỗi:', err)
      }
    }
  }

  stop() {
    this.running = false
  }

  randomInterval() {
    const { minMinutes, maxMinutes } = this.cfg
    return (minMinutes + Math.random() * (maxMinutes - minMinutes)) * 60_000
  }

  async tick() {
    const { rows } = await this.pool.query(`SELECT feed_enabled FROM bot_control WHERE id = 1`)
    if (!rows[0]?.feed_enabled || Date.now() < this.nextAt) return

    const { from, to } = this.cfg.quietHoursVN
    if (vnHour() >= from && vnHour() < to) {
      this.nextAt = Date.now() + QUIET_RECHECK_MS
      return
    }

    const posted = await this.scheduler.runExclusive(() => this.postNext())
    this.nextAt = Date.now() + (posted ? this.randomInterval() : EMPTY_QUEUE_RECHECK_MS)
  }

  // Bot kế tiếp trong danh sách bot đăng bài feed (admin bật ở hồ sơ bot), thay phiên theo người đăng gần nhất
  async pickPoster() {
    await this.policy.load()
    const last = await this.pool.query(`SELECT posted_by FROM bot_feed_items WHERE status = 'posted' ORDER BY posted_at DESC LIMIT 1`)
    const bots = this.policy.feedPosters().filter((b) => this.scheduler.clients.has(b))
    if (!bots.length) throw new Error('Chưa có bot nào được bật "đăng bài từ dữ liệu crawl"')
    const idx = bots.indexOf(last.rows[0]?.posted_by)
    return bots[(idx + 1) % bots.length]
  }

  // Trả true nếu đã đăng
  async postNext() {
    // Một daemon duy nhất tiêu thụ hàng đợi: lấy bài cũ nhất, đánh dấu đã đăng sau khi tạo bài thành công
    const claimed = await this.pool.query(
      `SELECT id, content, image_urls FROM bot_feed_items WHERE status = 'approved' ORDER BY id LIMIT 1`
    )
    const item = claimed.rows[0]
    if (!item) return false

    const username = await this.pickPoster()
    const client = this.scheduler.clients.get(username)
    try {
      const post = await client.createPost({ content: item.content, mediaUrls: item.image_urls })
      await this.pool.query(`UPDATE bot_feed_items SET status = 'posted', posted_by = $2, post_id = $3, posted_at = NOW() WHERE id = $1`, [item.id, username, post?.id ?? null])
      this.scheduler.stats.postsCount++
      logger.action(username, 'Feed Post', `"${item.content.slice(0, 60).replace(/\s+/g, ' ')}…" [Ảnh: ${item.image_urls.length}]`)
      return true
    } catch (err) {
      // Lỗi nhiều lần ⇒ bỏ qua bài này để không kẹt hàng đợi
      await this.pool.query(
        `UPDATE bot_feed_items SET attempts = attempts + 1, status = CASE WHEN attempts + 1 >= $2 THEN 'skipped' ELSE status END WHERE id = $1`,
        [item.id, this.cfg.maxAttempts]
      )
      logger.error(`Đăng bài feed #${item.id} thất bại:`, err)
      return false
    }
  }
}
