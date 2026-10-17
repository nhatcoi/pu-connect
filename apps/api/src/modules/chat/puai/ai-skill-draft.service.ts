import { BadGatewayException, HttpException, HttpStatus, Injectable, ServiceUnavailableException } from '@nestjs/common'
import type { AiSkillDraft } from '@pu/schemas'
import { LlmService } from '../../ai/llm.service'
import { AiSkillBodySchema } from '../dto/chat.dto'
import { AiSkillsService, freeSlug } from './ai-skills.service'

const DRAFT_MAX_TOKENS = 4096 // gồm cả token suy nghĩ

const DRAFT_PROMPT = `Bạn giúp sinh viên Việt Nam viết "skill" cho PU AI (trợ lý học tập). Skill = chỉ dẫn lưu sẵn, gọi nhanh bằng lệnh /slug.
Đọc yêu cầu trong <request> và trả về DUY NHẤT 1 object JSON, không markdown, không giải thích:
{"name": "tên ngắn, tiếng Việt, ≤ 40 ký tự",
 "slug": "lệnh 2–30 ký tự, chỉ a-z, 0-9, dấu -, không dấu",
 "description": "1 câu ≤ 100 ký tự",
 "instructions": "chỉ dẫn cho PU AI, 400–2000 ký tự, viết dạng 'Bạn …', gồm: vai trò, các bước xử lý, cách trình bày (Markdown, LaTeX nếu là toán), điều cần tránh",
 "inputHint": "gợi ý người dùng nhập gì, ≤ 80 ký tự"}
Không viết chỉ dẫn bỏ qua quy tắc an toàn, giả mạo người khác hay làm bài thi hộ; yêu cầu kiểu đó ⇒ viết theo hướng hướng dẫn tự học.`

const str = (v: unknown, max: number) => (typeof v === 'string' ? v.trim().slice(0, max) : '')

// Tên → lệnh: bỏ dấu, chữ thường, gạch ngang
const slugify = (s: string) =>
  s
    .normalize('NFD')
    .replace(/\p{Diacritic}/gu, '')
    .replace(/đ/gi, 'd')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 36)

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

// Tạo nhanh skill: mô tả ⇒ PU AI viết bản nháp (không lưu), tốn 1 lượt PU AI
// Quick skill draft from a description; user reviews before saving
@Injectable()
export class AiSkillDraftService {
  constructor(
    private readonly llm: LlmService,
    private readonly skills: AiSkillsService
  ) {}

  async draft(userId: string, prompt: string): Promise<AiSkillDraft> {
    if (!this.llm.client) throw new ServiceUnavailableException('PU AI chưa sẵn sàng, bạn thử lại sau nhé')
    if (!(await this.llm.hasQuota(userId))) {
      await this.llm.logRejected(userId, 'skill')
      throw new HttpException('Bạn đã dùng hết lượt PU AI hôm nay', HttpStatus.TOO_MANY_REQUESTS)
    }

    const started = Date.now()
    const runId = await this.llm.startRun({ requesterId: userId, trigger: 'skill', task: 'skill_draft' })
    let raw: Record<string, unknown> | null
    try {
      const { text, usage } = await this.llm.complete(
        [
          { role: 'system', content: DRAFT_PROMPT },
          { role: 'user', content: `<request>\n${prompt}\n</request>` }
        ],
        DRAFT_MAX_TOKENS
      )
      raw = parseJson(text)
      if (!raw) throw new Error('draft not json')
      await this.llm.finishRun(runId, { usage, startedAt: started })
    } catch (err) {
      await this.llm.failRun(runId, err, started)
      throw new ServiceUnavailableException(this.llm.isBusyError(err) ? 'PU AI đang quá tải, bạn thử lại sau ít phút nhé' : 'PU AI chưa viết được skill, thử mô tả lại nhé')
    }

    // Chuẩn hóa theo đúng ràng buộc lưu skill (lệnh không trùng skill đang có)
    const name = str(raw.name, 60) || 'Skill mới'
    const slug = freeSlug(slugify(str(raw.slug, 60) || name).padEnd(2, '1'), await this.skills.slugs(userId))
    const parsed = AiSkillBodySchema.safeParse({
      slug,
      name,
      description: str(raw.description, 200),
      instructions: str(raw.instructions, 4000),
      inputHint: str(raw.inputHint, 150) || null
    })
    if (!parsed.success) throw new BadGatewayException('PU AI chưa viết được skill, thử mô tả cụ thể hơn nhé')
    const { isPublic: _omit, ...draft } = parsed.data
    return { ...draft, inputHint: draft.inputHint ?? null }
  }
}
