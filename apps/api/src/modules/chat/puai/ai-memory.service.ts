import { Injectable, Logger } from '@nestjs/common'
import { LlmService } from '../../ai/llm.service'
import { ChatCoreService } from '../chat-core.service'

const SUMMARY_TRIGGER = 24 // tin sau mốc vượt ngưỡng ⇒ tóm tắt phần cũ
const KEEP_RECENT = 12 // giữ nguyên văn các tin gần nhất
const MAX_INPUT_CHARS = 30_000
const SUMMARY_MAX_TOKENS = 2048 // model suy nghĩ: gồm cả token suy nghĩ

// Mốc "Chủ đề mới" gần nhất (alias c = hội thoại)
const RESET_ID = `COALESCE((SELECT MAX(r.id) FROM messages r WHERE r.conversation_id = c.id AND r.kind = 'system' AND r.meta->>'event' = 'ai.reset'), 0)`
// Mốc ngữ cảnh: tin sau "Chủ đề mới" và sau phần đã tóm tắt
export const AI_HISTORY_FLOOR = `GREATEST(${RESET_ID}, COALESCE(c.ai_summary_upto, 0))`

const SUMMARY_PROMPT = `Bạn tóm tắt cuộc trò chuyện học tập giữa sinh viên và PU AI để làm trí nhớ dài hạn.
Gộp BẢN TÓM TẮT CŨ (nếu có) với ĐOẠN HỘI THOẠI MỚI thành một bản duy nhất, tiếng Việt, ≤ 250 từ, gạch đầu dòng:
- Mục tiêu / môn học / bối cảnh của người học
- Kiến thức, đáp án, quyết định đã chốt
- Câu hỏi còn bỏ ngỏ, điều người học chưa hiểu
Chỉ ghi dữ kiện; không thêm lời dẫn.`

// Trí nhớ dài cho hội thoại PU AI riêng: tóm tắt cuộn (conversations.ai_summary), chạy nền sau mỗi câu trả lời
// Không tính quota người dùng (tác vụ nội bộ); mỗi hội thoại chỉ 1 lượt tóm tắt cùng lúc
@Injectable()
export class AiMemoryService {
  private readonly logger = new Logger(AiMemoryService.name)
  private readonly running = new Set<string>()

  constructor(
    private readonly core: ChatCoreService,
    private readonly llm: LlmService
  ) {}

  // Tóm tắt hiện hành; tóm tắt phần trước "Chủ đề mới" bị bỏ qua (kể cả khi ghi muộn do chạy song song)
  async summary(conversationId: string): Promise<string | null> {
    const res = await this.core.db.query(
      `SELECT CASE WHEN c.ai_summary_upto > ${RESET_ID} THEN c.ai_summary END AS summary FROM conversations c WHERE c.id = $1`,
      [conversationId]
    )
    return res.rows[0]?.summary ?? null
  }

  maybeSummarize(conversationId: string, botId: string): void {
    if (this.running.has(conversationId) || !this.llm.client) return
    this.running.add(conversationId)
    this.run(conversationId, botId)
      .catch((err) => this.logger.warn(`Tóm tắt hội thoại ${conversationId} lỗi: ${err?.message}`))
      .finally(() => this.running.delete(conversationId))
  }

  private async run(conversationId: string, botId: string) {
    const res = await this.core.db.query(
      `SELECT CASE WHEN c.ai_summary_upto > ${RESET_ID} THEN c.ai_summary END AS ai_summary, COALESCE(c.ai_summary_upto, 0) AS upto, m.id, m.sender_id, m.content
       FROM conversations c
       JOIN messages m ON m.conversation_id = c.id AND m.id > ${AI_HISTORY_FLOOR}
       WHERE c.id = $1 AND m.kind <> 'system' AND m.status = 'done' AND m.deleted_at IS NULL
       ORDER BY m.id`,
      [conversationId]
    )
    if (res.rows.length <= SUMMARY_TRIGGER) return
    const old = res.rows.slice(0, res.rows.length - KEEP_RECENT)
    let transcript = old.map((r) => `${r.sender_id === botId ? 'PU AI' : 'Sinh viên'}: ${(r.content || '').slice(0, 1500)}`).join('\n\n')
    if (transcript.length > MAX_INPUT_CHARS) transcript = transcript.slice(-MAX_INPUT_CHARS)
    const prev = res.rows[0].ai_summary as string | null

    const { text } = await this.llm.complete(
      [
        { role: 'system', content: SUMMARY_PROMPT },
        { role: 'user', content: `BẢN TÓM TẮT CŨ:\n${prev || '(chưa có)'}\n\nĐOẠN HỘI THOẠI MỚI:\n${transcript}` }
      ],
      SUMMARY_MAX_TOKENS
    )
    if (!text) return
    // Chỉ ghi khi không ai đổi mốc trong lúc chờ LLM (Chủ đề mới / lượt tóm tắt khác)
    await this.core.db.query(`UPDATE conversations SET ai_summary = $2, ai_summary_upto = $3 WHERE id = $1 AND COALESCE(ai_summary_upto, 0) = $4`, [
      conversationId,
      text,
      old[old.length - 1].id,
      res.rows[0].upto
    ])
  }
}
