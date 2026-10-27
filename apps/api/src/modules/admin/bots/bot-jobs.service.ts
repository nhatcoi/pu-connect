import { createHash } from 'node:crypto'
import { BadRequestException, ConflictException, Injectable, Logger, NotFoundException } from '@nestjs/common'
import type {
  AdminBotJob,
  AdminBotJobDetail,
  AdminBotJobInput,
  AdminBotJobPatch,
  AdminBotJobPost,
  BotImportResult,
  BotImportRowResult,
  BotImportRowStatus,
  BotJobPostStatus
} from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { StorageService } from '../../storage/storage.service'
import { writeAudit } from '../admin-audit'
import { iso } from '../admin-paging'
import { fetchImage } from '../bot-import/import-image-fetcher'
import { BotRowSchema, type BotRow } from '../dto/admin-bots.dto'

const MAX_AHEAD_MS = 365 * 24 * 3600_000
const DEFAULT_SPACING_MIN = 30

type Prepared = { index: number; row: BotRow; hash: string; courseId: string | null; runAt: Date }

const JOB_SELECT = `
  SELECT j.id, j.name, j.auto_reply, j.auto_react, j.status, j.created_at, u.username AS bot_username, u.display_name AS bot_name,
         c.pending, c.posting, c.posted, c.failed, c.next_at, h.replies, h.reactions
  FROM bot_jobs j
  JOIN users u ON u.id = j.bot_id
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE status = 'pending')::int AS pending, COUNT(*) FILTER (WHERE status = 'posting')::int AS posting,
           COUNT(*) FILTER (WHERE status = 'posted')::int AS posted, COUNT(*) FILTER (WHERE status = 'failed')::int AS failed,
           MIN(scheduled_at) FILTER (WHERE status = 'pending') AS next_at
    FROM bot_job_posts WHERE job_id = j.id
  ) c ON TRUE
  LEFT JOIN LATERAL (
    SELECT COUNT(*) FILTER (WHERE replied)::int AS replies, COUNT(*) FILTER (WHERE reacted)::int AS reactions
    FROM bot_job_handled WHERE job_id = j.id
  ) h ON TRUE`

const mapJob = (r: any): AdminBotJob => ({
  id: r.id,
  name: r.name,
  botUsername: r.bot_username,
  botName: r.bot_name,
  autoReply: r.auto_reply,
  autoReact: r.auto_react,
  status: r.status,
  createdAt: iso(r.created_at)!,
  counts: { pending: r.pending, posting: r.posting, posted: r.posted, failed: r.failed },
  replies: r.replies,
  reactions: r.reactions,
  nextAt: iso(r.next_at)
})

// Hash nội dung đã chuẩn hóa ⇒ nhập lại cùng bài không đăng trùng
const hashOf = (content: string) => createHash('sha1').update(content.toLowerCase().replace(/\s+/g, ' ').trim()).digest('hex')

// Job = một lô bài (Excel/JSON) giao cho một bot đăng theo lịch + bật/tắt tự trả lời/thả tim
@Injectable()
export class BotJobsService {
  private readonly logger = new Logger(BotJobsService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService
  ) {}

  async list(): Promise<AdminBotJob[]> {
    const res = await this.db.query(`${JOB_SELECT} ORDER BY j.created_at DESC`)
    return res.rows.map(mapJob)
  }

  async detail(id: string): Promise<AdminBotJobDetail> {
    const [job, posts] = await Promise.all([
      this.db.query(`${JOB_SELECT} WHERE j.id = $1`, [id]),
      this.db.query(
        `SELECT id, data, scheduled_at, status, error, post_id, posted_at FROM bot_job_posts WHERE job_id = $1 ORDER BY scheduled_at, id`,
        [id]
      )
    ])
    if (!job.rowCount) throw new NotFoundException('Job không tồn tại')
    return {
      ...mapJob(job.rows[0]),
      posts: posts.rows.map(
        (r): AdminBotJobPost => ({
          id: String(r.id),
          title: r.data.title ?? '',
          content: r.data.content,
          postType: r.data.postType ?? 'general',
          tags: r.data.tags ?? [],
          mediaUrls: r.data.mediaUrls ?? [],
          scheduledAt: iso(r.scheduled_at)!,
          status: r.status as BotJobPostStatus,
          error: r.error,
          postId: r.post_id,
          postedAt: iso(r.posted_at)
        })
      )
    }
  }

