import { Injectable } from '@nestjs/common'
import type { AiMode, AiSuggestion, AiSuggestionsResponse } from '@pu/schemas'
import { DEFAULT_SUGGESTIONS, MIXED_MODES, fillTemplate } from './ai-suggestions.templates'
import { InterestProfileService, type InterestTopic } from './interest-profile.service'

const SUGGESTION_COUNT = 4
const MAX_PERSONAL = 3 // luôn chừa chỗ cho gợi ý mặc định (đa dạng chủ đề)
export const SUGGESTION_POOL = 12 // số chủ đề top đọc từ hồ sơ
const MAX_LABEL = 50

// Gợi ý mở đầu N7AI: môn học đang quan tâm (SQL) × mẫu câu theo chế độ — không gọi LLM
// Chỉ lấy chủ đề là môn học: thẻ bài viết và từ khóa tìm kiếm thuộc bảng tin, đưa vào đây ra gợi ý như "Giải thích anuong"
// Zero-state AI suggestions: courses of interest × per-mode templates, no LLM call
@Injectable()
export class AiSuggestionsService {
  constructor(private readonly profile: InterestProfileService) {}

  async suggest(userId: string, mode: AiMode): Promise<AiSuggestionsResponse> {
    return this.fromTopics(mode, await this.profile.topTopics(userId, SUGGESTION_POOL))
  }

  // Thuần: chủ đề sẵn có → gợi ý (admin xem trước dùng lại, không tính lại hồ sơ)
  fromTopics(mode: AiMode, ranked: InterestTopic[]): AiSuggestionsResponse {
    const courses = pickCourses(ranked)
    // "Hỏi đáp": mỗi gợi ý một chế độ; ít môn thì dùng lại môn hàng đầu cho nhiều chế độ. Chế độ cụ thể: mỗi môn một gợi ý
    const slots = courses.length ? (mode === 'ask' ? MAX_PERSONAL : Math.min(courses.length, MAX_PERSONAL)) : 0
    const items: AiSuggestion[] = Array.from({ length: slots }, (_, i) => {
      const course = courses[i % courses.length]
      const m = mode === 'ask' ? MIXED_MODES[i % MIXED_MODES.length] : mode
      return { mode: m, text: fillTemplate(m, course.label), topic: { kind: course.kind, key: course.key } }
    })
    // Chưa đủ ⇒ bù gợi ý mặc định của chế độ
    for (const fallback of DEFAULT_SUGGESTIONS[mode]) {
      if (items.length >= SUGGESTION_COUNT) break
      if (!items.some((s) => s.text === fallback.text)) items.push(fallback)
    }
    return { personalized: courses.length > 0, items }
  }
}

// Chỉ môn học, bỏ trùng tên, cắt nhãn quá dài
function pickCourses(topics: InterestTopic[]): InterestTopic[] {
  const seen = new Set<string>()
  const picked: InterestTopic[] = []
  for (const t of topics) {
    if (t.kind !== 'course') continue
    const label = t.label.trim().slice(0, MAX_LABEL)
    if (!label || seen.has(label.toLowerCase())) continue
    seen.add(label.toLowerCase())
    picked.push({ ...t, label })
    if (picked.length === MAX_PERSONAL) break
  }
  return picked
}
