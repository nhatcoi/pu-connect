import { z } from 'zod'

// ==========================================================
// Công cụ học tập (/tools): bộ Flashcard, bộ Quiz… tạo tay hoặc N7AI tạo / tự lưu từ chat
// Study tools: flashcard decks, quiz sets — manual CRUD, N7AI drafts, auto-saved from chat
// ==========================================================

export const STUDY_TOOL_KINDS = ['flashcards', 'quiz'] as const
export type StudyToolKind = (typeof STUDY_TOOL_KINDS)[number]

export const STUDY_SET_MAX_ITEMS = 200

// Thẻ ghi nhớ / câu trắc nghiệm (nội dung Markdown)
export const FlashcardContentSchema = z.object({
  front: z.string().trim().min(1, { message: 'Mặt trước trống' }).max(500),
  back: z.string().trim().min(1, { message: 'Mặt sau trống' }).max(2000)
})
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

// Gắn vào tin N7AI khi bộ thẻ / quiz đã tự lưu vào Công cụ
export interface ChatStudySetRef {
  id: string
  kind: StudyToolKind
  title: string
}
