import type { StudyItemContent, StudyToolKind } from '@pu/schemas'
import { FlashcardContentSchema, QuizQuestionContentSchema, STUDY_SET_MAX_ITEMS } from './dto/study-tools.dto'

// Khối học tập trong câu trả lời N7AI (```flashcards / ```quiz chứa JSON) ⇒ dữ liệu lưu vào Công cụ
// Same block format the web renders (apps/web/.../study-blocks.ts)
export interface ParsedStudyBlock {
  kind: StudyToolKind
  title: string
  items: StudyItemContent[]
}

const BLOCK = /```(quiz|flashcards)\s*\n([\s\S]*?)```/g

export function parseStudyBlocks(text: string): ParsedStudyBlock[] {
  const out: ParsedStudyBlock[] = []
  for (const [, tag, body] of text.matchAll(BLOCK)) {
    let json: any
    try {
      json = JSON.parse(body)
    } catch {
      continue
    }
    const kind: StudyToolKind = tag === 'quiz' ? 'quiz' : 'flashcards'
    const raw: unknown[] = kind === 'quiz' ? json?.questions : Array.isArray(json) ? json : json?.cards
    if (!Array.isArray(raw)) continue
    const schema = kind === 'quiz' ? QuizQuestionContentSchema : FlashcardContentSchema
    const items = raw
      .map((it) => schema.safeParse(it))
      .filter((r) => r.success)
      .map((r) => r.data as StudyItemContent)
      .slice(0, STUDY_SET_MAX_ITEMS)
    if (!items.length) continue
    const title = typeof json?.title === 'string' && json.title.trim() ? json.title.trim().slice(0, 120) : kind === 'quiz' ? 'Quiz từ N7AI' : 'Flashcard từ N7AI'
    out.push({ kind, title, items })
  }
  return out
}
