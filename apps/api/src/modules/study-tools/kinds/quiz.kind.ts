import { z } from 'zod'
import type { QuizQuestionContent } from '@pu/schemas'
import { STUDY_AI_MAX_ITEMS, type StudyKindDef } from './study-kind'

export const QuizQuestionContentSchema = z
  .object({
    q: z.string().trim().min(1, { message: 'Câu hỏi trống' }).max(1000).describe('Question (Markdown / $LaTeX$)'),
    options: z
      .array(z.string().trim().min(1, { message: 'Lựa chọn trống' }).max(300))
      .min(2, { message: 'Ít nhất 2 lựa chọn' })
      .max(6)
      .describe('Answer choices, usually 4, with plausible distractors'),
    answer: z.number().int().min(0).describe('0-based index of the correct option (for type "multi": the first correct one)'),
    type: z
      .enum(['single', 'multi', 'truefalse'])
      .optional()
      .describe('single (default): one correct option · multi: several correct options listed in "answers" · truefalse: exactly 2 options ["Đúng","Sai"]'),
    answers: z.array(z.number().int().min(0)).max(6).optional().describe('Only for type "multi": 0-based indexes of ALL correct options'),
    explain: z.string().trim().max(1000).optional().describe('Why the correct option is right')
  })
  .refine((v) => v.answer < v.options.length, { message: 'Đáp án đúng không hợp lệ', path: ['answer'] })
  .refine((v) => v.type !== 'truefalse' || v.options.length === 2, { message: 'Câu Đúng/Sai có đúng 2 lựa chọn', path: ['options'] })
  .refine((v) => v.type !== 'multi' || (!!v.answers?.length && v.answers.every((a) => a < v.options.length)), { message: 'Chọn ít nhất 1 đáp án đúng', path: ['answers'] })

export const quizKind: StudyKindDef<QuizQuestionContent> = {
  kind: 'quiz',
  label: 'Quiz',
  itemLabel: 'câu',
  item: QuizQuestionContentSchema,
  options: z.object({}).catch({}),
  fence: 'quiz',
  itemsKey: 'questions',
  ai: {
    tool: 'create_quiz',
    description:
      'Create a multiple-choice quiz and save it to the user\'s PU Connect Tools › Quiz (scored, best score kept). Use when the user wants to test themselves or asks for a quiz / practice questions.',
    instructions: `Default 5 questions, 4 options, one correct, difficulty increasing; use type "multi" (with "answers") only when several options are truly correct and "truefalse" for statements to judge, otherwise omit type; follow the user's requested count (max ${Math.min(30, STUDY_AI_MAX_ITEMS)}). Never reveal answers outside the tool call.`,
    defaultTitle: 'Quiz từ N7AI'
  }
}
