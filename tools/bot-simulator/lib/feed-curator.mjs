import { sanitizeContent } from './content-sanitizer.mjs'
import { logger } from './logger.mjs'
import { sleep } from './scheduler.mjs'

const TICK_MS = 20_000
const MAX_ATTEMPTS = 3
const MIN_LENGTH = 40
const MAX_LENGTH = 1500

// AI duyệt dữ liệu crawl: new → approved/review (đúng chủ đề, sạch, đã viết lại) | rejected.
// Model do admin chọn (Admin → Bot → AI).
export class FeedCurator {
  constructor(pool, contentGen, policy) {
    this.pool = pool
    this.contentGen = contentGen
    this.policy = policy
    this.running = false
  }

  async start() {
    this.running = true
    while (this.running) {
      await sleep(TICK_MS)
      try {
        while (this.running && (await this.reviewNext())) await sleep(1500)
      } catch (err) {
        logger.error('FeedCurator lỗi:', err)
      }
    }
  }

  stop() {
    this.running = false
  }

  systemPrompt(topics) {
    const list = topics.map((t) => `- ${t.slug}: ${t.label} (từ khóa: ${t.keywords.join(', ')})`).join('\n')
    return `Bạn là biên tập viên nội dung cho mạng xã hội học thuật của Đại học Phenikaa. Nhận 1 bài thô lấy từ nhóm Facebook sinh viên và quyết định có đăng lại không.

CHỦ ĐỀ ĐƯỢC PHÉP:
${list}

CHỈ NHẬN bài có thông tin hữu ích, kiểm chứng được và thuộc đúng 1 chủ đề trên (thông báo/lịch/quy định/sự kiện của trường, khoa, CLB; học bổng; học tập, thi cử; kiến thức; thực tập, việc làm chính thống).
TỪ CHỐI (accept=false): tố cáo, bóc phốt, bàn tán về cá nhân; tin đồn chưa kiểm chứng; drama; tâm sự, crush, hẹn hò; mua bán, rao vặt, quảng cáo, tuyển người đáng ngờ, lừa đảo; tìm đồ thất lạc; chính trị, tôn giáo, nội dung người lớn; câu hỏi nhờ giúp riêng; bài chứa thông tin định danh cá nhân; bài không thuộc chủ đề nào hoặc thiếu thông tin để hiểu.
NẾU NHẬN: viết lại thành bài đăng trung lập, giọng thông báo, tiếng Việt chuẩn. Giữ NGUYÊN dữ kiện (ngày giờ, địa điểm, điều kiện, hạn chót), KHÔNG thêm thông tin, KHÔNG nhắc Facebook/nhóm/người đăng, KHÔNG tên riêng của cá nhân, SĐT, email. Dài ${MIN_LENGTH}–1200 ký tự.

Trả về DUY NHẤT một JSON: {"accept": true|false, "topic": "<slug hoặc null>", "reason": "<ngắn gọn>", "content": "<bài viết lại, rỗng nếu từ chối>"}`
  }

  // Trả true nếu đã xử lý 1 bài (để vòng lặp xử lý tiếp)
  async reviewNext() {
    const { rows } = await this.pool.query(`SELECT id, raw_content, attempts FROM bot_feed_items WHERE status = 'new' AND attempts < $1 ORDER BY id LIMIT 1`, [MAX_ATTEMPTS])
    const item = rows[0]
    if (!item) return false

    await this.policy.load()
    const topics = [...this.policy.topics.values()]
    if (!topics.length) return false // chưa có chủ đề nào được bật ⇒ chưa thể phân loại

    const model = this.contentGen.model
    const raw = await this.contentGen.generateWithLLM(String(item.raw_content).slice(0, 4000), this.systemPrompt(topics), { temperature: 0.1 })
    const verdict = this.parse(raw)

    if (!verdict) {
      // AI lỗi/trả sai định dạng: thử lại sau, quá số lần thì bỏ qua
      const attempts = item.attempts + 1
      await this.pool.query(
        `UPDATE bot_feed_items SET attempts = $2, status = $3, verdict = $4 WHERE id = $1`,
        [item.id, attempts, attempts >= MAX_ATTEMPTS ? 'skipped' : 'new', JSON.stringify({ reason: 'AI không trả kết quả hợp lệ', model })]
      )
      return false
    }

    const content = sanitizeContent(verdict.content)
    const topic = topics.find((t) => t.slug === verdict.topic)
    const accepted = verdict.accept === true && topic && content.length >= MIN_LENGTH && content.length <= MAX_LENGTH
    const reason = verdict.accept === true && !accepted ? 'AI chấp nhận nhưng thiếu chủ đề hợp lệ/nội dung không đạt độ dài' : String(verdict.reason ?? '').slice(0, 300)

    if (!accepted) {
      await this.pool.query(`UPDATE bot_feed_items SET status = 'rejected', verdict = $2 WHERE id = $1`, [item.id, JSON.stringify({ reason, model })])
      logger.info(`Duyệt #${item.id}: từ chối — ${reason}`)
      return true
    }

    const { rows: control } = await this.pool.query(`SELECT feed_review FROM bot_control WHERE id = 1`)
    const status = control[0]?.feed_review ? 'review' : 'approved'
    await this.pool.query(`UPDATE bot_feed_items SET status = $2, content = $3, topic = $4, verdict = $5 WHERE id = $1`, [item.id, status, content, topic.slug, JSON.stringify({ reason, model })])
    logger.info(`Duyệt #${item.id}: ${status} [${topic.slug}]`)
    return true
  }

  parse(raw) {
    const match = raw?.match(/\{[\s\S]*\}/)
    if (!match) return null
    try {
      return JSON.parse(match[0])
    } catch {
      return null
    }
  }
}