  // Kiểm tra từng dòng (dryRun ⇒ chỉ báo kết quả); hợp lệ ⇒ tạo job + xếp lịch cả lô trong một transaction
  async create(adminId: string, input: AdminBotJobInput): Promise<BotImportResult> {
    const bot = await this.db.query(`SELECT id FROM users WHERE username = $1 AND is_bot`, [input.bot])
    if (!bot.rowCount) throw new BadRequestException(`Không phải bot: ${input.bot}`)

    const results: BotImportRowResult[] = []
    const prepared = await this.prepare(input, results)
    const fresh = await this.withoutDuplicates(prepared, results)

    let jobId: string | undefined
    if (input.dryRun) {
      fresh.forEach((p) => results.push({ index: p.index, status: 'ok' }))
    } else {
      if (!fresh.length) throw new BadRequestException('Không có dòng hợp lệ để tạo job')
      jobId = await this.write(adminId, bot.rows[0].id, input, fresh, results)
    }

    results.sort((a, b) => a.index - b.index)
    const summary = { ok: 0, duplicate: 0, invalid: 0 } as Record<BotImportRowStatus, number>
    results.forEach((r) => summary[r.status]++)
    return { dryRun: input.dryRun, jobId, summary, rows: results }
  }

  private async prepare(input: AdminBotJobInput, results: BotImportRowResult[]): Promise<Prepared[]> {
    const parsed = input.rows.map((raw) => BotRowSchema.safeParse(raw))
    const rows = parsed.flatMap((p) => (p.success ? [p.data] : []))
    const courses = [...new Set(rows.map((r) => r.course).filter((x): x is string => !!x))]
    const communities = [...new Set(rows.map((r) => r.community).filter((x): x is string => !!x))]
    const [courseRes, communityRes] = await Promise.all([
      courses.length ? this.db.query(`SELECT id, code FROM courses WHERE id::text = ANY($1::text[]) OR lower(code) = ANY($2::text[])`, [courses, courses.map((c) => c.toLowerCase())]) : { rows: [] },
      communities.length ? this.db.query(`SELECT slug FROM communities WHERE slug = ANY($1::text[])`, [communities]) : { rows: [] }
    ])
    const courseBy = new Map<string, string>(courseRes.rows.flatMap((r: any) => [[r.id, r.id] as const, [String(r.code).toLowerCase(), r.id] as const]))
    const communitySet = new Set<string>(communityRes.rows.map((r: any) => r.slug))

    const spacing = (input.spacingMinutes ?? DEFAULT_SPACING_MIN) * 60_000
    const now = Date.now()
    const seen = new Set<string>()
    const out: Prepared[] = []
    let spread = 0

    parsed.forEach((p, index) => {
      const fail = (reason: string) => results.push({ index, status: 'invalid', reason })
      if (!p.success) return fail(p.error.issues[0].message)
      const row = p.data
      if (!!row.pollQuestion !== !!row.pollOptions) return fail('khảo sát cần đủ câu hỏi và các lựa chọn')
      const courseId = row.course ? courseBy.get(row.course.toLowerCase()) : null
      if (row.course && !courseId) return fail(`môn học không tồn tại: ${row.course}`)
      if (row.community && !communitySet.has(row.community)) return fail(`cộng đồng không tồn tại: ${row.community}`)

      const hash = hashOf(row.content)
      if (seen.has(hash)) return results.push({ index, status: 'duplicate', reason: 'trùng dòng khác trong file' })
      seen.add(hash)

      const at = row.scheduledAt ? new Date(row.scheduledAt).getTime() : now + spread++ * spacing
      if (at > now + MAX_AHEAD_MS) return fail('giờ hẹn quá xa (> 1 năm)')
      out.push({ index, row, hash, courseId: courseId ?? null, runAt: new Date(Math.max(at, now)) })
    })
    return out
  }

  // Trùng với bài đã nhập ở job khác (còn chờ hoặc đã đăng)
  private async withoutDuplicates(items: Prepared[], results: BotImportRowResult[]) {
    if (!items.length) return items
    const dups = await this.db.query(`SELECT content_hash FROM bot_job_posts WHERE status <> 'failed' AND content_hash = ANY($1::text[])`, [items.map((p) => p.hash)])
    const known = new Set<string>(dups.rows.map((r) => r.content_hash))
    return items.filter((p) => {
      if (!known.has(p.hash)) return true
      results.push({ index: p.index, status: 'duplicate', reason: 'đã có trong job khác' })
      return false
    })
  }

