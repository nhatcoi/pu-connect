'use client'

import { useState } from 'react'
import { CalendarCheck, FileText, GraduationCap, Layers, ListChecks, Network, type LucideIcon } from 'lucide-react'
import type { AiMode } from '@pu/schemas'
import { useMessages } from '@/hooks/chat'
import type { DocEntry } from '../sources/doc-entries'

export type StudyTool = { id: string; mode: AiMode; icon: LucideIcon; label: string; hint: string; ask: string }

// Mỗi công cụ = 1 yêu cầu gửi vào cuộc trò chuyện theo chế độ học tương ứng (server: n7ai.prompts.ts)
export const STUDY_TOOLS: StudyTool[] = [
  { id: 'summary', mode: 'summarize', icon: FileText, label: 'Tóm tắt', hint: 'Ý chính, thuật ngữ, câu ôn', ask: 'Tóm tắt' },
  { id: 'quiz', mode: 'quiz', icon: ListChecks, label: 'Quiz', hint: '5 câu trắc nghiệm có chấm điểm', ask: 'Tạo quiz' },
  { id: 'flashcards', mode: 'flashcards', icon: Layers, label: 'Flashcard', hint: 'Thẻ lật để học thuộc', ask: 'Tạo flashcard' },
  {
    id: 'exam',
    mode: 'quiz',
    icon: GraduationCap,
    label: 'Đề thi thử',
    hint: '10 trắc nghiệm + 2 tự luận ngắn',
    ask: 'Tạo đề thi thử gồm 10 câu trắc nghiệm và 2 câu tự luận ngắn có đáp án gợi ý'
  },
  { id: 'mindmap', mode: 'ask', icon: Network, label: 'Sơ đồ tư duy', hint: 'Các ý chính dạng sơ đồ', ask: 'Vẽ sơ đồ tư duy (khối ```mermaid mindmap) các ý chính' },
  {
    id: 'plan',
    mode: 'plan',
    icon: CalendarCheck,
    label: 'Lộ trình ôn',
    hint: 'Theo ngày, thêm vào Google Lịch nếu đã kết nối',
    ask: 'Lập lộ trình ôn theo ngày'
  }
]

const requestText = (tool: StudyTool, doc: DocEntry | null) => `${tool.ask} ${doc ? `từ tài liệu "${doc.title}"` : 'từ nội dung cuộc trò chuyện này'}.`


// Chạy một công cụ: gửi yêu cầu ngắn vào cuộc trò chuyện theo chế độ học tương ứng
export function useStudyTool(threadId: string) {
  const { send } = useMessages(threadId)
  const [busy, setBusy] = useState<string | null>(null)

  const run = async (tool: StudyTool, doc: DocEntry | null) => {
    setBusy(tool.id)
    try {
      // Tài liệu đã thêm vào cuộc trò chuyện thì N7AI tự đọc ở mọi lượt; tệp chỉ có trong tin nhắn cũ thì gửi kèm lại
      const attachments = doc?.attachment && !doc.source ? [doc.attachment] : undefined
      await send({ content: requestText(tool, doc), aiMode: tool.mode, attachments })
    } finally {
      setBusy(null)
    }
  }
  return { busy, run }
}
