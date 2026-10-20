import { BadRequestException, Injectable, Logger } from '@nestjs/common'
import { z } from 'zod'
import type { BotImportInput, BotImportMapRequest, BotImportMapping, BotImportResult, BotImportRowResult, BotImportRowStatus } from '@pu/schemas'
import { DatabaseService } from '../../../database/database.service'
import { StorageService } from '../../storage/storage.service'
import { writeAudit } from '../admin-audit'
import { filterImportContent } from './import-content-filter'
import { fetchImage } from './import-image-fetcher'

const MAX_PENDING_COMMANDS = 500
const MAX_IMAGES = 4
const MAX_AHEAD_MS = 365 * 24 * 3600_000
const MAP_FIELDS = ['content', 'key', 'title', 'images', 'topic', 'bot', 'scheduledAt', 'enhance'] as const

// Mỗi dòng được kiểm tra riêng: dòng lỗi không làm hỏng cả file
const RowSchema = z.object({
  content: z.string().trim().min(1, 'thiếu nội dung').max(20_000),
  key: z.string().trim().max(200).optional(),
  title: z.string().trim().max(200).optional(),
  images: z.array(z.string().trim().url('URL ảnh không hợp lệ').max(1000)).max(MAX_IMAGES, `tối đa ${MAX_IMAGES} ảnh`).optional(),
  topic: z.string().trim().max(80).optional(),
  bot: z.string().trim().regex(/^[a-zA-Z0-9._]{1,40}$/, 'tên bot không hợp lệ').optional(),
  scheduledAt: z.string().datetime({ offset: true, message: 'giờ hẹn không hợp lệ' }).optional(),
  enhance: z.enum(['none', 'ai']).optional()
})

type Prepared = { index: number; row: z.infer<typeof RowSchema>; content: string; hash: string; key: string; topic: string | null; bot: string; plan: 'now' | 'scheduled'; runAt: Date; enhance: 'none' | 'ai' }

// Import Excel/CSV (đã parse ở trình duyệt) thành lịch đăng: mỗi dòng hợp lệ = 1 lệnh `post` hẹn giờ trong bot_commands
@Injectable()
export class BotImportService {
  private readonly logger = new Logger(BotImportService.name)

  constructor(
    private readonly db: DatabaseService,
    private readonly storage: StorageService
  ) {}