  // ACID Transaction: job + toàn bộ bài chờ đăng + audit. Ảnh ngoài tải về R2 trước (ngoài transaction).
  private async write(adminId: string, botId: string, input: AdminBotJobInput, items: Prepared[], results: BotImportRowResult[]) {
    const images = new Map<number, { urls: string[]; warning?: string }>()
    for (const p of items) images.set(p.index, await this.resolveImages(p.row.images ?? []))

    return this.db.transaction(async (client) => {
      const job = await client.query(`INSERT INTO bot_jobs (name, bot_id, auto_reply, auto_react, created_by) VALUES ($1, $2, $3, $4, $5) RETURNING id`, [
        input.name,
        botId,
        input.autoReply,
        input.autoReact,
        adminId
      ])
      const jobId: string = job.rows[0].id
      for (const p of items) {
        const img = images.get(p.index)!
        const data = {
          title: p.row.title ?? '',
          content: p.row.content,
          postType: p.row.postType ?? 'general',
          tags: p.row.tags ?? [],
          mediaUrls: img.urls,
          visibility: p.row.visibility ?? 'public',
          ...(p.courseId && { courseId: p.courseId }),
          ...(p.row.community && { communitySlug: p.row.community }),
          ...(p.row.pollQuestion && { pollQuestion: p.row.pollQuestion, pollOptions: p.row.pollOptions })
        }
        const ins = await client.query(
          `INSERT INTO bot_job_posts (job_id, data, content_hash, scheduled_at) VALUES ($1, $2, $3, $4) ON CONFLICT DO NOTHING RETURNING id`,
          [jobId, JSON.stringify(data), p.hash, p.runAt]
        )
        results.push(ins.rowCount ? { index: p.index, status: 'ok', warning: img.warning } : { index: p.index, status: 'duplicate', reason: 'đã có trong job khác' })
      }
      await writeAudit(client, adminId, { action: 'bot.job_create', targetType: 'bot', targetId: jobId, details: { name: input.name, bot: input.bot, rows: input.rows.length, autoReply: input.autoReply, autoReact: input.autoReact } })
      return jobId
    })
  }

  // Ảnh của chính R2 giữ nguyên; URL ngoài tải về và lưu R2. Ảnh lỗi bị bỏ kèm cảnh báo, bài vẫn nhập.
  private async resolveImages(urls: string[]): Promise<{ urls: string[]; warning?: string }> {
    const own = this.storage.publicUrlFor('')
    const out: string[] = []
    let failed = 0
    for (const url of urls) {
      if (url.startsWith(own)) {
        out.push(url)
        continue
      }
      try {
        const img = await fetchImage(url)
        out.push((await this.storage.uploadFile(img.buffer, img.originalname, img.mimetype, 'posts/images')).url)
      } catch (err: any) {
        failed++
        this.logger.warn(`Bỏ ảnh import (${err?.message}): ${url.slice(0, 80)}`)
      }
    }
    return { urls: out, warning: failed ? `${failed} ảnh không tải được, đã bỏ` : undefined }
  }

  async patch(adminId: string, id: string, input: AdminBotJobPatch) {
    await this.db.transaction(async (client) => {
      const res = await client.query(
        `UPDATE bot_jobs SET name = COALESCE($2, name), auto_reply = COALESCE($3, auto_reply), auto_react = COALESCE($4, auto_react), status = COALESCE($5, status) WHERE id = $1`,
        [id, input.name ?? null, input.autoReply ?? null, input.autoReact ?? null, input.status ?? null]
      )
      if (!res.rowCount) throw new NotFoundException('Job không tồn tại')
      await writeAudit(client, adminId, { action: 'bot.job_update', targetType: 'bot', targetId: id, details: { ...input } })
    })
  }

  // Xóa job: bỏ lịch chưa đăng; bài đã đăng vẫn ở lại bảng tin
  async remove(adminId: string, id: string) {
    await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM bot_jobs WHERE id = $1`, [id])
      if (!res.rowCount) throw new NotFoundException('Job không tồn tại')
      await writeAudit(client, adminId, { action: 'bot.job_delete', targetType: 'bot', targetId: id })
    })
  }

  // Đăng ngay (bài chờ) hoặc thử lại (bài lỗi)
  async publishNow(adminId: string, jobId: string, postRowId: number) {
    await this.db.transaction(async (client) => {
      try {
        const res = await client.query(
          `UPDATE bot_job_posts SET status = 'pending', error = NULL, scheduled_at = NOW() WHERE id = $1 AND job_id = $2 AND status IN ('pending', 'failed')`,
          [postRowId, jobId]
        )
        if (!res.rowCount) throw new BadRequestException('Bài không còn ở trạng thái chờ hoặc lỗi')
      } catch (err: any) {
        if (err?.code === '23505') throw new ConflictException('Bài giống một bài đã nhập ở job khác')
        throw err
      }
      await writeAudit(client, adminId, { action: 'bot.job_post_now', targetType: 'bot', targetId: String(postRowId), details: { jobId } })
    })
  }

  async removePost(adminId: string, jobId: string, postRowId: number) {
    await this.db.transaction(async (client) => {
      const res = await client.query(`DELETE FROM bot_job_posts WHERE id = $1 AND job_id = $2 AND status IN ('pending', 'failed')`, [postRowId, jobId])
      if (!res.rowCount) throw new BadRequestException('Chỉ bỏ được bài đang chờ hoặc lỗi')
      await writeAudit(client, adminId, { action: 'bot.job_post_remove', targetType: 'bot', targetId: String(postRowId), details: { jobId } })
    })
  }
}
