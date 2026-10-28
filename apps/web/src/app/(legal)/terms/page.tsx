import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Điều khoản dịch vụ — PU Connect',
  description: 'Điều khoản sử dụng và quy tắc cộng đồng của PU Connect.'
}

const SECTIONS: LegalSection[] = [
  {
    id: 'chap-nhan',
    title: 'Chấp nhận điều khoản',
    body: (
      <p>
        Khi tạo tài khoản hoặc sử dụng PU Connect, bạn đồng ý với Điều khoản này và <Link href="/privacy-policy">Chính sách bảo mật</Link>. Nếu không đồng ý,
        vui lòng ngừng sử dụng dịch vụ.
      </p>
    )
  },
  {
    id: 'tai-khoan',
    title: 'Tài khoản',
    body: (
      <ul>
        <li>Cung cấp thông tin chính xác. Không mạo danh người khác, giảng viên hay đơn vị của nhà trường.</li>
        <li>Mỗi người dùng một tài khoản cá nhân. Không mua bán, cho mượn hay chia sẻ tài khoản.</li>
        <li>Bạn chịu trách nhiệm giữ bí mật mật khẩu và mọi hoạt động diễn ra trên tài khoản của mình.</li>
        <li>Một số tính năng chỉ mở sau khi bạn xác minh email.</li>
      </ul>
    )
  },
  {
    id: 'noi-dung',
    title: 'Nội dung của bạn',
    body: (
      <>
        <p>
          Bạn giữ quyền sở hữu với bài viết, bình luận, tài liệu và tin nhắn mình tạo. Khi đăng lên, bạn cho phép PU Connect lưu trữ, hiển thị và phân phối
          nội dung đó tới những người có quyền xem, chỉ nhằm mục đích vận hành dịch vụ.
        </p>
        <p>
          Bạn cam kết có quyền chia sẻ nội dung mình đăng. Với giáo trình, đề thi, slide bài giảng, hãy tôn trọng bản quyền của tác giả và quy định của nhà
          trường.
        </p>
      </>
    )
  },
  {
    id: 'quy-tac',
    title: 'Quy tắc cộng đồng',
    body: (
      <>
        <p>Bạn không được dùng PU Connect để:</p>
        <ul>
          <li>Quấy rối, đe dọa, bắt nạt, phân biệt đối xử hoặc kích động thù ghét.</li>
          <li>Đăng nội dung khiêu dâm, bạo lực, vi phạm pháp luật Việt Nam.</li>
          <li>Gian lận học thuật: chia sẻ đáp án bài thi đang diễn ra, làm bài thuê, đạo văn.</li>
          <li>Tiết lộ thông tin cá nhân của người khác khi chưa được đồng ý.</li>
          <li>Spam, quảng cáo trái phép, lừa đảo, phát tán mã độc hoặc liên kết độc hại.</li>
          <li>Can thiệp vào hệ thống: dò quét lỗ hổng, tự động hóa trái phép, vượt giới hạn sử dụng.</li>
        </ul>
      </>
    )
  },
  {
    id: 'kiem-duyet',
    title: 'Báo cáo và xử lý vi phạm',
    body: (
      <p>
        Bạn có thể báo cáo nội dung vi phạm ngay trong ứng dụng. Ban quản trị có quyền ẩn nội dung, hạn chế tính năng hoặc tạm khóa tài khoản vi phạm, có hoặc
        không cần báo trước tùy mức độ. Nếu cho rằng quyết định chưa đúng, bạn có thể liên hệ ban quản trị để được xem xét lại.
      </p>
    )
  },
  {
    id: 'n7ai',
    title: 'Trợ lý N7AI',
    body: (
      <ul>
        <li>Câu trả lời của N7AI do mô hình ngôn ngữ tạo ra, có thể sai hoặc chưa đầy đủ. Hãy kiểm tra lại với giáo trình và giảng viên trước khi dùng.</li>
        <li>N7AI hỗ trợ học tập, không thay thế bài làm của bạn. Bạn chịu trách nhiệm về liêm chính học thuật.</li>
        <li>Mỗi tài khoản có giới hạn lượt dùng N7AI mỗi ngày, có thể thay đổi theo thời gian.</li>
      </ul>
    )
  },
  {
    id: 'mien-tru',
    title: 'Giới hạn trách nhiệm',
    body: (
      <p>
        PU Connect được cung cấp theo hiện trạng và đang trong giai đoạn phát triển. Chúng tôi không bảo đảm dịch vụ luôn hoạt động liên tục, không lỗi, và
        không chịu trách nhiệm về nội dung do người dùng đăng tải. Chúng tôi có thể thay đổi, tạm ngừng hoặc dừng một tính năng mà không cần báo trước.
      </p>
    )
  },
  {
    id: 'cham-dut',
    title: 'Chấm dứt sử dụng',
    body: (
      <p>
        Bạn có thể ngừng sử dụng và yêu cầu xóa tài khoản bất cứ lúc nào. Chúng tôi có thể chấm dứt tài khoản vi phạm nghiêm trọng hoặc lặp lại các Điều khoản
        này.
      </p>
    )
  },
  {
    id: 'luat-ap-dung',
    title: 'Luật áp dụng',
    body: <p>Điều khoản này được điều chỉnh theo pháp luật nước Cộng hòa Xã hội Chủ nghĩa Việt Nam.</p>
  },
  {
    id: 'thay-doi',
    title: 'Thay đổi điều khoản',
    body: (
      <p>
        Chúng tôi có thể cập nhật Điều khoản và sẽ ghi ngày cập nhật ở đầu trang. Tiếp tục sử dụng dịch vụ sau thời điểm cập nhật nghĩa là bạn đồng ý với phiên
        bản mới.
      </p>
    )
  }
]

export default function TermsPage() {
  return (
    <LegalDocument
      title="Điều khoản dịch vụ"
      intro={
        <p>
          PU Connect là mạng xã hội học thuật dành cho cộng đồng sinh viên Phenikaa. Các điều khoản dưới đây giúp cộng đồng an toàn, tôn trọng và hữu ích cho
          việc học.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