  async import(adminId: string, input: BotImportInput): Promise<BotImportResult> {
    const results: BotImportRowResult[] = []
    const prepared: Prepared[] = []
    const [bots, topics] = await Promise.all([
      this.db.query(`SELECT u.username, p.enabled AND p.can_post AS can_post, p.topics FROM users u JOIN bot_profiles p ON p.user_id = u.id WHERE u.is_bot`),
      this.db.query(`SELECT slug, label FROM bot_topics`)
    ])
    const botSet = new Set<string>(bots.rows.map((r) => r.username))
    const posters = bots.rows.filter((r) => r.can_post) as { username: string; topics: string[] }[]
    const assigned = new Map<string, number>() // số bài đã chia cho từng bot trong lần import này
    const topicBy = new Map<string, string>(topics.rows.flatMap((r) => [[r.slug.toLowerCase(), r.slug] as const, [r.label.toLowerCase(), r.slug] as const]))
    const spacing = (input.spacingMinutes ?? 30) * 60_000
    const now = Date.now()
    const seenHashes = new Set<string>()
    const seenKeys = new Set<string>()
    let spread = 0

    input.rows.forEach((raw, index) => {
      const fail = (reason: string) => results.push({ index, status: 'invalid', reason })
      const parsed = RowSchema.safeParse(raw)
      if (!parsed.success) return fail(parsed.error.issues[0].message)
      const row = parsed.data
      const filtered = filterImportContent(row.content)
      if ('reason' in filtered) return fail({ too_short: 'nội dung quá ngắn (< 40 ký tự)', too_long: 'nội dung quá dài (> 3000 ký tự)', blocked_keyword: 'chứa từ khóa bị chặn (tố cáo/bóc phốt…)' }[filtered.reason])
      if (row.bot && !botSet.has(row.bot)) return fail(`bot không tồn tại: @${row.bot}`)
      const topic = row.topic ? topicBy.get(row.topic.toLowerCase()) : undefined
      if (row.topic && !topic) return fail(`chủ đề không tồn tại: ${row.topic}`)

      // Không ghi bot ⇒ chia đều cho bot được phép đăng (đúng chủ đề nếu dòng có chủ đề), ưu tiên bot đang ít việc nhất
      let bot = row.bot
      if (!bot) {
        const pool = posters.filter((b) => !topic || b.topics.includes(topic))
        if (!pool.length) return fail(topic ? `chưa có bot nào được đăng chủ đề "${row.topic}"` : 'chưa có bot nào được phép đăng bài, hãy ghi cột bot hoặc cấp quyền đăng bài')
        bot = pool.reduce((best, b) => ((assigned.get(b.username) ?? 0) < (assigned.get(best.username) ?? 0) ? b : best)).username
      }

      const key = row.key || `xlsx:${filtered.hash.slice(0, 20)}`
      if (seenHashes.has(filtered.hash) || seenKeys.has(key)) return results.push({ index, status: 'duplicate', reason: 'trùng dòng khác trong file' })
      seenHashes.add(filtered.hash)
      seenKeys.add(key)

      const at = row.scheduledAt ? new Date(row.scheduledAt).getTime() : now + spread++ * spacing
      if (at > now + MAX_AHEAD_MS) return fail('giờ hẹn quá xa (> 1 năm)')
      const runAt = new Date(Math.max(at, now))
      assigned.set(bot, (assigned.get(bot) ?? 0) + 1)
      prepared.push({ index, row, content: filtered.content, hash: filtered.hash, key, topic: topic ?? null, bot, plan: runAt.getTime() - now > 60_000 ? 'scheduled' : 'now', runAt, enhance: row.enhance ?? 'none' })
    })

    const fresh = await this.withoutDuplicates(prepared, results)
    if (input.dryRun) fresh.forEach((p) => results.push({ index: p.index, status: 'ok', plan: p.plan, bot: p.bot }))
    else await this.write(adminId, fresh, results)

    results.sort((a, b) => a.index - b.index)
    const summary = { ok: 0, duplicate: 0, invalid: 0 } as Record<BotImportRowStatus, number>
    results.forEach((r) => summary[r.status]++)
    if (!input.dryRun) {
      await this.db.transaction((client) => writeAudit(client, adminId, { action: 'bot.import', targetType: 'bot', targetId: 'import', details: { rows: input.rows.length, ...summary } }))
    }
    return { dryRun: input.dryRun, summary, rows: results }
  }

  // Trùng với lịch đăng đang có / đã chạy (key hoặc nội dung đã chuẩn hóa)
  private async withoutDuplicates(items: Prepared[], results: BotImportRowResult[], db: Pick<DatabaseService, 'query'> = this.db) {
    const dups = await db.query(
      `SELECT payload->>'key' AS k, payload->>'hash' AS h FROM bot_commands
       WHERE type = 'post' AND status IN ('pending', 'running', 'done') AND (payload->>'key' = ANY($1::text[]) OR payload->>'hash' = ANY($2::text[]))`,
      [items.map((p) => p.key), items.map((p) => p.hash)]
    )
    const dupKeys = new Set<string>(dups.rows.map((r) => r.k))
    const dupHashes = new Set<string>(dups.rows.map((r) => r.h))
    return items.filter((p) => {
      if (!dupKeys.has(p.key) && !dupHashes.has(p.hash)) return true
      results.push({ index: p.index, status: 'duplicate', reason: 'đã có trong lịch đăng' })
      return false
    })
  }

