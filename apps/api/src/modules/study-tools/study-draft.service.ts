import { BadGatewayException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { StudySetDraft, StudyToolKind } from '@pu/schemas'
import { LlmService } from '../ai/llm.service'
import { StudySetBodySchema } from './dto/study-tools.dto'

const DRAFT_MAX_TOKENS = 12_000 // bộ lớn (≤ 60 mục) + token suy nghĩ

const SHAPES: Record<StudyToolKind, string> = {
  flashcards: `{"title": "tên bộ ≤ 60 ký tự", "description": "1 câu ≤ 120 ký tự", "items": [{"front": "thuật ngữ / câu hỏi ngắn", "back": "giải thích ngắn, có thể kèm ví dụ"}]}`,
  quiz: `{"title": "tên bộ ≤ 60 ký tự", "description": "1 câu ≤ 120 ký tự", "items": [{"q": "câu hỏi", "options": ["A", "B", "C", "D"], "answer": 0, "explain": "vì sao đúng"}]}`
}

const draftPrompt = (kind: StudyToolKind) => `Bạn là N7AI, giúp sinh viên Việt Nam tạo ${kind === 'quiz' ? 'bộ câu hỏi trắc nghiệm' : 'bộ flashcard'} để ôn tập.
Đọc <request> (chủ đề, hoặc nội dung / danh sách người học dán vào) và trả về DUY NHẤT 1 object JSON, không markdown, không giải thích:
${SHAPES[kind]}
- Người học dán danh sách cụ thể (từ vựng, thuật ngữ, câu hỏi…) ⇒ giữ ĐỦ mọi mục, không bỏ bớt, không gộp (tối đa 60).
- Chỉ nêu chủ đề ⇒ ${kind === 'quiz' ? '10 câu, độ khó tăng dần, 4 lựa chọn' : '15–20 thẻ cốt lõi'}, trừ khi người học yêu cầu số lượng khác.
${kind === 'quiz' ? '- "answer" là chỉ số (0-based) của lựa chọn đúng; phương án nhiễu hợp lý.\n' : '- Mặt sau ngắn gọn (≤ 2 câu); từ vựng ngoại ngữ ⇒ mặt trước ghi từ + loại từ, mặt sau ghi nghĩa + 1 ví dụ ngắn.\n'}- Dùng Markdown / LaTeX ($...$) khi cần. Không bịa kiến thức ngoài nội dung người học đưa.`

// Lấy object JSON đầu tiên trong câu trả lời (model đôi khi bọc ```json)
function parseJson(text: string): Record<string, unknown> | null {
  const start = text.indexOf('{')
  const end = text.lastIndexOf('}')
  if (start < 0 || end <= start) return null
  try {
    return JSON.parse(text.slice(start, end + 1))
  } catch {
    return null
  }
}

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Tạo nhanh bộ flashcard / quiz: N7AI viết bản nháp (chưa lưu, tốn 1 lượt), người dùng xem lại rồi lưu
@Injectable()
export class StudyDraftService {
  constructor(private readonly llm: LlmService) {}

  async draft(userId: string, kind: StudyToolKind, prompt: string): Promise<StudySetDraft> {
    if (!this.llm.client) throw new ServiceUnavailableException('N7AI chưa sẵn sàng, bạn thử lại sau nhé')
    if (!(await this.llm.hasQuota(userId))) {
      await this.llm.logRejected(userId, 'tool')
      throw new HttpException('Bạn đã dùng hết lượt N7AI hôm nay', HttpStatus.TOO_MANY_REQUESTS)
    }

    const started = Date.now()
    const runId = await this.llm.startRun({ requesterId: userId, trigger: 'tool', task: `tool_${kind}` })
    let raw: Record<string, unknown> | null
    try {
      const { text, usage } = await this.llm.complete(
        [
          { role: 'system', content: draftPrompt(kind) },
          { role: 'user', content: `<request>\n${prompt}\n</request>` }
        ],
        DRAFT_MAX_TOKENS
      )
      raw = parseJson(text)
      if (!raw) throw new Error('draft not json')
      await this.llm.finishRun(runId, { usage, startedAt: started })
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      throw new ServiceUnavailableException(this.llm.isBusyError(err) ? 'N7AI đang quá tải, bạn thử lại sau ít phút nhé' : 'N7AI chưa tạo được, thử mô tả lại nhé')
    }

    // Bỏ mục hỏng thay vì từ chối cả bộ
    const items = (Array.isArray(raw.items) ? raw.items : []).map((content) => ({ content }))
    const parsed = StudySetBodySchema.safeParse({ kind, title: str(raw.title, 120) || 'Bộ mới', description: str(raw.description, 300) || null, items })
    if (parsed.success) return { ...parsed.data, items: parsed.data.items.map((it) => ({ content: it.content })) } as StudySetDraft

    const valid = items.filter((it) => StudySetBodySchema.safeParse({ kind, title: 'x', items: [it] }).success)
    if (!valid.length) throw new BadGatewayException('N7AI chưa tạo được, thử mô tả cụ thể hơn nhé')
    const retry = StudySetBodySchema.parse({ kind, title: str(raw.title, 120) || 'Bộ mới', description: str(raw.description, 300) || null, items: valid })
    return { ...retry, items: retry.items.map((it) => ({ content: it.content })) } as StudySetDraft
  }
}
