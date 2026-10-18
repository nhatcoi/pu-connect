import { Injectable, Logger } from '@nestjs/common'
import { DatabaseService } from '../../database/database.service'
import { CARD_STATUS_SQL, DUE_CARD_SQL, WEAK_CARD_SQL } from './study-progress.sql'

const WEAK_SHOWN = 5
const WEAK_CHARS = 40
const MAX_CONTENT = 300 // = giới hạn cột ai_memories.content
const KEEP_SETS = 10 // chỉ giữ mục tiến độ của 10 bộ học gần nhất

type SetProgress = {
  title: string
  kind: 'flashcards' | 'quiz'
  items: number
  learned: number
  due: number
  weak: string[] | null
  attempts: number
  bestScore: number | null
}

// Ngày/tháng giờ VN dạng 18/10 (ghép tay: ICU in vi-VN có thể ra 18-10)
const day = (d: Date) => {
  const parts = new Intl.DateTimeFormat('en-GB', { timeZone: 'Asia/Ho_Chi_Minh', day: '2-digit', month: '2-digit' }).formatToParts(d)
  const get = (type: string) => parts.find((p) => p.type === type)?.value
  return `${get('day')}/${get('month')}`
}

// Câu bộ nhớ ngắn, ngôi thứ ba (giống mục N7AI tự ghi)
export function progressMemoryText(p: SetProgress, at = new Date()): string {
  const text =
    p.kind === 'flashcards'
      ? `Đang ôn Flashcard "${p.title}" (${p.items} thẻ): đã thuộc ${p.learned}, đến hạn ôn ${p.due}` +
        (p.weak?.length ? `, hay quên: ${p.weak.join(', ')}` : '') +
        ` (cập nhật ${day(at)})`
      : `Đã làm Quiz "${p.title}" (${p.items} câu) ${p.attempts} lần` + (p.bestScore != null ? `, điểm cao nhất ${p.bestScore}%` : '') + ` (cập nhật ${day(at)})`
  return text.length <= MAX_CONTENT ? text : `${text.slice(0, MAX_CONTENT - 1)}…`
}

// Bộ nhớ N7AI tự ghi tiến độ: sau mỗi lần ôn flashcard / làm quiz ⇒ 1 mục / bộ (ai_memories.study_set_id), ghi đè mục cũ
// Tôn trọng công tắc "Cho phép N7AI ghi nhớ"; người dùng xóa mục ⇒ lần ôn sau ghi lại; bộ bị xóa ⇒ mục bị xóa theo (FK)
@Injectable()
export class StudyProgressMemoryService {
  private readonly logger = new Logger(StudyProgressMemoryService.name)

  constructor(private readonly db: DatabaseService) {}

  // Gọi sau khi ôn / làm bài xong (không chặn phản hồi; lỗi chỉ ghi log)
  record(userId: string, setId: string): void {
    void this.write(userId, setId).catch((err) => this.logger.warn(`Ghi tiến độ vào bộ nhớ N7AI thất bại: ${err?.message}`))
  }

  async write(userId: string, setId: string): Promise<string | null> {
    const res = await this.db.query(
      `SELECT s.title, s.kind, s.item_count AS items, s.attempts, s.best_score AS "bestScore",
              COUNT(i.id) FILTER (WHERE (${CARD_STATUS_SQL}) = 'learned')::int AS learned,
              COUNT(i.id) FILTER (WHERE ${DUE_CARD_SQL})::int AS due,
              (array_agg(left(i.content->>'front', ${WEAK_CHARS}) ORDER BY i.lapses DESC, i.ease ASC) FILTER (WHERE ${WEAK_CARD_SQL}))[1:${WEAK_SHOWN}] AS weak
       FROM study_sets s LEFT JOIN study_items i ON i.set_id = s.id
       WHERE s.id = $1 AND s.owner_id = $2
         AND COALESCE((SELECT memory_enabled FROM ai_settings WHERE user_id = $2), TRUE)
       GROUP BY s.id`,
      [setId, userId]
    )
    const progress = res.rows[0] as SetProgress | undefined
    if (!progress) return null
    const content = progressMemoryText(progress)
    await this.db.transaction(async (client) => {
      // Ghi đè (giữ cờ ghim); created_at = lần cập nhật ⇒ mục tiến độ mới được nhớ trước
      await client.query(
        `INSERT INTO ai_memories (user_id, content, source, study_set_id) VALUES ($1, $2, 'auto', $3)
         ON CONFLICT (user_id, study_set_id) WHERE study_set_id IS NOT NULL
         DO UPDATE SET content = EXCLUDED.content, created_at = NOW(), updated_at = NOW()`,
        [userId, content, setId]
      )
      await client.query(
        `DELETE FROM ai_memories WHERE id IN (
           SELECT id FROM ai_memories WHERE user_id = $1 AND study_set_id IS NOT NULL AND NOT pinned
           ORDER BY created_at DESC OFFSET ${KEEP_SETS})`,
        [userId]
      )
    })
    return content
  }
}
