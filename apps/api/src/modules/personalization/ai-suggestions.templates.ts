import type { AiMode, AiSuggestion } from '@pu/schemas'

type StudyMode = Exclude<AiMode, 'ask'>

// Mẫu câu theo chế độ học ({t} = tên môn)
// Chỉ môn học: thẻ bài viết / từ khóa tìm kiếm là tín hiệu của bảng tin, không phải chủ đề học (vd #anuong, #reviewquan)
const TEMPLATES: Record<StudyMode, string> = {
  explain: 'Giải thích các khái niệm trọng tâm môn {t}',
  quiz: 'Quiz 5 câu ôn tập môn {t}',
  flashcards: 'Flashcard thuật ngữ quan trọng môn {t}',
  summarize: 'Tóm tắt kiến thức trọng tâm môn {t}',
  plan: 'Lộ trình ôn {t} trong 7 ngày, mỗi ngày 2 tiếng'
}

// Gợi ý từ bộ sưu tập của mình ({t} = tên bộ); bấm ⇒ bộ được thêm vào cuộc trò chuyện để N7AI đọc
const COLLECTION_TEMPLATES: Record<StudyMode, string> = {
  explain: 'Giải thích các khái niệm chính trong bộ «{t}»',
  quiz: 'Quiz 5 câu ôn tập từ bộ «{t}»',
  flashcards: 'Flashcard thuật ngữ từ bộ «{t}»',
  summarize: 'Tóm tắt các tài liệu trong bộ «{t}»',
  plan: 'Lộ trình ôn bằng bộ «{t}» trong 7 ngày'
}
export const fillCollectionTemplate = (mode: StudyMode, title: string): string => COLLECTION_TEMPLATES[mode].replace('{t}', title)

// "Hỏi đáp": trộn nhiều chế độ để người mới thấy N7AI làm được gì
export const MIXED_MODES: StudyMode[] = ['explain', 'quiz', 'flashcards', 'plan']

export const fillTemplate = (mode: StudyMode, course: string): string => TEMPLATES[mode].replace('{t}', course)

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
