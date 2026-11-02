import type { AiMode } from '@pu/schemas'
import type { LoopCapability } from './types'
import { quizCapability } from './quiz'
import { solveCapability } from './solve'

export type { CapabilityTool, LoopCapability } from './types'

const ASK_QUESTIONS_BLOCK = [
  'Chế độ HỎI NGƯỢC: ưu tiên công cụ ask_user. Khi câu hỏi còn giả định hoặc dữ kiện thiếu, gọi ask_user MỘT lần với 1–3 câu định hướng (mỗi câu 2–4 lựa chọn ngắn, cho phép người học tự nhập) thay vì đoán hay trả lời đầy đủ ngay.',
  'Sau khi nhận câu trả lời của người học, mới đưa lời giải thích hoặc gợi ý bước tiếp theo.'
].join('\n')

const RESEARCH_BLOCK = [
  'Chế độ NGHIÊN CỨU: lập các câu hỏi con, tra cứu bằng công cụ theo từng ý (ưu tiên nguồn học thuật), đối chiếu nguồn mâu thuẫn, rồi mới tổng hợp. Mỗi kết luận quan trọng phải có dẫn chứng từ kết quả công cụ.'
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
      return { id: 'research', block: RESEARCH_BLOCK, tools: [], budgets: { explorationBudget: 5 } }
    default:
      return research ? { id: 'research', block: RESEARCH_BLOCK, tools: [], budgets: { explorationBudget: 5 } } : null
  }
}
