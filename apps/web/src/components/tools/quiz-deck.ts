import { correctAnswers, isQuestionCorrect, type QuizQuestionContent, type StudyItem } from '@pu/schemas'
import { asQuestion } from './tool-catalog'

// Cấu hình 1 lượt làm quiz (chọn ở màn bắt đầu, không lưu vào bộ)
export interface QuizRunOptions {
  shuffleQuestions: boolean
  shuffleOptions: boolean
  timeLimitMinutes: number | null // null = không giới hạn
}
export const DEFAULT_RUN_OPTIONS: QuizRunOptions = { shuffleQuestions: false, shuffleOptions: false, timeLimitMinutes: null }
export const TIME_LIMIT_CHOICES = [5, 10, 15, 30, 60] as const

// 1 câu đã sẵn sàng làm: đáp án giữ chỉ số gốc (shown[i].index) ⇒ trộn lựa chọn vẫn chấm đúng
export interface DeckQuestion {
  itemId: string
  content: QuizQuestionContent
  shown: { text: string; index: number }[]
}

function shuffled<T>(list: T[], rng: () => number): T[] {
  const a = [...list]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

// Câu Đúng/Sai luôn giữ thứ tự "Đúng, Sai" (trộn gây rối)
export function buildDeck(items: StudyItem[], opts: QuizRunOptions, rng: () => number = Math.random): DeckQuestion[] {
  const base = opts.shuffleQuestions ? shuffled(items, rng) : items
  return base.map((it) => {
    const content = asQuestion(it.content)
    const shown = content.options.map((text, index) => ({ text, index }))
    return { itemId: it.id, content, shown: opts.shuffleOptions && content.type !== 'truefalse' ? shuffled(shown, rng) : shown }
  })
}

export const rightAnswers = (q: DeckQuestion) => correctAnswers(q.content)
export const isDeckCorrect = (q: DeckQuestion, picked: number[] | null) => picked !== null && isQuestionCorrect(q.content, picked)

export function formatDuration(totalSeconds: number): string {
  const s = Math.max(0, Math.round(totalSeconds))
  const m = Math.floor(s / 60)
  return `${m}:${String(s % 60).padStart(2, '0')}`
}
