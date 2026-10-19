import { z } from 'zod'
import { zodToJsonSchema } from 'zod-to-json-schema'
import type { StudyItemContent, StudySetOptions, StudyToolKind } from '@pu/schemas'
import { flashcardsKind } from './flashcards.kind'
import { quizKind } from './quiz.kind'
import { STUDY_AI_MAX_ITEMS, STUDY_SET_MAX_ITEMS, type StudyKindDef } from './study-kind'

// Danh mục loại công cụ dạng bộ: thêm loại mới = thêm 1 file kinds/<kind>.kind.ts + 1 dòng ở đây (+ CHECK kind trong SQL, trình học ở web)
// Registry of study-set kinds; API validation, N7AI tools and chat fences all read from here
export const STUDY_KINDS: Record<StudyToolKind, StudyKindDef> = {
  flashcards: flashcardsKind,
  quiz: quizKind
}
export const STUDY_KIND_LIST = Object.values(STUDY_KINDS)

export const kindByTool = (tool: string) => STUDY_KIND_LIST.find((k) => k.ai.tool === tool) ?? null

// Tham số tool N7AI = khung { title, description?, options } + { <itemsKey>: [...] }; mục kiểm riêng từng mục (lưu phần hợp lệ)
export function aiFrameSchema(def: StudyKindDef) {
  return z.object({
    title: z.string().trim().min(1).max(120).describe('Deck title ≤ 60 characters, in the user\'s language'),
    description: z.string().trim().max(300).optional().describe('One sentence ≤ 120 characters'),
    options: def.options.optional()
  })
}
const aiItem = (def: StudyKindDef) => def.aiItem ?? def.item
export const aiInputSchema = (def: StudyKindDef) => aiFrameSchema(def).extend({ [def.itemsKey]: z.array(aiItem(def)).min(1).max(STUDY_AI_MAX_ITEMS) })

// JSON Schema cho tool calling (OpenAI-compatible); sinh 1 lần
const jsonSchemas = new Map<StudyToolKind, Record<string, unknown>>()
export function aiParameters(def: StudyKindDef): Record<string, unknown> {
  let schema = jsonSchemas.get(def.kind)
  if (!schema) {
    // as never: tránh suy luận kiểu quá sâu của zod-to-json-schema
    const { $schema: _drop, ...rest } = zodToJsonSchema(aiInputSchema(def) as never, { target: 'openApi3', $refStrategy: 'none' }) as Record<string, unknown>
    void _drop
    schema = rest
    jsonSchemas.set(def.kind, schema)
  }
  return schema
}

// Khối ```<fence> chuẩn từ dữ liệu đã kiểm ⇒ chèn vào tin N7AI (web dựng bộ thẻ tương tác, Thư viện › Học liệu)
export function studyFence(def: StudyKindDef, set: { title: string; options?: object; items: StudyItemContent[] }): string {
  return `\`\`\`${def.fence}\n${JSON.stringify({ title: set.title, ...(set.options ?? {}), [def.itemsKey]: set.items })}\n\`\`\``
}

export interface AiStudySet {
  kind: StudyToolKind
  title: string
  description: string | null
  options: StudySetOptions
  items: StudyItemContent[]
}
const MAX_ISSUES = 8

// Kiểm bộ N7AI sinh (tool call / bản nháp): mục hỏng bỏ riêng + báo lại; khung hỏng hoặc không còn mục ⇒ lỗi kèm issues để model sửa
// Validate an N7AI-generated set: keep valid items, report skipped ones; frame errors are returned for the model to fix
export function validateAiSet(def: StudyKindDef, args: Record<string, unknown>): { set: AiStudySet; skipped: string[] } | { issues: string[] } {
  const raw = Array.isArray(args[def.itemsKey]) ? (args[def.itemsKey] as unknown[]) : []
  const items: StudyItemContent[] = []
  const skipped: string[] = []
  raw.slice(0, STUDY_SET_MAX_ITEMS).forEach((it, i) => {
    const r = aiItem(def).safeParse(it)
    if (r.success) items.push(r.data)
    else skipped.push(`${def.itemsKey}.${i}.${r.error.issues[0]?.path.join('.') ?? ''}: ${r.error.issues[0]?.message ?? 'invalid'}`)
  })
  const frame = aiFrameSchema(def).safeParse(args)
  if (!frame.success) return { issues: frame.error.issues.slice(0, MAX_ISSUES).map((i) => `${i.path.join('.') || '(root)'}: ${i.message}`) }
  if (!items.length) return { issues: [`${def.itemsKey}: no valid item`, ...skipped].slice(0, MAX_ISSUES) }
  const options = def.options.safeParse(frame.data.options ?? {})
  return {
    set: { kind: def.kind, title: frame.data.title, description: frame.data.description ?? null, options: options.success ? options.data : {}, items },
    skipped: skipped.slice(0, MAX_ISSUES)
  }
}
