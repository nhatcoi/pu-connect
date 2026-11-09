import { Injectable, Logger } from '@nestjs/common'
import { LlmService } from '../../ai/llm.service'
import { ChatCoreService } from '../chat-core.service'
import { mapThread, THREAD_COLUMNS } from './ai-threads.service'

const MAX_EXCHANGE_MESSAGES = 12 // chỉ đặt lại tên trong các lượt đầu; sau đó giữ tên tạm
const SNIPPET = 700
const TITLE_MAX_TOKENS = 1024 // model suy nghĩ: gồm cả token suy nghĩ
const TITLE_MAX_CHARS = 60

const TITLE_PROMPT = `Đặt tên cho cuộc trò chuyện học tập giữa sinh viên và N7AI.
- Tên 3–6 từ, tối đa 50 ký tự, nêu đúng chủ đề / việc người học cần (ví dụ: "Giải bài tập Lagrange", "Ôn tập nội quy trường").
- Cùng ngôn ngữ với sinh viên. Không dấu ngoặc kép, không dấu chấm cuối, không emoji, không tiền tố "Tên:".
- Nếu mới chỉ chào hỏi / chưa có chủ đề cụ thể thì trả đúng một từ: SKIP.
Chỉ trả về tên (hoặc SKIP), không giải thích.`

// Làm sạch kết quả LLM: dòng đầu, bỏ ngoặc kép / Markdown / dấu chấm cuối, ≤ 60 ký tự; rỗng hoặc SKIP ⇒ null
export function cleanTitle(raw: string): string | null {
  const line = raw
    .split('\n')
    .map((l) => l.trim())
    .find(Boolean)
  if (!line) return null
  const t = line
    .replace(/^(tên|title)\s*[:：]\s*/i, '')
    .replace(/[*_`#>]+/g, '')
    .replace(/^["'“”‘’«»\s]+|["'“”‘’«»\s.]+$/g, '')
    .trim()
  if (!t || /^skip$/i.test(t)) return null
  return t.length > TITLE_MAX_CHARS ? `${t.slice(0, TITLE_MAX_CHARS - 3).trimEnd()}…` : t
}

// Đặt tên thread N7AI theo ngữ cảnh sau câu trả lời đầu (nền, không tính quota)
// Chỉ ghi khi thread còn tên tạm (title_auto) ⇒ không bao giờ đè tên người dùng tự đặt
@Injectable()
export class AiTitleService {
  private readonly logger = new Logger(AiTitleService.name)
  private readonly running = new Set<string>()

  constructor(
    private readonly core: ChatCoreService,
    private readonly llm: LlmService
  ) {}

  maybeTitle(conversationId: string, botId: string): void {
    if (this.running.has(conversationId) || !this.llm.client) return
    this.running.add(conversationId)
    this.retitle(conversationId, botId)
      .catch((err) => this.logger.warn(`Đặt tên hội thoại ${conversationId} lỗi: ${err?.message}`))
      .finally(() => this.running.delete(conversationId))
  }

  // Trả tên mới nếu đã đổi; null nếu bỏ qua (đã có tên cuối / chưa đủ ngữ cảnh)
  async retitle(conversationId: string, botId: string, opts: { maxMessages?: number; notify?: boolean } = {}): Promise<string | null> {
    const meta = await this.core.db.query(`SELECT created_by FROM conversations WHERE id = $1 AND type = 'ai' AND title_auto`, [conversationId])
    const ownerId = meta.rows[0]?.created_by as string | undefined
    if (!ownerId) return null

    const res = await this.core.db.query(
      `SELECT m.sender_id, m.content FROM messages m
       WHERE m.conversation_id = $1 AND m.kind <> 'system' AND m.status = 'done' AND m.deleted_at IS NULL
       ORDER BY m.id LIMIT $2`,
      [conversationId, (opts.maxMessages ?? MAX_EXCHANGE_MESSAGES) + 1]
    )
    if (res.rows.length > (opts.maxMessages ?? MAX_EXCHANGE_MESSAGES)) return null // thread đã dài: giữ tên tạm
    const transcript = res.rows
      .filter((r) => (r.content || '').trim())
      .slice(0, 6)
      .map((r) => `${r.sender_id === botId ? 'N7AI' : 'Sinh viên'}: ${(r.content as string).slice(0, SNIPPET)}`)
      .join('\n\n')
    if (!transcript.includes('N7AI:')) return null // chưa có câu trả lời

    const { text } = await this.llm.complete(
      [
        { role: 'system', content: TITLE_PROMPT },
        { role: 'user', content: transcript }
      ],
      TITLE_MAX_TOKENS
    )
    const title = cleanTitle(text)
    if (!title) return null
    const upd = await this.core.db.query(
      `UPDATE conversations SET title = $2, title_auto = false WHERE id = $1 AND type = 'ai' AND title_auto RETURNING ${THREAD_COLUMNS}`,
      [conversationId, title]
    )
    if (!upd.rows[0]) return null // người dùng vừa đổi tên tay
    if (opts.notify !== false) this.core.emitTo([ownerId], 'ai.thread.updated', mapThread(upd.rows[0]))
    return title
  }
}
