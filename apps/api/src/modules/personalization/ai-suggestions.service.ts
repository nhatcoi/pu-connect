import { Injectable } from '@nestjs/common'
import type { AiMode, AiSuggestion, AiSuggestionsResponse } from '@pu/schemas'
import { DatabaseService } from '../../database/database.service'
import { DEFAULT_SUGGESTIONS, MIXED_MODES, fillCollectionTemplate, fillTemplate } from './ai-suggestions.templates'
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
  constructor(
    private readonly profile: InterestProfileService,
    private readonly db: DatabaseService
  ) {}

  async suggest(userId: string, mode: AiMode): Promise<AiSuggestionsResponse> {
    const [topics, collection] = await Promise.all([this.profile.topTopics(userId, SUGGESTION_POOL), this.latestCollection(userId)])
    return this.fromTopics(mode, topics, collection)
  }

  // Bộ sưu tập của mình mới cập nhật gần nhất và có tài liệu: để ôn bằng chính tài liệu đã gom
  private async latestCollection(userId: string): Promise<{ id: string; title: string } | null> {
    const res = await this.db.query(
      `SELECT c.id, c.title FROM document_collections c
       WHERE c.owner_id = $1 AND EXISTS (SELECT 1 FROM document_collection_items i WHERE i.collection_id = c.id)
       ORDER BY c.updated_at DESC LIMIT 1`,
      [userId]
    )
    return res.rows[0] ?? null
  }

  // Thuần: chủ đề sẵn có → gợi ý (admin xem trước dùng lại, không tính lại hồ sơ)
  fromTopics(mode: AiMode, ranked: InterestTopic[], collection: { id: string; title: string } | null = null): AiSuggestionsResponse {
    const courses = pickCourses(ranked)
    // "Hỏi đáp": mỗi gợi ý một chế độ; ít môn thì dùng lại môn hàng đầu cho nhiều chế độ. Chế độ cụ thể: mỗi môn một gợi ý
    const slots = courses.length ? (mode === 'ask' ? MAX_PERSONAL : Math.min(courses.length, MAX_PERSONAL)) : 0
    const items: AiSuggestion[] = []
    if (collection) {
      const title = collection.title.trim().slice(0, MAX_LABEL)
      const m = mode === 'ask' ? 'quiz' : mode
      items.push({ mode: m, text: fillCollectionTemplate(m, title), topic: null, collection: { id: collection.id, title } })
    }
    items.push(...Array.from({ length: slots }, (_, i) => {
      const course = courses[i % courses.length]
      const m = mode === 'ask' ? MIXED_MODES[i % MIXED_MODES.length] : mode
      return { mode: m, text: fillTemplate(m, course.label), topic: { kind: course.kind, key: course.key } }
    }))
    items.length = Math.min(items.length, SUGGESTION_COUNT)
    // Chưa đủ ⇒ bù gợi ý mặc định của chế độ
    for (const fallback of DEFAULT_SUGGESTIONS[mode]) {
      if (items.length >= SUGGESTION_COUNT) break
      if (!items.some((s) => s.text === fallback.text)) items.push(fallback)
    }
    return { personalized: courses.length > 0 || !!collection, items }
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
