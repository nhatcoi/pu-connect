import type { SeedPost } from '../types'

// Kinh doanh: khởi nghiệp, marketing, tài chính cá nhân, đi làm
export const BUSINESS_POSTS: SeedPost[] = [
  {
    key: 'biz-huy-fail-twice',
    by: 'quochuy_dang',
    daysAgo: 11,
    at: '22:45',
    title: 'Hai lần khởi nghiệp thất bại hồi sinh viên, mình học được gì',
    content: `**Lần 1 (năm 2): bán đồ ăn vặt online.** Làm fanpage, chụp ảnh đẹp, chạy quảng cáo. Tháng đầu lãi, tháng thứ 3 lỗ vì giá nhập tăng mà không dám tăng giá bán. Bài học: tính **biên lợi nhuận** trước khi tính doanh thu.

**Lần 2 (năm 3): app ghép bạn cùng phòng trọ.** Code 4 tháng, ra mắt có 60 người dùng, sau 2 tuần còn 3. Bài học: đi hỏi người dùng thật *trước khi* code. Mình đã code thứ mình thích chứ không phải thứ họ cần.

**Lần 3 (đang làm): công cụ luyện đề cho sinh viên.** Lần này làm ngược lại: 2 tháng đầu không code dòng nào, chỉ làm form + Google Sheet thủ công cho 40 bạn dùng thử. Khi thấy các bạn quay lại mỗi tuần mới bắt đầu làm sản phẩm.

Thất bại không đáng sợ bằng thất bại *mà không biết vì sao*. Ghi chép lại mọi thứ, kể cả những con số xấu.

Ai đang có ý tưởng muốn nói chuyện thì cứ inbox, mình không bán khóa học đâu 😂`,
    tags: ['KhoiNghiep', 'Startup', 'KinhNghiem'],
    course: 'FBA104',
    images: [1029],
    likes: 19,
    saves: 9,
    comments: [
      { by: 'khanhvy_mkt', text: '"Code thứ mình thích chứ không phải thứ họ cần" đọc mà nhột ghê 😅', after: 30, likes: 7 },
      { by: 'nguyenthuha', text: 'Bài viết rất thật. Cô sẽ dùng câu chuyện app phòng trọ làm ví dụ cho lớp về product-market fit, nếu em đồng ý nhé.', after: 300, replies: [{ by: 'quochuy_dang', text: 'Dạ em đồng ý ạ, vinh dự quá cô ơi 🙏', after: 15 }] },
      { by: 'minhtuan_dev', text: 'Lần 3 cần FE thì gọi tui nha', after: 120 }
    ]
  },
  {
    key: 'biz-trang-budget',
    by: 'thutrang_ly',
    daysAgo: 7,
    at: '20:20',
    title: 'Sống ở Hà Nội với 4 triệu/tháng: bảng chi tiêu thật của mình',
    content: `Nhiều bạn hỏi nên mình public luôn bảng chi tiêu tháng 9 (ở ghép, gần trường):

| Khoản | Số tiền |
|---|---|
| Tiền phòng (ở ghép 3 người) | 1.300.000đ |
| Điện nước, wifi | 250.000đ |
| Ăn uống (tự nấu tối, trưa ăn căng tin) | 1.600.000đ |
| Đi lại (xe máy) | 200.000đ |
| Sách vở, in tài liệu | 150.000đ |
| Linh tinh, cà phê, trà sữa | 300.000đ |
| **Tiết kiệm** | **200.000đ** |

Mấy mẹo đang áp dụng:
- Chia tiền vào 3 "túi" ngay đầu tháng: cố định, ăn uống, linh tinh. Túi linh tinh hết là hết, không rút từ túi khác.
- Đi chợ Yên Nghĩa buổi chiều, rau rẻ hơn siêu thị gần một nửa.
- Mua sách cũ của khóa trên, hoặc mượn thư viện.

Không phải lời khuyên đầu tư gì đâu, chỉ là chi tiêu sinh viên thôi 😄 Mọi người chia sẻ thêm mẹo nhé!`,
    tags: ['TaiChinhCaNhan', 'SinhVien', 'ChiTieu'],
    community: 'tim-phong-tro',
    images: [998],
    likes: 20,
    saves: 18,
    comments: [
      { by: 'khanhlinh_eat', text: 'Ăn có 1tr6 mà vẫn sống được là bạn giỏi lắm rồi 😭 tháng trước mình ăn hết 2tr8', after: 18, likes: 9 },
      { by: 'vannam2k8', text: 'Em K20 lưu lại ạ, tháng đầu em tiêu hơi lố 🥲', after: 45 },
      { by: 'tiendat_ngo', text: 'túi linh tinh của tôi hết vào ngày mùng 3', after: 70, likes: 11 },
      { by: 'thutrang_ly', text: '@tiendat_ngo vậy là nên chia túi linh tinh theo tuần chứ không theo tháng nha 😂', after: 12 }
    ]
  },
  {
    key: 'biz-vy-content-rejected',
    by: 'khanhvy_mkt',
    daysAgo: 5,
    at: '21:30',
    title: 'Content bị sếp sửa 7 lần và bài học về "insight"',
    content: `Tuần này mình viết caption cho một sản phẩm sữa chua uống. Bản 1 mình viết kiểu: "Sữa chua lợi khuẩn, tốt cho tiêu hóa, vị ngon tự nhiên".

Sếp đọc xong hỏi: *"Em có bao giờ mua sữa chua vì nó tốt cho tiêu hóa không?"*. Mình… không. Mình mua vì đói lúc 4h chiều và nó tiện.

Bản 7 (được duyệt) xoay quanh khoảnh khắc 4h chiều ở văn phòng, khi cần gì đó nhẹ mà không muốn ăn vặt linh tinh.

Ghi chép lại:
- **Lợi ích sản phẩm ≠ lý do người ta mua.**
- Insight thường là một sự thật nhỏ, hơi "nhột", mà người đọc gật gù "ừ đúng rồi".
- Đi hỏi 5 người thật còn hơn ngồi nghĩ 5 tiếng.

Thực tập vất vả nhưng học được nhiều hơn cả kỳ trên lớp (xin lỗi cô 😅).`,
    tags: ['Marketing', 'Content', 'Insight', 'ThucTap'],
    course: 'FBA101',
    images: [1060],
    likes: 18,
    saves: 8,
    comments: [
      { by: 'nguyenthuha', text: 'Không cần xin lỗi đâu, cô dạy để các em đi làm học được nhanh hơn mà 😄 Ví dụ 4h chiều rất hay.', after: 90, likes: 8 },
      { by: 'quochuy_dang', text: 'Câu hỏi của sếp bạn đáng giá cả khóa học', after: 40, likes: 4 },
      { by: 'thuydung05', text: '4h chiều là giờ mình mở tủ lạnh thật 😭 bị đọc vị', after: 75, likes: 6 }
    ]
  },
  {
    key: 'biz-ha-case-question',
    by: 'nguyenthuha',
    daysAgo: 19,
    at: '09:00',
    type: 'question',
    title: '[FBA101] Bài tập tình huống tuần 6: vì sao chiến dịch đổi bao bì thất bại?',
    content: `Câu hỏi thảo luận cho lớp FBA101, các bạn khác cũng có thể tham gia:

Một thương hiệu nước ép đổi bao bì sang thiết kế tối giản, hiện đại hơn. Sau 2 tháng, doanh số giảm khoảng 20%, khảo sát cho thấy nhiều khách quen *không nhận ra sản phẩm trên kệ*.

1. Theo các em, nguyên nhân gốc là gì?
2. Nếu là brand manager, em sẽ kiểm tra gì **trước khi** đổi bao bì?
3. Bây giờ nên quay lại bao bì cũ hay giữ bao bì mới? Vì sao?

Trả lời ngắn gọn, có lập luận. Câu trả lời tốt nhất cô sẽ chọn làm lời giải và cộng điểm chuyên cần.`,
    tags: ['FBA101', 'CaseStudy', 'Branding'],
    course: 'FBA101',
    resolved: true,
    likes: 10,
    saves: 7,
    comments: [
      {
        by: 'khanhvy_mkt',
        solution: true,
        after: 140,
        likes: 6,
        text: `1. Thương hiệu làm mất **tài sản nhận diện** (màu, hình trái cây, logo lớn) mà khách quen dùng để tìm sản phẩm trong vài giây trên kệ.
2. Trước khi đổi: xác định yếu tố nào khách dùng để nhận ra sản phẩm (khảo sát + eye-tracking/test trên kệ thật), giữ lại những yếu tố đó, test A/B ở vài cửa hàng trước khi đổi toàn bộ.
3. Không nên quay lại hoàn toàn, vì lại gây nhiễu lần nữa. Nên đưa lại các yếu tố nhận diện cũ (màu chủ đạo, hình trái cây) lên bao bì mới, kèm truyền thông tại điểm bán "bao bì mới, vị như cũ".`
      },
      { by: 'thutrang_ly', text: 'Em nghĩ thêm: cần xem doanh số giảm đều mọi kênh hay chỉ ở siêu thị. Nếu online không giảm thì đúng là vấn đề nhận diện trên kệ ạ.', after: 210, likes: 3 },
      { by: 'nguyenthuha', text: 'Vy trả lời đầy đủ và có hành động cụ thể. Ý của Trang về tách kênh để kiểm chứng giả thuyết cũng rất tốt 👏', after: 400 }
    ]
  },
  {
    key: 'biz-trang-first-salary',
    by: 'thutrang_ly',
    daysAgo: 27,
    at: '18:10',
    content: `Nhận lương part-time tháng đầu tiên ở quán cà phê: 2.350.000đ 🥹

Tự thưởng 1 ly bạc xỉu, số còn lại chia 50% tiết kiệm, 30% gửi mẹ, 20% mua sách. Cảm giác tiền tự làm ra nó khác thật sự.`,
    tags: ['PartTime', 'SinhVien'],
    images: [431],
    likes: 20,
    comments: [
      { by: 'anhthu_phan', text: 'Gửi mẹ 30% làm mình xúc động ghê 🥲', after: 20, likes: 5 },
      { by: 'khanhlinh_eat', text: 'quán nào vậy bà, cuối tuần qua ủng hộ', after: 45, replies: [{ by: 'thutrang_ly', text: 'quán nhỏ trong ngõ gần cổng phụ á, qua mình mời bạc xỉu 😆', after: 10 }] }
    ]
  },
  {
    key: 'biz-huy-recruit',
    by: 'quochuy_dang',
    daysAgo: 1,
    at: '11:30',
    type: 'pbl_recruitment',
    title: 'Startup edtech sinh viên tuyển 2 bạn: 1 Backend (NestJS), 1 Content học thuật',
    content: `Team mình đang làm công cụ luyện đề cho sinh viên, đã có ~400 bạn dùng thường xuyên. Cần thêm:

**Backend intern (part-time, có trợ cấp)**
- Biết TypeScript, đã làm qua NestJS hoặc Express
- Biết SQL cơ bản (Postgres là điểm cộng)
- 15–20 giờ/tuần, làm hybrid

**Cộng tác viên nội dung học thuật**
- Soạn và kiểm tra lời giải môn Giải tích, Đại số tuyến tính, Xác suất
- Điểm môn đó từ B+ trở lên
- Trả theo số bài

Không cần CV đẹp, gửi mình 1 thứ bạn đã làm (repo, bài giải, bài viết…) là đủ. Comment hoặc inbox nhé!`,
    tags: ['TuyenDung', 'Startup', 'NestJS', 'PartTime'],
    community: 'do-an-tot-nghiep',
    likes: 12,
    saves: 6,
    comments: [
      { by: 'vannam2k8', text: 'Em năm nhất có làm CTV được không anh, em Giải tích 1 được A ạ 😳', after: 35, replies: [{ by: 'quochuy_dang', text: 'Được em, inbox anh gửi 2 bài em giải nhé!', after: 20 }] },
      { by: 'minhquan_gg', text: 'Backend có nhận Java Spring không anh 👀', after: 80 }
    ]
  },
  {
    key: 'biz-vy-cv-tips',
    by: 'khanhvy_mkt',
    daysAgo: 30,
    at: '20:40',
    type: 'resource_share',
    title: 'CV ứng tuyển Marketing intern: 5 lỗi mình thấy nhiều nhất khi được nhờ review',
    content: `Mình được nhờ xem khoảng 30 CV của các bạn khóa dưới, tổng hợp lỗi hay gặp:

1. **Liệt kê nhiệm vụ thay vì kết quả.** "Quản lý fanpage CLB" → "Tăng tương tác fanpage CLB từ ~200 lên ~1.500/bài sau 3 tháng".
2. **Kỹ năng chung chung:** "giao tiếp tốt, làm việc nhóm". Ai cũng ghi, nhà tuyển dụng lướt qua luôn.
3. **CV 3 trang.** Sinh viên 1 trang là đủ.
4. **Email kiểu cutegirl2k5@…** Tạo email tên thật đi mọi người 😅
5. **Không có link sản phẩm.** Marketing mà không có 1 bài viết, 1 video, 1 ấn phẩm nào để xem là thiệt lắm.

Ai muốn mình xem giúp CV thì gửi vào đây, mỗi tuần mình nhận 3 bạn nhé.`,
    tags: ['CV', 'ThucTap', 'Marketing'],
    community: 'clb-hoat-dong',
    likes: 16,
    saves: 15,
    comments: [
      { by: 'thuydung05', text: 'số 4 đau quá vì email của mình là dungxinhgai 😭', after: 15, likes: 12 },
      { by: 'anhthu_phan', text: 'Cho mình 1 slot tuần này nha Vy', after: 40 },
      { by: 'tranngocdiep', text: 'Bài này nên ghim ở cộng đồng CLB, mình ghim nhé', after: 120 }
    ]
  },
  {
    key: 'biz-trang-scam-warning',
    by: 'thutrang_ly',
    daysAgo: 14,
    at: '22:00',
    title: '⚠️ Cảnh giác "việc nhẹ lương cao" nhắm vào tân sinh viên',
    content: `Tuần này 2 bạn K20 nhắn mình hỏi về một nhóm tuyển "cộng tác viên chốt đơn online, 300–500k/ngày, chỉ cần điện thoại". Dấu hiệu lừa đảo rất rõ:

- Yêu cầu **nạp tiền trước** để "kích hoạt tài khoản" hoặc "làm nhiệm vụ"
- Mấy nhiệm vụ đầu trả tiền thật (vài chục nghìn) để tạo lòng tin
- Sau đó nhiệm vụ "lớn" bắt nạp nhiều hơn, rồi báo lỗi không rút được

Nguyên tắc đơn giản: **việc nào bắt bạn đưa tiền trước để được làm việc thì đều là lừa đảo.**

Nếu lỡ chuyển tiền, gọi ngay ngân hàng để yêu cầu phong tỏa và báo công an phường. Share cho các em K20 nhé 🙏`,
    tags: ['CanhBao', 'LuaDao', 'TanSinhVien'],
    community: 'phenikaa',
    likes: 20,
    saves: 5,
    comments: [
      { by: 'tranngocdiep', text: 'Cảm ơn Trang, mình ghim bài này ở Đại sảnh tuần này nhé.', after: 30 },
      { by: 'vannam2k8', text: 'Bạn cùng phòng em suýt dính vụ này tuần trước 😨', after: 60, likes: 4 }
    ]
  }
]
