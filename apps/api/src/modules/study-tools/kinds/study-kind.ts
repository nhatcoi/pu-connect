import type { z } from 'zod'
import type { StudyItemContent, StudySetOptions, StudyToolKind } from '@pu/schemas'

export const STUDY_SET_MAX_ITEMS = 200 // mục tối đa / bộ
export const STUDY_AI_MAX_ITEMS = 60 // mục tối đa N7AI tạo 1 lần

// Khai báo 1 loại công cụ dạng "bộ nhiều mục" (Flashcard, Quiz…): dữ liệu, tùy chọn, hợp đồng với N7AI
// One study-set tool kind: item schema, set options, and the N7AI tool contract — the single source for API, LLM and chat fences
export interface StudyKindDef<C extends StudyItemContent = StudyItemContent> {
  kind: StudyToolKind
  label: string // "Flashcard"
  itemLabel: string // "thẻ"
  item: z.ZodType<C, z.ZodTypeDef, unknown> // nội dung 1 mục (kiểm khi lưu, sinh JSON Schema cho N7AI)
  aiItem?: z.ZodType<C, z.ZodTypeDef, unknown> // bản N7AI được tạo (bỏ trường chỉ người dùng đặt, vd. ảnh); mặc định = item
  options: z.ZodType<StudySetOptions, z.ZodTypeDef, unknown> // tùy chọn cấp bộ (lỗi ⇒ bỏ trường, không từ chối bộ)
  // Khối ```<fence> trong tin chat (web hiển thị, Thư viện › Học liệu) — JSON { title, ...options, [itemsKey]: [] }
  fence: string
  itemsKey: string
  ai: {
    tool: string // tên tool N7AI gọi, vd. create_flashcards
    description: string // mô tả tool (khi nào gọi)
    instructions: string // quy tắc nội dung (đưa vào system prompt khi có tool)
    defaultTitle: string
  }
}
