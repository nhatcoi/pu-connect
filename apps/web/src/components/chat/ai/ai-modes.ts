import { BookOpen, Brain, CalendarCheck, FileText, Layers, MessageCircleQuestion, type LucideIcon } from 'lucide-react'
import type { AiMode } from '@pu/schemas'

// Chế độ học của PU AI: nhãn, biểu tượng, gợi ý nhập (server: puai.prompts.ts)
export const AI_MODE_META: Record<AiMode, { label: string; icon: LucideIcon; placeholder: string; hint: string }> = {
  ask: { label: 'Hỏi đáp', icon: MessageCircleQuestion, placeholder: 'Hỏi PU AI bất cứ điều gì…', hint: 'Trả lời dựa trên bài viết & tài liệu' },
  explain: { label: 'Giải thích', icon: Brain, placeholder: 'Khái niệm cần giải thích, vd. "Đệ quy là gì?"', hint: 'Từng bước, có ví dụ' },
  quiz: { label: 'Quiz', icon: BookOpen, placeholder: 'Chủ đề muốn tự kiểm tra, vd. "Chuẩn hóa CSDL"', hint: '5 câu trắc nghiệm có chấm điểm' },
  flashcards: { label: 'Flashcard', icon: Layers, placeholder: 'Chủ đề cần ghi nhớ, vd. "Công thức đạo hàm"', hint: 'Thẻ lật để học thuộc' },
  summarize: { label: 'Tóm tắt', icon: FileText, placeholder: 'Dán văn bản hoặc gửi ảnh/tệp cần tóm tắt…', hint: 'Ý chính, thuật ngữ, câu ôn' },
  plan: { label: 'Lộ trình ôn', icon: CalendarCheck, placeholder: 'Môn + thời gian, vd. "Giải tích 2, thi sau 10 ngày"', hint: 'Kế hoạch theo ngày' }
}

export const AI_MODE_ORDER: AiMode[] = ['ask', 'explain', 'quiz', 'flashcards', 'summarize', 'plan']

// Gợi ý mở đầu ở màn hình trống của PU AI
export const AI_STARTERS: { mode: AiMode; text: string }[] = [
  { mode: 'explain', text: 'Giải thích con trỏ trong C bằng ví dụ dễ hiểu' },
  { mode: 'quiz', text: 'Quiz 5 câu về chuẩn hóa cơ sở dữ liệu (1NF–3NF)' },
  { mode: 'flashcards', text: 'Flashcard các công thức đạo hàm cơ bản' },
  { mode: 'plan', text: 'Lộ trình ôn Giải tích 2 trong 7 ngày, mỗi ngày 2 tiếng' }
]
