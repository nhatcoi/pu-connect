import type { AiMode, AiSuggestion, InterestKind } from '@pu/schemas'

type StudyMode = Exclude<AiMode, 'ask'>

// Mẫu câu theo chế độ học × loại chủ đề ({t} = tên môn / tag / từ khóa)
// Prompt templates per study mode and topic kind
const TEMPLATES: Record<StudyMode, Record<InterestKind, string>> = {
  explain: {
    course: 'Giải thích các khái niệm trọng tâm môn {t}',
    tag: 'Giải thích {t} bằng ví dụ dễ hiểu',
    query: 'Giải thích "{t}" bằng ví dụ dễ hiểu'
  },
  quiz: {
    course: 'Quiz 5 câu ôn tập môn {t}',
    tag: 'Quiz 5 câu về {t}',
    query: 'Quiz 5 câu về "{t}"'
  },
  flashcards: {
    course: 'Flashcard thuật ngữ quan trọng môn {t}',
    tag: 'Flashcard các ý chính về {t}',
    query: 'Flashcard về "{t}"'
  },
  summarize: {
    course: 'Tóm tắt kiến thức trọng tâm môn {t}',
    tag: 'Tóm tắt những điều cần biết về {t}',
    query: 'Tóm tắt những điều cần biết về "{t}"'
  },
  plan: {
    course: 'Lộ trình ôn {t} trong 7 ngày, mỗi ngày 2 tiếng',
    tag: 'Lộ trình tự học {t} trong 2 tuần',
    query: 'Lộ trình tự học "{t}" trong 2 tuần'
  }
}

// "Hỏi đáp": trộn nhiều chế độ để người mới thấy N7AI làm được gì
export const MIXED_MODES: StudyMode[] = ['explain', 'quiz', 'flashcards', 'plan']

export function fillTemplate(mode: StudyMode, kind: InterestKind, label: string): string {
  return TEMPLATES[mode][kind].replace('{t}', label)
}

// Gợi ý mặc định khi chưa đủ dữ liệu / tắt cá nhân hóa
const d = (mode: AiMode, text: string): AiSuggestion => ({ mode, text, topic: null })
export const DEFAULT_SUGGESTIONS: Record<AiMode, AiSuggestion[]> = {
  ask: [
    d('explain', 'Giải thích con trỏ trong C bằng ví dụ dễ hiểu'),
    d('quiz', 'Quiz 5 câu về chuẩn hóa cơ sở dữ liệu (1NF–3NF)'),
    d('flashcards', 'Flashcard các công thức đạo hàm cơ bản'),
    d('plan', 'Lộ trình ôn Giải tích 2 trong 7 ngày, mỗi ngày 2 tiếng')
  ],
  explain: [
    d('explain', 'Đệ quy là gì? Giải thích kèm ví dụ'),
    d('explain', 'Giải thích con trỏ trong C bằng ví dụ dễ hiểu'),
    d('explain', 'Khác nhau giữa TCP và UDP'),
    d('explain', 'Ý nghĩa của đạo hàm trong thực tế')
  ],
  quiz: [
    d('quiz', 'Quiz 5 câu về chuẩn hóa cơ sở dữ liệu (1NF–3NF)'),
    d('quiz', 'Quiz 5 câu về cấu trúc dữ liệu cơ bản'),
    d('quiz', 'Quiz 5 câu về xác suất thống kê'),
    d('quiz', 'Quiz 5 câu về lập trình hướng đối tượng')
  ],
  flashcards: [
    d('flashcards', 'Flashcard các công thức đạo hàm cơ bản'),
    d('flashcards', 'Flashcard thuật ngữ mạng máy tính'),
    d('flashcards', 'Flashcard các câu lệnh SQL thường dùng'),
    d('flashcards', 'Flashcard từ vựng tiếng Anh chuyên ngành CNTT')
  ],
  summarize: [
    d('summarize', 'Tóm tắt các nguyên lý SOLID'),
    d('summarize', 'Tóm tắt kiến thức trọng tâm Giải tích 1'),
    d('summarize', 'Tóm tắt mô hình OSI 7 tầng'),
    d('summarize', 'Tóm tắt các thuật toán sắp xếp phổ biến')
  ],
  plan: [
    d('plan', 'Lộ trình ôn Giải tích 2 trong 7 ngày, mỗi ngày 2 tiếng'),
    d('plan', 'Lộ trình ôn Cấu trúc dữ liệu trong 10 ngày'),
    d('plan', 'Lộ trình tự học SQL trong 2 tuần'),
    d('plan', 'Lộ trình ôn thi cuối kỳ 3 môn trong 14 ngày')
  ]
}
