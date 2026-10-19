import type { StudyItemContent, StudySetOptions, StudyToolKind } from '@pu/schemas'
import { STUDY_SET_MAX_ITEMS } from './kinds/study-kind'
import { STUDY_KIND_LIST } from './kinds/study-kinds.registry'

// Khối học tập N7AI tự viết trong câu trả lời (```flashcards / ```quiz chứa JSON) — đường dự phòng khi model không gọi tool
// Legacy fallback: study fences written inline by the model (same format the web renders)
export interface ParsedStudyBlock {
  kind: StudyToolKind
  title: string
  options: StudySetOptions
  items: StudyItemContent[]
}

const BLOCK = new RegExp(`\`\`\`(${STUDY_KIND_LIST.map((k) => k.fence).join('|')})\\s*\\n([\\s\\S]*?)\`\`\``, 'g')

export const hasStudyFence = (text: string) => new RegExp(BLOCK.source).test(text)

export function parseStudyBlocks(text: string): ParsedStudyBlock[] {
  const out: ParsedStudyBlock[] = []
  for (const [, fence, body] of text.matchAll(BLOCK)) {
    const def = STUDY_KIND_LIST.find((k) => k.fence === fence)
    let json: any
    try {
      json = JSON.parse(body)
    } catch {
      continue
    }
    if (!def) continue
    const raw: unknown = Array.isArray(json) ? json : json?.[def.itemsKey]
    if (!Array.isArray(raw)) continue
    const items = raw
      .map((it) => (def.aiItem ?? def.item).safeParse(it)) // khối do N7AI viết ⇒ bỏ trường chỉ người dùng đặt (ảnh)
      .filter((r) => r.success)
      .map((r) => r.data as StudyItemContent)
      .slice(0, STUDY_SET_MAX_ITEMS)
    if (!items.length) continue
    const options = def.options.safeParse(Array.isArray(json) ? {} : json)
    const title = typeof json?.title === 'string' && json.title.trim() ? json.title.trim().slice(0, 120) : def.ai.defaultTitle
    out.push({ kind: def.kind, title, options: options.success ? options.data : {}, items })
  }
  return out
}
