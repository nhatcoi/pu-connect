import type { AiMode, AiSuggestion } from '@pu/schemas'

type StudyMode = Exclude<AiMode, 'ask'>

// Mẫu câu theo chế độ học ({t} = tên môn)
// Chỉ môn học: thẻ bài viết / từ khóa tìm kiếm là tín hiệu của bảng tin, không phải chủ đề học (vd #anuong, #reviewquan)
const TEMPLATES: Record<StudyMode, string> = {
  explain: 'Giải thích các khái niệm trọng tâm môn {t}',
  quiz: 'Quiz 5 câu ôn tập môn {t}',
  deep_question: 'Quiz trắc nghiệm tự kiểm tra kiến thức môn {t}',
  flashcards: 'Flashcard thuật ngữ quan trọng môn {t}',
  summarize: 'Tóm tắt kiến thức trọng tâm môn {t}',
  plan: 'Lộ trình ôn {t} trong 7 ngày, mỗi ngày 2 tiếng',
  solve: 'Giải bài tập mẫu từng bước môn {t}',
  deep_solve: 'Giải bài tập suy luận nhiều bước môn {t}',
  ask_questions: 'Đặt câu hỏi gợi mở để làm rõ vấn đề môn {t}',
  research: 'Nghiên cứu tài liệu chuyên sâu môn {t}',
  deep_research: 'Nghiên cứu tài liệu học thuật môn {t}',
  visualize: 'Vẽ sơ đồ và trực quan hóa kiến thức môn {t}',
  video_lesson: 'Kịch bản bài giảng hoạt họa tóm tắt môn {t}',
  audio_overview: 'Đối thoại audio tổng quan kiến thức môn {t}',
  math_animator: 'Thiết kế hoạt họa toán học trực quan môn {t}'
}

// Gợi ý từ bộ sưu tập của mình ({t} = tên bộ); bấm ⇒ bộ được thêm vào cuộc trò chuyện để N7AI đọc
const COLLECTION_TEMPLATES: Record<StudyMode, string> = {
  explain: 'Giải thích các khái niệm chính trong bộ «{t}»',
  quiz: 'Quiz 5 câu ôn tập từ bộ «{t}»',
  deep_question: 'Quiz trắc nghiệm ôn tập từ bộ «{t}»',
  flashcards: 'Flashcard thuật ngữ từ bộ «{t}»',
  summarize: 'Tóm tắt các tài liệu trong bộ «{t}»',
  plan: 'Lộ trình ôn bằng bộ «{t}» trong 7 ngày',
  solve: 'Giải bài tập từ bộ «{t}»',
  deep_solve: 'Giải chi tiết các dạng bài trong bộ «{t}»',
  ask_questions: 'Đặt câu hỏi phản biện từ bộ «{t}»',
  research: 'Nghiên cứu sâu tài liệu trong bộ «{t}»',
  deep_research: 'Nghiên cứu học thuật từ bộ «{t}»',
  visualize: 'Sơ đồ hóa tài liệu trong bộ «{t}»',
  video_lesson: 'Bài giảng tóm lược từ bộ «{t}»',
  audio_overview: 'Tóm tắt audio từ bộ «{t}»',
  math_animator: 'Hoạt họa hóa các định lý trong bộ «{t}»'
}
export const fillCollectionTemplate = (mode: StudyMode, title: string): string => COLLECTION_TEMPLATES[mode]?.replace('{t}', title) ?? `Tìm hiểu «${title}»`

// "Hỏi đáp": trộn nhiều chế độ để người mới thấy N7AI làm được gì
export const MIXED_MODES: StudyMode[] = ['explain', 'quiz', 'flashcards', 'plan', 'solve', 'research', 'visualize']

export const fillTemplate = (mode: StudyMode, course: string): string => TEMPLATES[mode]?.replace('{t}', course) ?? `Học tập môn ${course}`

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
  deep_question: [
    d('deep_question', 'Quiz 5 câu về chuẩn hóa cơ sở dữ liệu (1NF–3NF)'),
    d('deep_question', 'Quiz 5 câu về cấu trúc dữ liệu cơ bản'),
    d('deep_question', 'Quiz 5 câu về xác suất thống kê'),
    d('deep_question', 'Quiz 5 câu về lập trình hướng đối tượng')
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
  ],
  solve: [
    d('solve', 'Giải bài toán tìm đường đi ngắn nhất bằng thuật toán Dijkstra'),
    d('solve', 'Tính tích phân từng phần: ∫ x * e^x dx'),
    d('solve', 'Tìm ma trận nghịch đảo cấp 3 bằng phép biến đổi sơ cấp')
  ],
  deep_solve: [
    d('deep_solve', 'Giải bài toán quy hoạch động Knapsack 0/1 kèm bảng phương án'),
    d('deep_solve', 'Giải phương trình vi phân tuyến tính cấp 2 hệ số hằng')
  ],
  ask_questions: [
    d('ask_questions', 'Tôi muốn xây dựng hệ thống thanh toán trực tuyến nhưng chưa biết bắt đầu từ đâu'),
    d('ask_questions', 'Em muốn chọn đề tài tốt nghiệp ngành Khoa học dữ liệu')
  ],
  research: [
    d('research', 'Nghiên cứu so sánh cơ chế đồng thuận Raft vs Paxos'),
    d('research', 'Đánh giá kiến trúc Microservices so với Modular Monolith')
  ],
  deep_research: [
    d('deep_research', 'Nghiên cứu cơ chế Attention trong Transformer và Vision Transformer'),
    d('deep_research', 'Tổng quan các kỹ thuật tối ưu hóa chỉ mục trong cơ sở dữ liệu lớn')
  ],
  visualize: [
    d('visualize', 'Vẽ sơ đồ luồng xác thực OAuth 2.0 Authorization Code Flow bằng Mermaid'),
    d('visualize', 'Trực quan hóa cây nhị phân tìm kiếm BST khi chèn các phần tử')
  ],
  video_lesson: [
    d('video_lesson', 'Soạn kịch bản video bài giảng giải thích thuật toán QuickSort trong 3 phút'),
    d('video_lesson', 'Kịch bản video hoạt họa giải thích cơ chế bắt tay 3 bước TCP')
  ],
  audio_overview: [
    d('audio_overview', 'Tạo kịch bản podcast đối thoại 2 người về nghịch lý Monty Hall'),
    d('audio_overview', 'Soạn đối thoại radio bàn luận về tương lai của Quantum Computing')
  ],
  math_animator: [
    d('math_animator', 'Thiết kế hoạt họa Manim trực quan hóa chuỗi Fourier xấp xỉ sóng vuông'),
    d('math_animator', 'Minh họa hình học định lý Pythagoras bằng chuyển động xoay ghép hình')
  ]
}
