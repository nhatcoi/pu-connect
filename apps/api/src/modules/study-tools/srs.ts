import type { ReviewGrade } from '@pu/schemas'

// Ôn lặp lại ngắt quãng (SM-2 rút gọn, kiểu Anki)
// Spaced repetition (simplified SM-2): grade ⇒ next interval, ease, due date

export interface SrsState {
  intervalDays: number
  ease: number
  reps: number
  lapses: number
}

const MIN_EASE = 1.3
const MAX_INTERVAL_DAYS = 365
const AGAIN_MINUTES = 10 // Quên ⇒ gặp lại sau 10 phút trong phiên

export function nextReview(state: SrsState, grade: ReviewGrade, now = new Date()): SrsState & { dueAt: Date } {
  let { intervalDays, ease, reps, lapses } = state

  if (grade === 'again') {
    lapses += 1
    reps = 0
    ease = Math.max(MIN_EASE, ease - 0.2)
    intervalDays = 0
    return { intervalDays, ease, reps, lapses, dueAt: new Date(now.getTime() + AGAIN_MINUTES * 60_000) }
  }

  if (grade === 'hard') ease = Math.max(MIN_EASE, ease - 0.15)
  if (grade === 'easy') ease += 0.15

  if (reps === 0) intervalDays = grade === 'easy' ? 4 : grade === 'good' ? 1 : 0.5
  else if (reps === 1) intervalDays = grade === 'easy' ? 7 : grade === 'good' ? 3 : 1.5
  else intervalDays = intervalDays * (grade === 'hard' ? 1.2 : grade === 'easy' ? ease * 1.3 : ease)

  intervalDays = Math.min(MAX_INTERVAL_DAYS, Math.round(intervalDays * 10) / 10)
  reps += 1
  return { intervalDays, ease: Math.round(ease * 100) / 100, reps, lapses, dueAt: new Date(now.getTime() + intervalDays * 86_400_000) }
}
