import React from 'react'
import { Brain, CalendarCheck, FileText, Layers, MessageCircleQuestion } from 'lucide-react'
import type { AiMode } from '@pu/schemas'
import {
  AskBackIcon,
  AudioVoicesIcon,
  MathMotionIcon,
  QuizSheetIcon,
  ResearchLensIcon,
  SolveStepsIcon,
  VideoLessonIcon,
  VisualizeRingIcon,
  type ModeIconProps
} from './mode-icons'

export interface ModeMetaItem {
  id: AiMode
  label: string
  desc: string
  icon: React.ComponentType<ModeIconProps>
  placeholder: string
  hint: string
}

/** 8 DeepTutor authoritative capability modes shown in the Mode menu */
export const DEEPTUTOR_CAPABILITIES: readonly ModeMetaItem[] = [
  {
    id: 'deep_solve',
    label: 'Giải bài',
    desc: 'Suy luận nhiều bước & giải quyết bài toán',
    icon: SolveStepsIcon,
    placeholder: 'Hỏi bài toán hoặc yêu cầu giải từng bước suy luận…',
    hint: 'Suy luận từng bước, công thức và đáp số'
  },
  {
    id: 'ask_questions',
    label: 'Hỏi ngược lại',
    desc: 'Để AI đặt câu hỏi làm rõ ngữ cảnh còn thiếu',
    icon: AskBackIcon,
    placeholder: 'Nêu vấn đề để mô hình hỏi ngược làm rõ ngữ cảnh…',
    hint: 'Gợi mở Socratic, hỏi ngược làm rõ vấn đề'
  },
  {
    id: 'deep_question',
    label: 'Trắc nghiệm',
    desc: 'Tạo câu hỏi trắc nghiệm tự kiểm tra kiến thức',
    icon: QuizSheetIcon,
    placeholder: 'Chủ đề muốn tạo câu hỏi trắc nghiệm tự kiểm tra…',
    hint: 'Trắc nghiệm tự kiểm tra kèm giải thích'
  },
  {
    id: 'deep_research',
    label: 'Nghiên cứu',
    desc: 'Nghiên cứu học thuật chuyên sâu từ đa nguồn',
    icon: ResearchLensIcon,
    placeholder: 'Chủ đề cần nghiên cứu sâu và trích dẫn học thuật…',
    hint: 'Báo cáo tổng hợp đa chiều & học thuật'
  },
  {
    id: 'visualize',
    label: 'Trực quan hóa',
    desc: 'Tạo biểu đồ, sơ đồ tư duy hoặc minh họa trực quan',
    icon: VisualizeRingIcon,
    placeholder: 'Mô tả sơ đồ, biểu đồ Mermaid hoặc widget trực quan cần vẽ…',
    hint: 'Biểu đồ Mermaid, sơ đồ tư duy & SVG'
  },
  {
    id: 'video_lesson',
    label: 'Bài giảng video',
    desc: 'Chuyển câu hỏi thành video giải thích hoạt họa',
    icon: VideoLessonIcon,
    placeholder: 'Chủ đề muốn chuyển thành bài giảng video hoạt họa…',
    hint: 'Kịch bản phân cảnh hoạt họa & thuyết minh'
  },
  {
    id: 'audio_overview',
    label: 'Tổng quan âm thanh',
    desc: 'Tạo bản tóm tắt đối thoại âm thanh 2 giọng đọc',
    icon: AudioVoicesIcon,
    placeholder: 'Chủ đề muốn tạo đối thoại podcast âm thanh 2 người…',
    hint: 'Kịch bản podcast đối thoại 2 người dẫn chuyện'
  },
  {
    id: 'math_animator',
    label: 'Diễn hoạt Toán học',
    desc: 'Tạo hoạt ảnh chuyển động toán học Manim',
    icon: MathMotionIcon,
    placeholder: 'Khái niệm toán học muốn làm hoạt họa không gian Manim…',
    hint: 'Hoạt họa toán học trực quan phong cách Manim'
  }
]

export const AI_MODE_META: Record<AiMode, ModeMetaItem> = {
  ask: {
    id: 'ask',
    label: 'Trò chuyện',
    desc: 'Hỏi đáp linh hoạt, đa dụng',
    icon: MessageCircleQuestion,
    placeholder: 'Mình có thể giúp gì cho bạn hôm nay?',
    hint: 'Trả lời dựa trên bài viết & tài liệu'
  },
  explain: {
    id: 'explain',
    label: 'Giải thích',
    desc: 'Giải thích từng bước kèm ví dụ trực quan',
    icon: Brain,
    placeholder: 'Khái niệm cần giải thích, vd. "Đệ quy là gì?"',
    hint: 'Từng bước, có ví dụ'
  },
  quiz: {
    id: 'quiz',
    label: 'Trắc nghiệm',
    desc: 'Tạo quiz trắc nghiệm & bộ thẻ ghi nhớ',
    icon: QuizSheetIcon,
    placeholder: 'Chủ đề muốn tự kiểm tra, vd. "Chuẩn hóa CSDL"',
    hint: '5 câu trắc nghiệm có chấm điểm'
  },
  deep_question: DEEPTUTOR_CAPABILITIES[2],
  flashcards: {
    id: 'flashcards',
    label: 'Flashcard',
    desc: 'Bộ thẻ ghi nhớ',
    icon: Layers,
    placeholder: 'Chủ đề cần ghi nhớ, vd. "Công thức đạo hàm"',
    hint: 'Thẻ lật để học thuộc'
  },
  summarize: {
    id: 'summarize',
    label: 'Tóm tắt',
    desc: 'Tóm tắt văn bản và tài liệu',
    icon: FileText,
    placeholder: 'Dán văn bản hoặc gửi ảnh, PDF, Word cần tóm tắt…',
    hint: 'Ý chính, thuật ngữ, câu ôn'
  },
  plan: {
    id: 'plan',
    label: 'Lộ trình ôn',
    desc: 'Kế hoạch học tập theo ngày',
    icon: CalendarCheck,
    placeholder: 'Môn + thời gian, vd. "Giải tích 2, thi sau 10 ngày"',
    hint: 'Kế hoạch theo ngày'
  },
  solve: DEEPTUTOR_CAPABILITIES[0],
  deep_solve: DEEPTUTOR_CAPABILITIES[0],
  ask_questions: DEEPTUTOR_CAPABILITIES[1],
  research: DEEPTUTOR_CAPABILITIES[3],
  deep_research: DEEPTUTOR_CAPABILITIES[3],
  visualize: DEEPTUTOR_CAPABILITIES[4],
  video_lesson: DEEPTUTOR_CAPABILITIES[5],
  audio_overview: DEEPTUTOR_CAPABILITIES[6],
  math_animator: DEEPTUTOR_CAPABILITIES[7]
}

export const AI_MODE_ORDER: AiMode[] = [
  'ask',
  'deep_solve',
  'ask_questions',
  'deep_question',
  'deep_research',
  'visualize',
  'video_lesson',
  'audio_overview',
  'math_animator'
]
