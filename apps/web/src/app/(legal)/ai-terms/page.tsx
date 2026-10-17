import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Điều khoản N7AI — PU Connector',
  description: 'Điều khoản sử dụng trợ lý học tập N7AI: giới hạn, dữ liệu, liêm chính học thuật.'
}

// Bám theo hành vi thật của hệ thống (quota ai_runs, connector, bộ nhớ, tác vụ tự động, thời gian lưu)
const SECTIONS: LegalSection[] = [
  {
    id: 'n7ai-la-gi',
    title: 'N7AI là gì',
    body: (
      <p>
        N7AI là trợ lý học tập dùng mô hình ngôn ngữ lớn, trả lời dựa trên nội dung trên PU Connector và các nguồn bạn cho phép (tài liệu của bạn, Google
        Drive, Google Calendar, trang web bạn gửi). Câu trả lời có thể sai hoặc thiếu — hãy kiểm chứng với giảng viên, giáo trình và nguồn chính thức.
      </p>
    )
  },
  {
    id: 'liem-chinh',
    title: 'Liêm chính học thuật',
    body: (
      <p>
        N7AI hỗ trợ hiểu bài, ôn tập và luyện tập. Không dùng N7AI để làm hộ bài kiểm tra, bài thi hoặc nộp nội dung do AI tạo như sản phẩm của riêng mình khi
        quy định môn học không cho phép. Bạn chịu trách nhiệm về cách dùng câu trả lời.
      </p>
    )
  },
  {
    id: 'gioi-han',
    title: 'Giới hạn sử dụng',
    body: (
      <p>
        Mỗi tài khoản có số lượt hỏi mỗi ngày (Research tính 2 lượt; tác vụ tự động tính 1 lượt mỗi lần chạy), làm mới lúc 0h giờ Việt Nam. Không dùng N7AI để
        tạo nội dung vi phạm <Link href="/terms">Điều khoản dịch vụ</Link>, quấy rối, gian lận hoặc cố vượt qua giới hạn hệ thống.
      </p>
    )
  },
  {
    id: 'du-lieu',
    title: 'Dữ liệu khi dùng N7AI',
    body: (
      <>
        <p>
          Câu hỏi, tệp đính kèm và nội dung nguồn liên quan được gửi tới nhà cung cấp mô hình AI để tạo câu trả lời. PU Connector không dùng hội thoại của bạn
          để huấn luyện mô hình.
        </p>
        <p>
          <strong>Bộ nhớ:</strong> khi bật, N7AI ghi lại dữ kiện bền về bạn (ngành, môn học, lịch thi…) để cá nhân hóa; bạn xem, sửa, xóa ở Cài đặt › N7AI ›
          Bộ nhớ. <strong>Kết nối Google:</strong> chỉ quyền đọc, token được mã hóa, ngắt kết nối sẽ thu hồi quyền. <strong>Lịch sử:</strong> bạn chọn tự xóa
          sau 30 ngày / 1 năm, tải về hoặc xóa toàn bộ dữ liệu N7AI bất cứ lúc nào. Xem thêm <Link href="/privacy-policy">Chính sách bảo mật</Link>.
        </p>
      </>
    )
  },
  {
    id: 'phan-hoi',
    title: 'Phản hồi',
    body: <p>Đánh giá 👍/👎 và báo lỗi giúp cải thiện N7AI; khi bạn chọn đính kèm ngữ cảnh, tối đa 10 tin gần nhất của hội thoại được gửi cùng báo cáo.</p>
  }
]

export default function AiTermsPage() {
  return (
    <LegalDocument
      title="Điều khoản sử dụng N7AI"
      intro={<p>Điều khoản này bổ sung cho Điều khoản dịch vụ chung, áp dụng khi bạn dùng N7AI trong tin nhắn, bình luận và các tính năng liên quan.</p>}
      sections={SECTIONS}
    />
  )
}
