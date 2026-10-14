import type { SeedPost } from '../types'

// Thông báo của ban quản trị & giảng viên
export const OFFICIAL_POSTS: SeedPost[] = [
  {
    key: 'off-welcome-k20',
    by: 'tranngocdiep',
    daysAgo: 33,
    at: '08:30',
    type: 'announcement',
    title: 'Chào mừng K20 đến với PU Connector 👋',
    content: `Chào các bạn tân sinh viên K20!

PU Connector là nơi để mọi người hỏi bài, chia sẻ tài liệu, tìm nhóm đồ án và… tìm quán ăn ngon quanh trường 😄 Một vài mẹo để dùng cho hiệu quả:

1. **Cập nhật hồ sơ**: điền khoa, khóa, môn đang học → bảng tin "Dành cho bạn" sẽ ưu tiên bài đúng môn của bạn.
2. **Hỏi bài**: chọn loại bài *Hỏi đáp*, gắn đúng mã học phần (VD: IT101). Ai trả lời đúng thì bấm *Chọn làm lời giải* để người sau tìm lại dễ.
3. **Tài liệu**: tải đề cương, slide, đề thi lên mục Học phần. Nhớ ghi nguồn nếu không phải của mình nha.
4. **PU AI**: hỏi trong tin nhắn hoặc gõ @puai dưới bài viết. AI trả lời kèm nguồn từ chính bài viết & tài liệu trên đây.

Nội quy ngắn gọn: tôn trọng nhau, không đăng đề thi đang diễn ra, không quảng cáo lùa gà. Thấy bài vi phạm thì bấm *Báo cáo*, admin xử lý trong ngày.

Chúc K20 một năm đầu thật vui và đừng trượt Giải tích 1 🙏`,
    tags: ['K20', 'TanSinhVien', 'HuongDan'],
    community: 'phenikaa',
    images: [193],
    pinned: true,
    likes: 18,
    saves: 6,
    comments: [
      { by: 'vannam2k8', text: 'Em K20 đây ạ, cảm ơn chị nhiều 🥹 Cho em hỏi PU AI có miễn phí không ạ?', after: 25, replies: [{ by: 'tranngocdiep', text: 'Miễn phí nha em, mỗi ngày có giới hạn lượt hỏi thôi. Hỏi bài thì cứ thoải mái!', after: 12 }] },
      { by: 'thuydung05', text: '"Đừng trượt Giải tích 1" là lời chúc chân thành nhất mình từng nghe 😭', after: 60, likes: 7 },
      { by: 'lehoangphuc', text: 'Bổ sung: app có dark mode ở góc trên bên phải, học đêm đỡ chói mắt 🌙', after: 95 }
    ]
  },
  {
    key: 'off-release-oct',
    by: 'lehoangphuc',
    daysAgo: 2,
    at: '21:40',
    type: 'announcement',
    title: 'Cập nhật tháng 10: PU AI gợi ý theo môn bạn học, bảng tin thông minh hơn',
    content: `Tối nay team vừa deploy bản cập nhật khá lớn, tóm tắt cho mọi người:

**PU AI**
- Thẻ gợi ý khi mở PU AI giờ dựa trên môn & chủ đề bạn hay xem, không còn cố định nữa.
- Sau mỗi câu trả lời, AI gợi ý 3 câu hỏi tiếp theo, bấm là hỏi luôn.

**Bảng tin**
- "Dành cho bạn" ưu tiên bài thuộc môn/chủ đề bạn quan tâm gần đây.
- Bài dài hiện nhiều chữ hơn trước khi phải bấm "Xem thêm".

**Quyền riêng tư**
Nếu không muốn cá nhân hóa, vào *Cài đặt → Quyền riêng tư → Cá nhân hóa gợi ý* và tắt đi. Tắt là dữ liệu hành vi của bạn bị xóa luôn, không giữ lại.

Ai gặp lỗi thì comment dưới đây hoặc nhắn mình, kèm ảnh chụp màn hình càng tốt 🙏`,
    tags: ['CapNhat', 'PUAI', 'ReleaseNotes'],
    community: 'phenikaa',
    images: [529],
    likes: 16,
    saves: 2,
    comments: [
      { by: 'minhtuan_dev', text: 'Feed load nhanh hơn hẳn anh ơi. Mà nút "Xem thêm" giờ đúng chỗ hơn rồi 👍', after: 40 },
      { by: 'haiyen_ux', text: 'Chip gợi ý của PU AI xinh ghê, nhưng trên mobile hơi sát mép phải anh xem lại giúp em nha', after: 75, replies: [{ by: 'lehoangphuc', text: 'Ok em, mai anh chỉnh padding. Cảm ơn em!', after: 20 }] },
      { by: 'tiendat_ngo', text: 'bao giờ có tính năng gửi sticker hả anh', after: 130, likes: 4, replies: [{ by: 'lehoangphuc', text: 'Đang nằm trong backlog rồi nhé 😂', after: 15 }] }
    ]
  },
  {
    key: 'off-rules-reminder',
    by: 'tranngocdiep',
    daysAgo: 17,
    at: '19:05',
    type: 'announcement',
    title: 'Nhắc nhẹ mùa thi giữa kỳ: không đăng đề đang thi',
    content: `Tuần này nhiều lớp thi giữa kỳ nên mình nhắc lại một chút:

- Không đăng ảnh đề / đáp án của bài thi **đang diễn ra hoặc chưa kết thúc ở các ca khác**. Bài như vậy sẽ bị ẩn và tài khoản có thể bị khóa tạm.
- Đề các năm trước, đề ôn tập thầy cô cho phép chia sẻ thì cứ thoải mái nhé, nhớ gắn mã môn.
- Thay vì xin đáp án, hãy đăng cách bạn làm và hỏi chỗ chưa hiểu, mọi người sẽ nhiệt tình hơn nhiều 😊

Chúc mọi người thi tốt!`,
    tags: ['NoiQuy', 'ThiGiuaKy'],
    community: 'phenikaa',
    likes: 11,
    comments: [
      { by: 'phamduclong', text: 'Ủng hộ. Mấy bạn IT101 cần ôn thì xem lại bài tổng hợp đệ quy với cây nhị phân mình ghim ở cộng đồng FIT nhé.', after: 30 }
    ]
  },
  {
    key: 'off-quang-office-hours',
    by: 'dovanquang',
    daysAgo: 9,
    at: '10:15',
    type: 'announcement',
    title: 'CS201 – Đổi lịch tiếp sinh viên & gợi ý đề tài cuối kỳ',
    content: `Các em lớp CS201,

Tuần sau thầy đi hội thảo nên giờ tiếp sinh viên chuyển sang **chiều thứ Sáu, 14h–16h, phòng A2-405**.

Về đề tài cuối kỳ, thầy khuyến khích các nhóm chọn bài toán có dữ liệu tiếng Việt thật, ví dụ:
- Phân loại phản hồi sinh viên về môn học (cảm xúc + chủ đề)
- Tóm tắt văn bản quy chế đào tạo
- Hỏi đáp trên tài liệu môn học (RAG), có đánh giá độ chính xác của câu trả lời

Yêu cầu chung: có baseline đơn giản (TF-IDF + Logistic Regression chẳng hạn) trước khi dùng mô hình lớn. Thầy chấm nặng phần **phân tích lỗi** hơn là con số accuracy.

Tài liệu tham khảo nhập môn NLP rất dễ đọc: https://huggingface.co/learn/nlp-course`,
    tags: ['CS201', 'DeTai', 'NLP'],
    course: 'CS201',
    community: 'fit',
    likes: 14,
    saves: 9,
    comments: [
      { by: 'ducanh_ai', text: 'Thầy ơi nhóm em làm RAG thì đánh giá bằng bộ câu hỏi tự tạo có được không ạ, hay phải có bộ chuẩn?', after: 50, replies: [{ by: 'dovanquang', text: 'Tự tạo được, nhưng phải có người gán nhãn độc lập với người viết hệ thống, và mô tả rõ cách tạo câu hỏi. Khoảng 100–200 câu là đủ cho bài môn học.', after: 140 }] },
      { by: 'vannam2k8', text: 'Em năm nhất đọc mà thấy hay quá, năm 3 em sẽ học thầy ạ 😆', after: 300, likes: 3 }
    ]
  },
  {
    key: 'off-ha-guest-talk',
    by: 'nguyenthuha',
    daysAgo: 12,
    at: '16:20',
    type: 'announcement',
    title: 'Talk: "Làm brand ở công ty FMCG thật ra trông như thế nào?"',
    content: `Thứ Năm tuần sau (14h, hội trường tầng 6 tòa A) khoa mời chị Brand Manager của một hãng đồ uống về nói chuyện với sinh viên FBA.

Nội dung:
- Một ngày làm việc của brand team: họp, số liệu, agency và… rất nhiều slide
- Câu chuyện một chiến dịch Tết từ brief đến lúc lên sóng
- Sinh viên năm 3–4 nên chuẩn bị gì để apply Management Trainee

Không cần đăng ký trước, đến sớm để có chỗ ngồi nhé. Ai có câu hỏi muốn gửi trước thì comment ở đây, cô tổng hợp gửi diễn giả.`,
    tags: ['FBA', 'Marketing', 'SuKien'],
    course: 'FBA101',
    community: 'clb-hoat-dong',
    images: [513],
    likes: 13,
    comments: [
      { by: 'khanhvy_mkt', text: 'Cô ơi em muốn hỏi: brand team đo hiệu quả chiến dịch awareness thế nào khi không bán hàng trực tiếp ạ?', after: 35, likes: 3 },
      { by: 'quochuy_dang', text: 'Hỏi giúp em: nên vào agency trước rồi mới sang client, hay vào client luôn từ đầu ạ?', after: 80 },
      { by: 'nguyenthuha', text: 'Cô ghi lại hết rồi nhé, câu của Vy và Huy đều rất đúng trọng tâm 👍', after: 200 }
    ]
  },
  {
    key: 'off-feedback-poll',
    by: 'lehoangphuc',
    daysAgo: 21,
    at: '20:00',
    type: 'general',
    title: 'Mọi người muốn team làm tính năng nào tiếp theo?',
    content: `Backlog đang có khá nhiều thứ, team muốn hỏi ý kiến trước khi làm. Vote giúp mình nhé, ai có ý tưởng khác thì comment luôn!`,
    tags: ['GopY', 'Roadmap'],
    community: 'phenikaa',
    poll: {
      question: 'Tính năng bạn muốn có nhất?',
      options: ['Lịch học & nhắc deadline', 'Chợ đồ cũ sinh viên', 'Phòng học nhóm có video call', 'Dark mode cho PDF viewer'],
      votes: [8, 5, 3, 2],
      closesInDays: 7
    },
    likes: 12,
    comments: [
      { by: 'thao_ielts', text: 'Lịch học + deadline đi anh, em quên nộp bài 2 lần rồi 😭', after: 15, likes: 5 },
      { by: 'khanhlinh_eat', text: 'Chợ đồ cũ!!! Cuối kỳ ai cũng muốn thanh lý nồi cơm điện 😂', after: 42, likes: 6 }
    ]
  }
]
