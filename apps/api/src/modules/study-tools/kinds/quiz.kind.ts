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
    answer: z.number().int().min(0).describe('0-based index of the correct option'),
    explain: z.string().trim().max(1000).optional().describe('Why the correct option is right')
  })
  .refine((v) => v.answer < v.options.length, { message: 'Đáp án đúng không hợp lệ', path: ['answer'] })

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
      'Create a multiple-choice quiz and save it to the user\'s PU Connector Tools › Quiz (scored, best score kept). Use when the user wants to test themselves or asks for a quiz / practice questions.',
    instructions: `Default 5 questions, 4 options, one correct, difficulty increasing; follow the user's requested count (max ${Math.min(30, STUDY_AI_MAX_ITEMS)}). Never reveal answers outside the tool call.`,
    defaultTitle: 'Quiz từ N7AI'
  }
}
