import { FLASHCARD_TEMPLATES, hasCloze, SPEECH_LANGS, type FlashcardContent, type FlashcardTemplate, type SpeechLang } from '@pu/schemas'

// Tách câu trả lời AI thành đoạn Markdown + khối học tập tương tác (```quiz / ```flashcards chứa JSON)

export interface QuizData {
  title?: string
  questions: { q: string; options: string[]; answer: number; explain?: string }[]
}
// Khối chuẩn do server chèn sau khi N7AI gọi tool create_flashcards (kèm mẫu + ngôn ngữ phát âm)
export interface FlashcardData {
  title?: string
  template?: FlashcardTemplate
  lang?: SpeechLang
  cards: FlashcardContent[]
}

export type Segment =
  | { type: 'markdown'; text: string }
  | { type: 'quiz'; data: QuizData }
  | { type: 'flashcards'; data: FlashcardData }
  | { type: 'pending'; kind: 'quiz' | 'flashcards' } // khối đang stream dở

const BLOCK = /```(quiz|flashcards)\s*\n([\s\S]*?)(```|$)/g

function parseQuiz(raw: unknown): QuizData | null {
  const d = raw as QuizData
  if (!d || !Array.isArray(d.questions)) return null
  const questions = d.questions.filter(
    (q) =>
      q &&
      typeof q.q === 'string' &&
      Array.isArray(q.options) &&
      q.options.length >= 2 &&
      Number.isInteger(q.answer) &&
      q.answer >= 0 &&
      q.answer < q.options.length
  )
  return questions.length ? { title: d.title, questions } : null
}

function parseCards(raw: unknown): FlashcardData | null {
  const d = (Array.isArray(raw) ? { cards: raw } : raw) as FlashcardData
  if (!d || !Array.isArray(d.cards)) return null
  const cards = d.cards
    .filter((c) => c && typeof c.front === 'string' && c.front && (typeof c.back === 'string' ? !!c.back || hasCloze(c.front) : hasCloze(c.front)))
    .map((c) => ({
      front: c.front,
      back: typeof c.back === 'string' ? c.back : '',
      ...(typeof c.phonetic === 'string' && c.phonetic ? { phonetic: c.phonetic } : {}),
      ...(typeof c.example === 'string' && c.example ? { example: c.example } : {}),
      ...(typeof c.image === 'string' && c.image.startsWith('https://') ? { image: c.image } : {})
    }))
  if (!cards.length) return null
  return {
    title: d.title,
    ...(FLASHCARD_TEMPLATES.includes(d.template as FlashcardTemplate) ? { template: d.template } : {}),
    ...(SPEECH_LANGS.includes(d.lang as SpeechLang) ? { lang: d.lang } : {}),
    cards
  }
}

export function splitStudyBlocks(content: string): Segment[] {
  const out: Segment[] = []
  let last = 0
  for (const m of content.matchAll(BLOCK)) {
    const [whole, kind, body, close] = m
    const before = content.slice(last, m.index)
    if (before.trim()) out.push({ type: 'markdown', text: before })
    last = (m.index ?? 0) + whole.length
    if (!close) {
      out.push({ type: 'pending', kind: kind as 'quiz' | 'flashcards' })
      continue
    }
    try {
      const json = JSON.parse(body)
      const data = kind === 'quiz' ? parseQuiz(json) : parseCards(json)
      if (data) {
        out.push(kind === 'quiz' ? { type: 'quiz', data: data as QuizData } : { type: 'flashcards', data: data as FlashcardData })
        continue
      }
    } catch {
      // JSON hỏng ⇒ hiện như khối code thường
    }
    out.push({ type: 'markdown', text: whole })
  }
  const rest = content.slice(last)
  if (rest.trim()) out.push({ type: 'markdown', text: rest })
  return out
}
