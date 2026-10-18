import { BadGatewayException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { StudySetDraft, StudyToolKind } from '@pu/schemas'
import { LlmService } from '../ai/llm.service'
import { STUDY_KINDS, aiParameters, validateAiSet } from './kinds/study-kinds.registry'

const DRAFT_MAX_TOKENS = 12_000 // bộ lớn (≤ 60 mục) + token suy nghĩ

// Cùng hợp đồng với tool N7AI trong chat (registry): JSON Schema + quy tắc nội dung của loại bộ
const draftPrompt = (kind: StudyToolKind) => {
  const def = STUDY_KINDS[kind]
  return `You are N7AI, helping Vietnamese university students build a ${def.label} set for revision.
Read <request> (a topic, or material / a list the student pasted) and return ONLY one JSON object — no markdown, no prose — that matches this JSON Schema:
${JSON.stringify(aiParameters(def))}
Rules: ${def.ai.instructions}
Topic only and no count given ⇒ ${kind === 'quiz' ? '10 questions' : '15–20 cards'}. Write content in the student's language; use Markdown / $LaTeX$ when needed.`
}

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

    // Mục hỏng bị bỏ thay vì từ chối cả bộ; thiếu tên ⇒ tên mặc định
    const checked = validateAiSet(STUDY_KINDS[kind], { title: 'Bộ mới', ...raw })
    if ('issues' in checked) throw new BadGatewayException('N7AI chưa tạo được, thử mô tả cụ thể hơn nhé')
    const { set } = checked
    return { kind, title: set.title, description: set.description, options: set.options, items: set.items.map((content) => ({ content })) }
  }
}
