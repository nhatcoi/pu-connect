import type { Metadata } from 'next'
import Link from 'next/link'
import { LegalDocument, type LegalSection } from '@/components/legal/legal-document'

export const metadata: Metadata = {
  title: 'Chính sách bảo mật — PU Connector',
  description: 'Cách PU Connector thu thập, sử dụng, lưu trữ và bảo vệ dữ liệu cá nhân của bạn.'
}

// Nội dung bám theo dữ liệu hệ thống thực sự lưu (bảng users, messages, push_subscriptions, R2, N7AI)
const SECTIONS: LegalSection[] = [
  {
    id: 'pham-vi',
    title: 'Phạm vi áp dụng',
    body: (
      <p>
        Chính sách này áp dụng cho website PU Connector và mọi tính năng đi kèm: bảng tin, cộng đồng, học phần, tài liệu, nhóm học, tin nhắn và trợ lý N7AI.
        Khi dùng dịch vụ, bạn đồng ý với cách xử lý dữ liệu mô tả dưới đây, cùng với <Link href="/terms">Điều khoản dịch vụ</Link>.
      </p>
    )
  },
  {
    id: 'du-lieu-thu-thap',
    title: 'Dữ liệu chúng tôi thu thập',
    body: (
      <>
        <p>
          <strong>Thông tin tài khoản.</strong> Email, tên người dùng, tên hiển thị và mật khẩu. Mật khẩu được băm một chiều, chúng tôi không lưu và không thể
          xem mật khẩu gốc. Nếu đăng nhập bằng Google, chúng tôi nhận mã định danh Google, email, tên và ảnh đại diện từ tài khoản Google của bạn.
        </p>
        <p>
          <strong>Thông tin hồ sơ (tự nguyện).</strong> Mã sinh viên, trường, khoa, ngành, lớp, khóa học, ngày sinh, nơi ở, website, giới thiệu, kỹ năng, sở
          thích, ảnh đại diện và ảnh bìa. Bạn có thể bỏ trống hoặc sửa các trường này bất cứ lúc nào.
        </p>
        <p>
          <strong>Nội dung bạn tạo.</strong> Bài viết, bình luận, bình chọn, cảm xúc, tài liệu, tin nhắn, tệp và ảnh đính kèm, nhóm học bạn tạo hoặc tham gia.
        </p>
        <p>
          <strong>Dữ liệu kỹ thuật.</strong> Cookie phiên đăng nhập, trạng thái trực tuyến, tin nhắn đã đọc, cài đặt thông báo và quyền riêng tư, cùng địa chỉ
          đăng ký thông báo đẩy của trình duyệt nếu bạn bật thông báo đẩy.
        </p>
        <p>
          <strong>Nhật ký bảo mật.</strong> Thời điểm đăng nhập, đăng xuất, nhập sai mật khẩu, đặt lại mật khẩu, kèm địa chỉ IP, loại thiết bị, trình duyệt
          và vị trí gần đúng (tỉnh/thành, quốc gia) suy ra từ địa chỉ IP — chúng tôi không dùng GPS hay định vị chính xác. Dùng để phát hiện đăng nhập lạ (và
          báo cho bạn khi có đăng nhập từ nơi mới), dò mật khẩu và tài khoản giả mạo. Bạn xem được nhật ký của chính mình trong Cài đặt › Đăng nhập &amp; Bảo mật. Lưu 90
          ngày rồi tự xóa.
        </p>
        <p>
          <strong>Lượt xem hồ sơ.</strong> Khi bạn mở trang cá nhân của người khác, hệ thống ghi nhận (gộp theo giờ) bạn đã xem hồ sơ nào. Dữ liệu này{' '}
          <strong>không hiển thị cho người được xem</strong>, chỉ Ban Quản Trị dùng khi điều tra quấy rối, theo dõi hoặc giả mạo. Mỗi lần quản trị viên xem đều
          được ghi lại. Lưu 90 ngày rồi tự xóa.
        </p>
      </>
    )
  },
  {
    id: 'muc-dich',
    title: 'Mục đích sử dụng',
    body: (
      <ul>
        <li>Tạo và duy trì tài khoản, xác thực đăng nhập, xác minh email và đặt lại mật khẩu.</li>
        <li>Hiển thị hồ sơ, bảng tin, kết quả tìm kiếm và gợi ý kết nối phù hợp với khoa, ngành, sở thích của bạn.</li>
        <li>Gửi và đồng bộ tin nhắn, gửi thông báo trong ứng dụng, qua email và thông báo đẩy.</li>
        <li>Vận hành N7AI để trả lời câu hỏi bạn gửi.</li>
        <li>Phát hiện spam, xử lý báo cáo vi phạm và bảo vệ an toàn cho cộng đồng.</li>
      </ul>
    )
  },
  {
    id: 'n7ai',
    title: 'Trợ lý N7AI',
    body: (
      <>
        <p>
          Khi bạn trò chuyện với N7AI hoặc nhắc N7AI trong nhóm chat, nội dung cần thiết để trả lời gồm tin nhắn, ngữ cảnh hội thoại gần nhất, ảnh và nội dung
          tệp PDF, DOCX, TXT bạn gửi kèm sẽ được chuyển tới dịch vụ mô hình ngôn ngữ để tạo câu trả lời. Câu trả lời được lưu như một tin nhắn trong hội thoại.
        </p>
        <p>
          Không gửi cho N7AI mật khẩu, số giấy tờ tùy thân, thông tin tài chính hay dữ liệu nhạy cảm của người khác. Mỗi tài khoản có giới hạn số lượt dùng PU
          AI mỗi ngày.
        </p>
      </>
    )
  },
  {
    id: 'chia-se',
    title: 'Chia sẻ dữ liệu với bên thứ ba',
    body: (
      <>
        <p>
          <strong>Chúng tôi không bán dữ liệu cá nhân.</strong> Dữ liệu chỉ được chia sẻ với các nhà cung cấp cần thiết để vận hành dịch vụ, trong phạm vi cần
          cho từng chức năng:
        </p>
        <ul>
          <li>Google: khi bạn chọn đăng nhập bằng Google.</li>
          <li>Dịch vụ lưu trữ đám mây: lưu ảnh, tệp đính kèm và tài liệu bạn tải lên.</li>
          <li>Dịch vụ gửi email: gửi email xác minh, đặt lại mật khẩu và thông báo.</li>
          <li>Dịch vụ thông báo đẩy của trình duyệt (Google, Apple, Mozilla…): chuyển thông báo tới thiết bị của bạn.</li>
          <li>Dịch vụ mô hình ngôn ngữ: xử lý nội dung bạn gửi cho N7AI.</li>
        </ul>
        <p>Chúng tôi có thể cung cấp dữ liệu khi cơ quan nhà nước có thẩm quyền yêu cầu theo quy định pháp luật.</p>
      </>
    )
  },
  {
    id: 'hien-thi',
    title: 'Ai xem được thông tin của bạn',
    body: (
      <ul>
        <li>Hồ sơ và bài viết công khai: mọi người dùng đã đăng nhập, tùy theo cài đặt quyền riêng tư của hồ sơ.</li>
        <li>Bài viết trong cộng đồng: thành viên cộng đồng đó.</li>
        <li>Tin nhắn: chỉ thành viên của hội thoại. Người vào nhóm sau có thể xem lịch sử tin nhắn của nhóm.</li>
        <li>Quản trị viên: có thể xem nội dung bị báo cáo để xử lý vi phạm.</li>
      </ul>
    )
  },
  {
    id: 'luu-tru-bao-mat',
    title: 'Lưu trữ và bảo mật',
    body: (
      <>
        <p>
          Kết nối được mã hóa bằng HTTPS. Cookie phiên chỉ dùng để duy trì đăng nhập, không đọc được từ JavaScript và hết hạn sau 7 ngày. Liên kết đặt lại mật
          khẩu chỉ dùng được một lần, hết hạn sau 30 phút, và đặt lại mật khẩu sẽ đăng xuất mọi phiên đăng nhập cũ.
        </p>
        <p>
          Dữ liệu được lưu khi tài khoản còn hoạt động. Tin nhắn bị thu hồi hay bài viết bị xóa không còn hiển thị với người khác. Không có hệ thống nào an toàn
          tuyệt đối, vì vậy hãy dùng mật khẩu mạnh và không chia sẻ tài khoản.
        </p>
      </>
    )
  },
  {
    id: 'quyen-cua-ban',
    title: 'Quyền của bạn',
    body: (
      <>
        <p>
          Theo Nghị định 13/2023/NĐ-CP về bảo vệ dữ liệu cá nhân, bạn có quyền được biết, truy cập, chỉnh sửa, rút lại sự đồng ý, yêu cầu xóa và hạn chế xử lý
          dữ liệu của mình. Trong ứng dụng, bạn có thể:
        </p>
        <ul>
          <li>Sửa hoặc xóa thông tin hồ sơ, ảnh đại diện, ảnh bìa.</li>
          <li>Thay đổi cài đặt quyền riêng tư của hồ sơ.</li>
          <li>Tắt từng loại thông báo, thông báo đẩy, hoặc tắt thông báo một hội thoại.</li>
          <li>Xóa bài viết, thu hồi tin nhắn, rời nhóm chat và nhóm học.</li>
        </ul>
        <p>
          Để yêu cầu xóa tài khoản hoặc nhận bản sao dữ liệu, hãy liên hệ ban quản trị theo mục bên dưới. Chúng tôi phản hồi trong thời hạn pháp luật quy định.
        </p>
      </>
    )
  },
  {
    id: 'thay-doi',
    title: 'Thay đổi chính sách',
    body: (
      <p>
        Khi chính sách thay đổi, chúng tôi cập nhật ngày ở đầu trang và thông báo trong ứng dụng nếu thay đổi quan trọng. Tiếp tục sử dụng dịch vụ sau thời điểm
        cập nhật nghĩa là bạn đồng ý với phiên bản mới.
      </p>
    )
  },
  {
    id: 'lien-he',
    title: 'Liên hệ',
    body: (
      <p>
        Mọi câu hỏi hoặc yêu cầu về dữ liệu cá nhân, vui lòng gửi tới ban quản trị PU Connector qua email đã đăng ký tài khoản, hoặc dùng tính năng báo cáo
        trong ứng dụng.
      </p>
    )
  }
]

export default function PrivacyPolicyPage() {
  return (
    <LegalDocument
      title="Chính sách bảo mật"
      intro={
        <p>
          PU Connector là mạng xã hội học thuật dành cho cộng đồng sinh viên Phenikaa. Chúng tôi chỉ thu thập dữ liệu cần thiết để vận hành dịch vụ và không bán
          dữ liệu của bạn.
        </p>
      }
      sections={SECTIONS}
    />
  )
}
