import { z } from 'zod'

// ==========================================================
// Công cụ học tập (/tools): bộ Flashcard, bộ Quiz… tạo tay hoặc N7AI tạo / tự lưu từ chat
// Study tools: flashcard decks, quiz sets — manual CRUD, N7AI drafts, auto-saved from chat
// ==========================================================

export const STUDY_TOOL_KINDS = ['flashcards', 'quiz'] as const
export type StudyToolKind = (typeof STUDY_TOOL_KINDS)[number]

export const STUDY_SET_MAX_ITEMS = 200

// Mẫu bộ flashcard: chỉ quyết định ô nào hiện trong trình soạn / màn ôn (dữ liệu thẻ chung 1 kiểu)
// Flashcard template: which optional fields the editor and reviewer show
export const FLASHCARD_TEMPLATES = ['basic', 'vocab', 'cloze'] as const
export type FlashcardTemplate = (typeof FLASHCARD_TEMPLATES)[number]

// Ngôn ngữ phát âm (Web Speech API, BCP 47); không đặt ⇒ tự nhận theo nội dung thẻ
export const SPEECH_LANGS = ['en-US', 'en-GB', 'vi-VN', 'zh-CN', 'ja-JP', 'ko-KR', 'fr-FR', 'de-DE', 'es-ES', 'ru-RU'] as const
export type SpeechLang = (typeof SPEECH_LANGS)[number]

// Tùy chọn cấp bộ (cột study_sets.options)
export interface StudySetOptions {
  template?: FlashcardTemplate
  lang?: SpeechLang // ngôn ngữ mặt trước (từ cần học)
}

// Điền chỗ trống: mặt trước chứa {{đáp án}} hoặc {{đáp án::gợi ý}} ⇒ khi ôn ẩn đi, mặt sau thành ghi chú (không bắt buộc)
// Cloze deletion markers inside the front text
export const CLOZE_PATTERN = /\{\{([^{}]+?)\}\}/g
export const hasCloze = (text: string) => /\{\{[^{}]+?\}\}/.test(text)

// Thẻ ghi nhớ / câu trắc nghiệm (nội dung Markdown); phiên âm, ví dụ, ảnh không bắt buộc
export const FlashcardContentSchema = z
  .object({
    front: z.string().trim().min(1, { message: 'Mặt trước trống' }).max(500),
    back: z.string().trim().max(2000).default(''),
    phonetic: z.string().trim().max(120).optional(),
    example: z.string().trim().max(600).optional(),
    image: z.string().trim().url({ message: 'Link ảnh không hợp lệ' }).max(500).startsWith('https://', { message: 'Ảnh phải là link https' }).optional()
  })
  .refine((c) => c.back.length > 0 || hasCloze(c.front), { message: 'Mặt sau trống', path: ['back'] })
export type FlashcardContent = z.infer<typeof FlashcardContentSchema>

export const QuizQuestionContentSchema = z
  .object({
    q: z.string().trim().min(1, { message: 'Câu hỏi trống' }).max(1000),
    options: z.array(z.string().trim().min(1, { message: 'Lựa chọn trống' }).max(300)).min(2, { message: 'Ít nhất 2 lựa chọn' }).max(6),
    answer: z.number().int().min(0),
    explain: z.string().trim().max(1000).optional()
  })
  .refine((v) => v.answer < v.options.length, { message: 'Đáp án đúng không hợp lệ', path: ['answer'] })
export type QuizQuestionContent = z.infer<typeof QuizQuestionContentSchema>

export type StudyItemContent = FlashcardContent | QuizQuestionContent

// Ôn lặp lại ngắt quãng (SM-2 rút gọn): Quên · Khó · Nhớ · Dễ
export const REVIEW_GRADES = ['again', 'hard', 'good', 'easy'] as const
export type ReviewGrade = (typeof REVIEW_GRADES)[number]

export interface StudyItem {
  id: string
  position: number
  content: StudyItemContent
  // Chỉ flashcard: lịch ôn
  dueAt: string | null
  intervalDays: number
  reps: number
}

export interface StudySetSummary {
  id: string
  kind: StudyToolKind
  title: string
  description: string | null
  source: 'manual' | 'n7ai'
  options: StudySetOptions
  itemCount: number
  dueCount: number // flashcard: số thẻ đến hạn ôn (thẻ mới tính là đến hạn)
  bestScore: number | null // quiz: % cao nhất
  attempts: number
  lastStudiedAt: string | null
  sourceMessageId: string | null
  createdAt: string
  updatedAt: string
}

export interface StudySetDetail extends StudySetSummary {
  items: StudyItem[]
}

// Trang tổng quan /tools
export interface StudyToolsOverview {
  kinds: { kind: StudyToolKind; sets: number; items: number; due: number }[]
  recent: StudySetSummary[]
}

// Tạo / sửa bộ: items có id ⇒ giữ lịch ôn của thẻ đó
export interface StudySetItemInput {
  id?: string
  content: StudyItemContent
}
export interface StudySetInput {
  kind: StudyToolKind
  title: string
  description?: string | null
  options?: StudySetOptions
  items: StudySetItemInput[]
}

export interface StudySetDraftInput {
  kind: StudyToolKind
  prompt: string
}
export type StudySetDraft = Omit<StudySetInput, 'items'> & { items: { content: StudyItemContent }[] }

export interface StudyReviewInput {
  itemId: string
  grade: ReviewGrade
}
export interface StudyAttemptInput {
  correct: number
  total: number
}

// Thống kê học (nhật ký study_events, ngày theo giờ VN): chuỗi ngày, lịch nhiệt, thẻ đến hạn 7 ngày tới
export interface StudyStats {
  streak: number // số ngày liên tiếp có học, tính tới hôm nay (hoặc hôm qua nếu hôm nay chưa học)
  bestStreak: number
  today: number // lượt ôn + lần làm quiz hôm nay
  activeDays: number // số ngày có học trong lịch nhiệt
  heatmap: { day: string; count: number }[] // YYYY-MM-DD, chỉ ngày có học, STUDY_HEATMAP_DAYS ngày gần nhất
  forecast: { day: string; count: number }[] // 7 ngày tới (hôm nay gồm cả thẻ quá hạn, không gồm thẻ mới)
  newCards: number // thẻ chưa ôn lần nào
}
export const STUDY_HEATMAP_DAYS = 112 // 16 tuần

// Gắn vào tin N7AI khi bộ thẻ / quiz đã tự lưu vào Công cụ
export interface ChatStudySetRef {
  id: string
  kind: StudyToolKind
  title: string
}
