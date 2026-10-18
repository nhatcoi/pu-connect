import { Layers, ListChecks, type LucideIcon } from 'lucide-react'
import {
  STUDY_TOOL_KINDS,
  type FlashcardContent,
  type FlashcardTemplate,
  type QuizQuestionContent,
  type StudyItemContent,
  type StudySetOptions,
  type StudyToolKind
} from '@pu/schemas'

// Danh mục công cụ học tập: thêm loại mới = thêm 1 mục ở đây + trình học tương ứng
export interface ToolMeta {
  kind: StudyToolKind
  label: string
  tagline: string
  icon: LucideIcon
  itemLabel: string // "thẻ", "câu"
  aiHint: string // gợi ý ô "Tạo bằng N7AI"
}

export const TOOL_META: Record<StudyToolKind, ToolMeta> = {
  flashcards: {
    kind: 'flashcards',
    label: 'Flashcard',
    tagline: 'Thẻ ghi nhớ, ôn đúng lúc sắp quên',
    icon: Layers,
    itemLabel: 'thẻ',
    aiHint: 'Chủ đề (vd. "Đạo hàm cơ bản") hoặc dán danh sách từ vựng…'
  },
  quiz: {
    kind: 'quiz',
    label: 'Quiz',
    tagline: 'Trắc nghiệm tự kiểm tra, lưu điểm cao nhất',
    icon: ListChecks,
    itemLabel: 'câu',
    aiHint: 'Chủ đề (vd. "Cấu trúc dữ liệu — cây nhị phân") hoặc dán nội dung bài…'
  }
}

export const TOOLS = STUDY_TOOL_KINDS.map((k) => TOOL_META[k])

export const isToolKind = (v: string): v is StudyToolKind => (STUDY_TOOL_KINDS as readonly string[]).includes(v)

export const toolHref = (kind: StudyToolKind, id?: string) => (id ? `/tools/${kind}/${id}` : `/tools/${kind}`)

// Mục trống khi thêm dòng mới trong trình soạn
export const emptyContent = (kind: StudyToolKind): StudyItemContent =>
  kind === 'flashcards' ? { front: '', back: '' } : { q: '', options: ['', '', '', ''], answer: 0, explain: '' }

export const asCard = (c: StudyItemContent) => c as FlashcardContent
export const asQuestion = (c: StudyItemContent) => c as QuizQuestionContent

// Mẫu bộ flashcard: Từ vựng hiện sẵn ô phiên âm, ví dụ + nút phát âm
export const FLASHCARD_TEMPLATE_META: Record<FlashcardTemplate, { label: string; hint: string }> = {
  basic: { label: 'Cơ bản', hint: 'Mặt trước · mặt sau' },
  vocab: { label: 'Từ vựng', hint: 'Thêm phiên âm, ví dụ, phát âm' }
}

export const isVocab = (options?: StudySetOptions | null) => options?.template === 'vocab'
// Nút phát âm: bộ từ vựng hoặc đã chọn ngôn ngữ
export const hasSpeech = (options?: StudySetOptions | null) => isVocab(options) || !!options?.lang

const IPA = /^\/.*\/$|^\[.*]$/

// Dán danh sách ⇒ thẻ, mỗi dòng 1 thẻ:
// "mặt trước <tab | - | : | => > mặt sau" hoặc cột "|": từ | nghĩa · từ | /phiên âm/ | nghĩa · từ | /phiên âm/ | nghĩa | ví dụ
export function parseCardLines(text: string): FlashcardContent[] {
  return text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line): FlashcardContent | null => {
      if (line.includes('|')) {
        const cols = line.split('|').map((c) => c.trim())
        const [front, second = '', third = '', fourth = ''] = cols
        if (IPA.test(second)) return { front, back: third, phonetic: second, ...(fourth ? { example: fourth } : {}) }
        return { front, back: second, ...(third ? { example: third } : {}) }
      }
      const m = /^(.+?)\s*(?:\t|\s[-–—:=]>?\s|\s?=>\s?|:\s)\s*(.+)$/.exec(line)
      return m ? { front: m[1].trim(), back: m[2].trim() } : null
    })
    .filter((c): c is FlashcardContent => !!c && !!c.front && !!c.back)
}
