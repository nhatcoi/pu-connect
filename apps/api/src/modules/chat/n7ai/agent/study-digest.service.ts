import { Injectable } from '@nestjs/common'
import { DatabaseService } from '../../../../database/database.service'
import { CARD_STATUS_SQL, DUE_CARD_SQL, WEAK_CARD_SQL } from '../../../study-tools/study-progress.sql'

const RECENT_SETS = 3
const WEAK_PER_SET = 5
const WEAK_CHARS = 40
const RECENT_DAYS = 30

export interface StudyDigestSet {
  title: string
  kind: 'flashcards' | 'quiz'
  items: number
  lastStudied: string | null // YYYY-MM-DD
  learned: number
  due: number
  weak: string[] // mặt trước các thẻ hay quên nhất
  bestScore: number | null
}

// Tóm tắt tiến độ học (≤ 3 bộ học gần nhất trong 30 ngày) tính lúc hỏi từ lịch ôn
// Thay cho "ghi bộ nhớ sau mỗi lần ôn": luôn mới, không trùng lặp, không tốn lượt gọi tool; chỉ khi bật connector my_study
@Injectable()
export class StudyDigestService {
  constructor(private readonly db: DatabaseService) {}

  async recent(userId: string): Promise<StudyDigestSet[]> {
    const res = await this.db.query(
      `SELECT s.title, s.kind, s.item_count, s.best_score, s.last_studied_at,
              COUNT(i.id) FILTER (WHERE (${CARD_STATUS_SQL}) = 'learned')::int AS learned,
              COUNT(i.id) FILTER (WHERE ${DUE_CARD_SQL})::int AS due,
              (array_agg(left(i.content->>'front', ${WEAK_CHARS}) ORDER BY i.lapses DESC, i.ease ASC) FILTER (WHERE ${WEAK_CARD_SQL}))[1:${WEAK_PER_SET}] AS weak
       FROM study_sets s LEFT JOIN study_items i ON i.set_id = s.id
       WHERE s.owner_id = $1 AND s.last_studied_at >= NOW() - make_interval(days => ${RECENT_DAYS})
       GROUP BY s.id
       ORDER BY s.last_studied_at DESC
       LIMIT ${RECENT_SETS}`,
      [userId]
    )
    return res.rows.map((r) => ({
      title: r.title,
      kind: r.kind,
      items: r.item_count,
      lastStudied: r.last_studied_at ? new Date(r.last_studied_at).toISOString().slice(0, 10) : null,
      learned: r.learned,
      due: r.due,
      weak: r.weak ?? [],
      bestScore: r.best_score
    }))
  }
}

// Khối <study_progress> cho system prompt (dữ liệu, không phải chỉ dẫn)
export function studyDigestPrompt(sets: StudyDigestSet[]): string {
  if (!sets.length) return ''
  const lines = sets.map((s) =>
    s.kind === 'flashcards'
      ? `- Flashcard "${s.title}" (${s.items} thẻ, học gần nhất ${s.lastStudied}): đã thuộc ${s.learned}, đến hạn ôn ${s.due}${s.weak.length ? `, hay quên: ${s.weak.join('; ')}` : ''}`
      : `- Quiz "${s.title}" (${s.items} câu, làm gần nhất ${s.lastStudied})${s.bestScore != null ? `: điểm cao nhất ${s.bestScore}%` : ''}`
  )
  return `

Tiến độ học gần đây của người học trong Công cụ (tự tính, dùng để cá nhân hóa: nhắc ôn thẻ đến hạn / từ hay quên khi liên quan; chi tiết từng thẻ thì gọi công cụ my_study__*):
<study_progress>
${lines.join('\n')}
</study_progress>`
}
