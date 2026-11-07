'use client'

import React from 'react'
import {
  BookOpen,
  Check,
  ChevronDown,
  ChevronRight,
  Lightbulb,
  Sparkles,
} from 'lucide-react'
import type { BlockPreviewKind } from './block-previews'

export function NoteBlockPreview({
  kind,
  title,
}: {
  kind: BlockPreviewKind
  title?: string
}) {
  const heading = (level: number, toggle = false) => (
    <div className="dt-note-preview-section">
      <div className={`dt-note-preview-heading level-${level}`}>
        {toggle && <ChevronDown size={15} />}
        Tiêu đề {level}
      </div>
      <p className={toggle ? 'dt-note-preview-toggle-body' : ''}>
        Tạo điểm nhấn và cấu trúc rõ ràng cho phần ghi chú này.
      </p>
    </div>
  )

  const tasks = ['Ôn tập kiến thức trọng tâm', 'Làm thử ví dụ thực hành']
  const checklist = (
    <div className="dt-note-preview-checks">
      {tasks.map((task, i) => (
        <div key={task} className={i === 0 ? 'done' : ''}>
          <span className="dt-note-preview-checkbox">{i === 0 && <Check size={10} />}</span>
          <span>{task}</span>
        </div>
      ))}
    </div>
  )

  switch (kind) {
    case 'paragraph':
      return (
        <p className="dt-note-preview-paragraph">
          Ghi lại suy nghĩ, liên kết với kiến thức đã học và phát triển ý tưởng tiếp theo.
        </p>
      )
    case 'heading':
      return heading(1)
    case 'heading_2':
      return heading(2)
    case 'heading_3':
      return heading(3)
    case 'heading_4':
      return heading(4)
    case 'bullet_list':
    case 'numbered_list': {
      const List = kind === 'numbered_list' ? 'ol' : 'ul'
      return (
        <List>
          <li>Đặt câu hỏi cốt lõi</li>
          <li>Kết nối các luận điểm</li>
          <li>Kiểm tra mức độ hiểu bài</li>
        </List>
      )
    }
    case 'check_list':
      return checklist
    case 'quote':
      return <blockquote>Một đoạn trích hữu ích, được giữ nguyên ngữ cảnh.</blockquote>
    case 'table':
      return (
        <table>
          <thead>
            <tr>
              <th>Khái niệm</th>
              <th>Ghi chú</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Biến đổi Fourier</td>
              <td>Tần số</td>
            </tr>
            <tr>
              <td>Đạo hàm</td>
              <td>Tốc độ biến thiên</td>
            </tr>
          </tbody>
        </table>
      )
    case 'divider':
      return (
        <>
          <p>Ý tưởng chính</p>
          <hr />
          <p className="dt-note-preview-muted">Ví dụ áp dụng</p>
        </>
      )
    case 'code_block':
      return (
        <div className="dt-note-preview-code">
          <small>Python</small>
          <pre>
            <code>{'def learn(topic):\n    return explore(topic)'}</code>
          </pre>
        </div>
      )
    case 'callout':
      return (
        <div className="dt-note-callout" data-tone="tip">
          <Lightbulb size={19} />
          <p>Giữ ý tưởng quan trọng luôn trong tầm mắt.</p>
        </div>
      )
    case 'ai':
      return (
        <div className="dt-note-preview-ai">
          <p>Photosynthesis turns light into chemical energy.</p>
          <p className="is-suggested">
            Plants capture light in chlorophyll, then use it to build sugar from water and carbon dioxide.
          </p>
          <small className="dt-note-preview-row">
            <Sparkles size={12} />
            <span>N7AI suggests · you accept or dismiss</span>
          </small>
        </div>
      )
    case 'source':
      return (
        <>
          <blockquote>Một đoạn trích hữu ích, được giữ nguyên ngữ cảnh học tập.</blockquote>
          <small className="dt-note-preview-row">
            <BookOpen size={13} />
            Tài liệu tham khảo · Trang 12
          </small>
        </>
      )
    case 'favorite':
      return (
        <div className="dt-note-preview-research">
          <small>Học tập · Nội dung đã lưu</small>
          <div className="dt-note-preview-row">
            <ChevronRight size={14} />
            <strong>Câu trả lời hữu ích</strong>
          </div>
          <p>Lưu giữ lời giải thích trực tiếp từ N7AI.</p>
        </div>
      )
    default:
      return (
        <p className="dt-note-preview-paragraph">
          Chèn khối nội dung này vào trang ghi chú.
        </p>
      )
  }
}

export default NoteBlockPreview
