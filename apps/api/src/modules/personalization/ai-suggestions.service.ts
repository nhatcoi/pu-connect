import { Injectable } from '@nestjs/common'
import type { AiMode, AiSuggestion, AiSuggestionsResponse } from '@pu/schemas'
import { DEFAULT_SUGGESTIONS, MIXED_MODES, fillTemplate } from './ai-suggestions.templates'
import { InterestProfileService, type InterestTopic } from './interest-profile.service'

const SUGGESTION_COUNT = 4
const MAX_QUERY_TOPICS = 1 // từ khóa tìm kiếm dễ nhiễu ⇒ tối đa 1
const MAX_LABEL = 50

// Gợi ý mở đầu PU AI: chủ đề quan tâm (SQL) × mẫu câu theo chế độ — không gọi LLM
// Zero-state AI suggestions: interest topics × per-mode templates, no LLM call
@Injectable()
export class AiSuggestionsService {
  constructor(private readonly profile: InterestProfileService) {}

  async suggest(userId: string, mode: AiMode): Promise<AiSuggestionsResponse> {
    const topics = pickTopics(await this.profile.topTopics(userId, 12))
    const items: AiSuggestion[] = topics.map((t, i) => {
      const m = mode === 'ask' ? MIXED_MODES[i % MIXED_MODES.length] : mode
      return { mode: m, text: fillTemplate(m, t.kind, t.label), topic: { kind: t.kind, key: t.key } }
    })
    // Chưa đủ ⇒ bù gợi ý mặc định của chế độ
    for (const fallback of DEFAULT_SUGGESTIONS[mode]) {
      if (items.length >= SUGGESTION_COUNT) break
      if (!items.some((s) => s.text === fallback.text)) items.push(fallback)
    }
    return { personalized: topics.length > 0, items }
  }
}

// Đa dạng: bỏ trùng tên, giới hạn từ khóa tìm kiếm, cắt nhãn quá dài
function pickTopics(topics: InterestTopic[]): InterestTopic[] {
  const seen = new Set<string>()
  const picked: InterestTopic[] = []
  let queries = 0
  for (const t of topics) {
    const label = t.label.trim().slice(0, MAX_LABEL)
    const norm = label.toLowerCase()
    if (!label || seen.has(norm)) continue
    if (t.kind === 'query' && ++queries > MAX_QUERY_TOPICS) continue
    seen.add(norm)
    picked.push({ ...t, label })
    if (picked.length === SUGGESTION_COUNT) break
  }
  return picked
}
