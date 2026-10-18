import { z } from 'zod'
import type { StudyAttemptInput, StudyReviewInput, StudySetDraftInput, StudyToolKind } from '@pu/schemas'

// @pu/schemas là mã TS nguồn ⇒ API khai báo lại schema runtime (giữ khớp bằng kiểm tra kiểu ở cuối file)
export const STUDY_TOOL_KINDS = ['flashcards', 'quiz'] as const satisfies readonly StudyToolKind[]
export const STUDY_SET_MAX_ITEMS = 200
export const STUDY_SET_LIMIT = 300 // số bộ tối đa mỗi người

export const FlashcardContentSchema = z.object({
  front: z.string().trim().min(1, { message: 'Mặt trước trống' }).max(500),
  back: z.string().trim().min(1, { message: 'Mặt sau trống' }).max(2000)
})

export const QuizQuestionContentSchema = z
  .object({
    q: z.string().trim().min(1, { message: 'Câu hỏi trống' }).max(1000),
    options: z.array(z.string().trim().min(1, { message: 'Lựa chọn trống' }).max(300)).min(2, { message: 'Ít nhất 2 lựa chọn' }).max(6),
    answer: z.number().int().min(0),
    explain: z.string().trim().max(1000).optional()
  })
  .refine((v) => v.answer < v.options.length, { message: 'Đáp án đúng không hợp lệ', path: ['answer'] })

const ItemSchema = z.object({ id: z.string().uuid().optional(), content: z.unknown() })

// Nội dung item kiểm theo loại bộ (flashcard / quiz)
export const StudySetBodySchema = z
  .object({
    kind: z.enum(STUDY_TOOL_KINDS),
    title: z.string().trim().min(1, { message: 'Nhập tên bộ' }).max(120),
    description: z.string().trim().max(300).nullable().optional(),
    items: z
      .array(ItemSchema)
      .min(1, { message: 'Thêm ít nhất 1 mục' })
      .max(STUDY_SET_MAX_ITEMS, { message: `Tối đa ${STUDY_SET_MAX_ITEMS} mục` })
  })
  .transform((v, ctx) => {
    const schema = v.kind === 'flashcards' ? FlashcardContentSchema : QuizQuestionContentSchema
    const items = v.items.map((it, i) => {
      const parsed = schema.safeParse(it.content)
      if (!parsed.success) {
        ctx.addIssue({ code: 'custom', path: ['items', i], message: `Mục ${i + 1}: ${parsed.error.issues[0]?.message ?? 'không hợp lệ'}` })
        return null
      }
      return { id: it.id, content: parsed.data }
    })
    return { ...v, items: items.filter((it): it is NonNullable<typeof it> => it !== null) }
  })
export type StudySetBody = z.infer<typeof StudySetBodySchema>

export const StudySetDraftBodySchema = z.object({
  kind: z.enum(STUDY_TOOL_KINDS),
  prompt: z.string().trim().min(3, { message: 'Nhập chủ đề hoặc nội dung' }).max(8000, { message: 'Nội dung tối đa 8000 ký tự' })
})

export const StudySetListQuerySchema = z.object({
  kind: z.enum(STUDY_TOOL_KINDS).optional(),
  q: z.string().trim().max(100).default('')
})

export const StudyReviewBodySchema = z.object({
  itemId: z.string().uuid(),
  grade: z.enum(['again', 'hard', 'good', 'easy'])
})

export const StudyAttemptBodySchema = z
  .object({ correct: z.number().int().min(0), total: z.number().int().min(1).max(STUDY_SET_MAX_ITEMS) })
  .refine((v) => v.correct <= v.total, { message: 'Số câu đúng không hợp lệ' })

// Báo lỗi biên dịch nếu lệch với @pu/schemas (API không bật strict ⇒ kiểm chiều interface → schema)
const _draft: z.infer<typeof StudySetDraftBodySchema> = {} as StudySetDraftInput
const _review: z.infer<typeof StudyReviewBodySchema> = {} as StudyReviewInput
const _attempt: z.infer<typeof StudyAttemptBodySchema> = {} as StudyAttemptInput
void [_draft, _review, _attempt]
