import type { AiMode } from '@pu/schemas'
import type { LoopCapability } from './types'
import { quizCapability } from './quiz'
import { solveCapability } from './solve'
import { researchCapability } from './research'
import { visualizeCapability } from './visualize'
import { audioOverviewCapability, mathAnimatorCapability, videoLessonCapability } from './media'

export type { CapabilityTool, LoopCapability } from './types'

const ASK_QUESTIONS_BLOCK = [
  'Chế độ HỎI NGƯỢC: ưu tiên công cụ ask_user. Khi câu hỏi còn giả định hoặc dữ kiện thiếu, gọi ask_user MỘT lần với 1–3 câu định hướng (mỗi câu 2–4 lựa chọn ngắn, cho phép người học tự nhập) thay vì đoán hay trả lời đầy đủ ngay. Câu mà các lựa chọn không loại trừ nhau (môn, chủ đề, kỹ năng…) PHẢI đặt multi_select=true để người học chọn nhiều.',
  'Sau khi nhận câu trả lời của người học, mới đưa lời giải thích hoặc gợi ý bước tiếp theo.'
].join('\n')

/** Capability đi kèm chế độ học của lượt (null ⇒ chỉ dùng vòng lặp chung) */
export function capabilityFor(mode: AiMode | undefined, research: boolean): LoopCapability | null {
  switch (mode) {
    case 'solve':
    case 'deep_solve':
      return solveCapability()
    case 'quiz':
    case 'deep_question':
      return quizCapability()
    case 'ask_questions':
      return { id: 'ask_questions', block: ASK_QUESTIONS_BLOCK, tools: [] }
    case 'research':
    case 'deep_research':
      return researchCapability()
    case 'visualize':
      return visualizeCapability()
    case 'video_lesson':
      return videoLessonCapability()
    case 'audio_overview':
      return audioOverviewCapability()
    case 'math_animator':
      return mathAnimatorCapability()
    default:
      return research ? researchCapability() : null
  }
}