  // ACID Transaction: khóa hàng điều khiển, kiểm tra hạn mức hàng đợi + trùng lần nữa, rồi ghi cả lô lệnh hẹn giờ
  private async write(adminId: string, items: Prepared[], results: BotImportRowResult[]) {
    const payloads = new Map<number, { urls: string[]; warning?: string }>()
    for (const p of items) payloads.set(p.index, await this.resolveImages(p.row.images ?? []))

    await this.db.transaction(async (client) => {
      await client.query(`SELECT 1 FROM bot_control WHERE id = 1 FOR UPDATE`)
      const pending = await client.query(`SELECT COUNT(*)::int AS n FROM bot_commands WHERE status IN ('pending', 'running')`)
      if (pending.rows[0].n + items.length > MAX_PENDING_COMMANDS) throw new BadRequestException('Hàng đợi lệnh quá đầy, chia nhỏ file hoặc chờ bot xử lý')
      const fresh = await this.withoutDuplicates(items, results, client)
      for (const p of fresh) {
        const img = payloads.get(p.index)!
        const payload = { bot: p.bot, content: p.content, imageUrls: img.urls, enhance: p.enhance, hash: p.hash, key: p.key, source: 'import', ...(p.row.title && { title: p.row.title }), ...(p.topic && { topic: p.topic }) }
        await client.query(`INSERT INTO bot_commands (type, payload, created_by, scheduled_at) VALUES ('post', $1, $2, $3)`, [JSON.stringify(payload), adminId, p.runAt])
        results.push({ index: p.index, status: 'ok', plan: p.plan, bot: p.bot, warning: img.warning })
      }
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

  // AI đoán cột của file ứng với trường chuẩn khi header lạ; chỉ nhận header có thật trong file
  async mapColumns(input: BotImportMapRequest): Promise<BotImportMapping> {
    const ctl = await this.db.query(`SELECT ai_model, ai_base_url FROM bot_control WHERE id = 1`)
    const baseUrl = (ctl.rows[0]?.ai_base_url || process.env.AI_BASE_URL || 'https://api-ai.vnhat.dev/v1').replace(/\/+$/, '')
    const system = `Bạn ghép cột của file bài đăng với các trường chuẩn. Trường: content (nội dung bài, bắt buộc), key (id/mã bài), title (tiêu đề), images (ảnh/URL ảnh), topic (chủ đề), bot (tài khoản bot đăng), scheduledAt (giờ đăng), enhance (có dùng AI viết lại hay không). Chỉ trả về JSON dạng {"trường":"tên cột trong file"}, bỏ trường không có cột phù hợp. Không giải thích.`
    const prompt = JSON.stringify({ headers: input.headers, sample: input.sample.slice(0, 3) })
    let text = ''
    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${process.env.AI_API_KEY || 'dummy'}` },
        body: JSON.stringify({ model: ctl.rows[0]?.ai_model || 'v10', temperature: 0, stream: false, messages: [{ role: 'system', content: system }, { role: 'user', content: prompt }] }),
        signal: AbortSignal.timeout(20_000)
      })
      if (!res.ok) throw new Error(`AI ${res.status}`)
      text = (await res.json())?.choices?.[0]?.message?.content ?? ''
    } catch (err: any) {
      this.logger.warn(`AI map cột lỗi: ${err?.message}`)
      throw new BadRequestException('AI chưa ghép được cột, hãy chọn tay')
    }
    const json = /\{[\s\S]*\}/.exec(text)?.[0]
    let parsed: Record<string, unknown> = {}
    try {
      parsed = json ? JSON.parse(json) : {}
    } catch {
      /* giữ rỗng */
    }
    const valid = new Set(input.headers)
    const mapping: BotImportMapping = {}
    for (const f of MAP_FIELDS) if (typeof parsed[f] === 'string' && valid.has(parsed[f] as string)) mapping[f] = parsed[f] as string
    return mapping
  }
}
