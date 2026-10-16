import type { SeedPost } from '../types'

// Học tập: hỏi bài, chia sẻ tài liệu, phương pháp học
export const STUDY_POSTS: SeedPost[] = [
  {
    key: 'study-nam-recursion',
    by: 'vannam2k8',
    daysAgo: 5,
    at: '23:10',
    type: 'question',
    title: 'Em không hiểu đệ quy chạy thế nào, ví dụ tính giai thừa ạ',
    content: `Em đọc slide IT101 mà vẫn không hình dung được hàm tự gọi lại chính nó thì máy chạy kiểu gì 🥲

\`\`\`cpp
int fact(int n) {
    if (n == 0) return 1;
    return n * fact(n - 1);
}
\`\`\`

Gọi \`fact(3)\` thì nó chạy từng bước như nào ạ? Sao nó biết đường quay lại để nhân?`,
    tags: ['DeQuy', 'Cpp', 'HoiDap'],
    course: 'IT101',
    community: 'fit',
    resolved: true,
    likes: 11,
    saves: 6,
    comments: [
      {
        by: 'phamduclong',
        solution: true,
        after: 25,
        likes: 9,
        text: `Hình dung mỗi lần gọi hàm là **xếp thêm 1 cái đĩa lên chồng** (call stack):

\`\`\`
fact(3) → chờ 3 * fact(2)
  fact(2) → chờ 2 * fact(1)
    fact(1) → chờ 1 * fact(0)
      fact(0) → trả về 1   ← chạm điều kiện dừng
    fact(1) = 1 * 1 = 1
  fact(2) = 2 * 1 = 2
fact(3) = 3 * 2 = 6
\`\`\`

Máy "biết đường quay lại" vì mỗi lần gọi đều lưu lại *đang làm dở ở đâu* trên stack. Gặp \`return\` thì lấy đĩa trên cùng ra và làm tiếp phép nhân còn dở.

Em mở https://visualgo.net/en/recursion gõ thử, xem cây gọi hàm vẽ ra là hiểu ngay.`
      },
      { by: 'vannam2k8', text: 'Ôi em hiểu rồi!!! Cái chồng đĩa dễ hình dung quá anh ơi, em cảm ơn ạ 😭', after: 15 },
      { by: 'minhtuan_dev', text: 'Hồi năm nhất ai giải thích kiểu chồng đĩa này cho mình thì đỡ biết bao', after: 70, likes: 3 }
    ]
  },
  {
    key: 'study-thao-ielts-writing',
    by: 'thao_ielts',
    daysAgo: 8,
    at: '20:30',
    type: 'resource_share',
    title: 'IELTS Writing Task 2 từ 6.0 lên 7.5: mình đã sửa 4 thứ này',
    content: `Mình từng kẹt ở Writing 6.0 gần 1 năm. Thứ giúp mình lên 7.5 không phải học thêm từ vựng "xịn", mà là:

**1. Trả lời đúng câu hỏi.** Đề hỏi "To what extent do you agree?" thì phải nêu rõ mức độ đồng ý ngay mở bài và giữ nguyên đến kết bài.

**2. Mỗi đoạn thân bài chỉ 1 ý chính**, theo khung: ý chính → giải thích → ví dụ cụ thể → câu chốt.

**3. Bớt cụm từ học thuộc.** "In this day and age", "It is undeniable that…" giám khảo đọc chán lắm rồi.

**4. Tự chấm theo 4 tiêu chí** (Task Response, Coherence, Lexical, Grammar) trước khi nhờ người khác chữa.

Band descriptors chính thức ở đây, đọc kỹ 1 lần là hiểu giám khảo cần gì: https://www.ielts.org

Ai muốn mình chữa bài thì đăng đề + bài viết vào cộng đồng nhé, mỗi tối mình chữa 2 bài.`,
    tags: ['IELTS', 'Writing', 'TiengAnh'],
    course: 'FEL101',
    images: [464],
    likes: 20,
    saves: 19,
    comments: [
      { by: 'khanhvy_mkt', text: 'Ý 3 đúng quá, mình học thuộc cả list mở bài xong bị chấm 6.0 😂', after: 40, likes: 5 },
      {
        by: 'ngocanh_med',
        text: 'Cho mình đăng ký 1 suất chữa bài nhé Thảo, mình cần 7.0 để xét học bổng',
        after: 80,
        replies: [{ by: 'thao_ielts', text: 'Ok luôn, gửi mình tối nay nha!', after: 20 }]
      },
      {
        by: 'vannam2k8',
        text: 'Em mới 5.0 có nên học Writing luôn không chị, hay học Reading trước ạ?',
        after: 200,
        replies: [{ by: 'thao_ielts', text: 'Em làm Reading + Listening trước 1–2 tháng cho quen từ vựng, rồi mới vào Writing sẽ đỡ hơn nhiều.', after: 35 }]
      }
    ]
  },
  {
    key: 'study-nam-limit',
    by: 'vannam2k8',
    daysAgo: 14,
    at: '21:40',
    type: 'question',
    title: 'Giới hạn $\\lim_{x \\to 0} \\frac{\\sin 3x}{x}$ làm sao ra 3 ạ?',
    content: `Em biết $\\lim_{x \\to 0} \\frac{\\sin x}{x} = 1$ nhưng bài này có $3x$ ở trên mà $x$ ở dưới nên em bị rối. Mong mọi người giải thích giúp em từng bước ạ 🙏`,
    tags: ['GiaiTich', 'GioiHan', 'HoiDap'],
    course: 'MATH201',
    resolved: true,
    likes: 8,
    comments: [
      {
        by: 'thutrang_ly',
        solution: true,
        after: 20,
        likes: 6,
        text: `Nhân và chia cho 3 để tạo dạng quen thuộc:

$$\\lim_{x \\to 0} \\frac{\\sin 3x}{x} = \\lim_{x \\to 0} 3 \\cdot \\frac{\\sin 3x}{3x}$$

Đặt $t = 3x$, khi $x \\to 0$ thì $t \\to 0$:

$$= 3 \\cdot \\lim_{t \\to 0} \\frac{\\sin t}{t} = 3 \\cdot 1 = 3$$

Mẹo: tổng quát $\\lim_{x \\to 0} \\frac{\\sin ax}{bx} = \\frac{a}{b}$.`
      },
      { by: 'vannam2k8', text: 'À nhân chia 3, hiểu rồi ạ. Em cảm ơn chị 🙏', after: 10 },
      {
        by: 'phamduclong',
        text: 'Trang giải hay. Em làm thêm bài $\\lim_{x \\to 0} \\frac{\\tan 2x}{\\sin 5x}$ để luyện nhé, đáp án 2/5.',
        after: 60,
        likes: 3
      }
    ]
  },
  {
    key: 'study-long-sql-join',
    by: 'phamduclong',
    daysAgo: 21,
    at: '09:30',
    type: 'resource_share',
    title: '[IT103] Tóm tắt JOIN trong 1 hình + bài tập tự luyện',
    content: `Lớp IT103 tuần này học JOIN, mình tóm tắt nhanh:

- **INNER JOIN**: chỉ lấy dòng khớp ở cả 2 bảng
- **LEFT JOIN**: lấy hết bảng trái, bảng phải không khớp thì NULL
- **FULL JOIN**: lấy hết cả 2 bên
- **CROSS JOIN**: ghép mọi cặp (cẩn thận bùng nổ số dòng!)

Bài tập: cho bảng \`students(id, name)\` và \`enrollments(student_id, course_code)\`.

1. Liệt kê sinh viên **chưa đăng ký** môn nào.
2. Đếm số sinh viên mỗi môn, kể cả môn chưa có ai.

Gợi ý câu 1:
\`\`\`sql
SELECT s.name
FROM students s
LEFT JOIN enrollments e ON e.student_id = s.id
WHERE e.student_id IS NULL;
\`\`\`

Câu 2 các bạn tự làm rồi comment đáp án nhé, mình chữa vào tối thứ 5.`,
    tags: ['SQL', 'JOIN', 'IT103'],
    course: 'IT103',
    community: 'fit',
    images: [180],
    likes: 14,
    saves: 13,
    comments: [
      {
        by: 'minhquan_gg',
        text: 'Câu 2: cần bảng courses rồi LEFT JOIN enrollments, GROUP BY course_code, COUNT(e.student_id). Đúng không anh?',
        after: 120,
        replies: [
          { by: 'phamduclong', text: 'Chuẩn. Nhớ COUNT(e.student_id) chứ không phải COUNT(*), không thì môn trống vẫn đếm ra 1 👍', after: 40, likes: 5 }
        ]
      },
      { by: 'vannam2k8', text: 'Em lưu lại để năm 2 học ạ', after: 300 }
    ]
  },
  {
    key: 'study-ngocanh-anatomy',
    by: 'ngocanh_med',
    daysAgo: 10,
    at: '22:15',
    type: 'resource_share',
    title: 'Học giải phẫu bằng Anki + sơ đồ: 2 tháng nhớ được 12 đôi dây thần kinh sọ',
    content: `Mình chia sẻ cách học đang dùng cho FMS101, ai học khối sức khỏe tham khảo nhé:

1. **Vẽ lại sơ đồ bằng tay** sau mỗi buổi học (không chép slide, vẽ theo trí nhớ rồi mới so).
2. **Làm thẻ Anki** từ chỗ mình vẽ sai. Mỗi thẻ hỏi 1 ý nhỏ: "Dây số VII chi phối cơ nào?"
3. **Ôn 20 phút mỗi sáng** thay vì 3 tiếng trước thi. Lặp lại ngắt quãng mới là chìa khóa.
4. Câu thần chú nhớ tên 12 đôi dây sọ, nhóm mình tự chế bằng tiếng Việt, ai cần inbox mình 😆

Anki miễn phí trên máy tính: https://apps.ankiweb.net

Sau 2 tháng mình nhớ chắc cả đường đi lẫn chức năng, thi thử được 8.5.`,
    tags: ['GiaiPhau', 'Anki', 'PhuongPhapHoc'],
    course: 'FMS101',
    images: [832, 24],
    likes: 17,
    saves: 15,
    comments: [
      { by: 'thao_ielts', text: 'Anki dùng học từ vựng IELTS cũng xịn lắm, công nhận cái lặp lại ngắt quãng', after: 30, likes: 3 },
      { by: 'giabao_runs', text: 'Ngành khác đọc cũng thấy áp dụng được. Mai thử với công thức Vật lý', after: 100 }
    ]
  },
  {
    key: 'study-bao-ev-battery',
    by: 'giabao_runs',
    daysAgo: 24,
    at: '20:00',
    title: 'Vì sao xe điện đi mùa đông bị giảm quãng đường? (giải thích dễ hiểu)',
    content: `Hôm trước học FAE102 có phần này hay, viết lại cho mọi người:

Pin lithium-ion hoạt động nhờ ion lithium di chuyển qua chất điện phân. Khi trời lạnh:
- Chất điện phân **đặc lại** → ion di chuyển chậm → điện trở trong tăng → pin "đuối" hơn.
- Xe phải dùng điện để **sưởi pin và sưởi cabin**, mà sưởi tốn điện hơn điều hòa làm mát nhiều.

Kết quả: mùa đông lạnh sâu có thể giảm 20–30% quãng đường (tùy xe và khí hậu). Ở Hà Nội mùa đông không quá lạnh nên ảnh hưởng nhẹ hơn.

Mẹo cho người dùng xe điện: sạc xong đi luôn khi pin còn ấm, bật sưởi trước khi rút sạc (lấy điện lưới chứ không lấy điện pin).`,
    tags: ['XeDien', 'PinLithium', 'KyThuat'],
    course: 'FAE102',
    images: [1071],
    likes: 13,
    saves: 6,
    comments: [
      { by: 'ducanh_ai', text: 'Giải thích dễ hiểu thật, giờ mới biết bật sưởi lúc đang cắm sạc là có lý do', after: 60 },
      { by: 'tiendat_ngo', text: 'pin điện thoại mình mùa đông cũng tụt nhanh, ra là vậy', after: 140, likes: 4 }
    ]
  },
  {
    key: 'study-thao-listening',
    by: 'thao_ielts',
    daysAgo: 26,
    at: '21:00',
    content: `Mẹo luyện Listening ít tốn công nhất mình từng làm: mỗi ngày nghe **1 tập podcast 15 phút**, chép chính tả đúng 2 phút trong đó.

Chép chính tả 2 phút thôi nhưng sẽ lộ ra hết chỗ mình nghe nhầm (âm cuối, từ nối). Làm đều 1 tháng là thấy khác.`,
    tags: ['IELTS', 'Listening', 'Tips'],
    course: 'FEL101',
    likes: 15,
    saves: 11,
    comments: [
      {
        by: 'thuydung05',
        text: 'podcast gì vậy Thảo, cho xin tên với',
        after: 20,
        replies: [{ by: 'thao_ielts', text: '6 Minute English của BBC cho người mới, quen rồi thì chuyển sang podcast mình thích nhé', after: 15 }]
      }
    ]
  },
  {
    key: 'study-pbl-recruit',
    by: 'ducanh_ai',
    daysAgo: 4,
    at: '13:20',
    type: 'pbl_recruitment',
    title: '[PBL3 – CS203] Tuyển 2 bạn làm đề tài nhận diện biển số xe trong bãi gửi xe của trường',
    content: `Nhóm mình đang có 2 người (K16 AI), cần thêm **2 bạn** cho đồ án PBL3 môn Thị giác máy tính:

**Đề tài:** Nhận diện biển số xe máy ở cổng bãi xe, chạy được trên máy tính thường (không GPU).

**Cần:**
- 1 bạn thích xử lý ảnh / train model (biết Python, đã dùng OpenCV là tốt)
- 1 bạn làm giao diện + API (React hoặc Flutter đều được)

**Nhóm có:** dữ liệu 3.000 ảnh tự chụp đã gán nhãn, kế hoạch rõ ràng theo tuần, họp online tối thứ 3.

Không yêu cầu giỏi, chỉ cần **cam kết làm đều**. Comment hoặc inbox mình nhé!`,
    tags: ['PBL3', 'ComputerVision', 'TuyenThanhVien'],
    course: 'CS203',
    community: 'do-an-tot-nghiep',
    images: [1072],
    likes: 10,
    comments: [
      { by: 'minhquan_gg', text: 'Mình làm phần API được, có kinh nghiệm FastAPI. Inbox nhé', after: 40 },
      { by: 'dovanquang', text: 'Đề tài thực tế, nhớ xử lý ảnh ban đêm và trời mưa, đó là phần khó nhất. Thầy ủng hộ.', after: 180, likes: 5 }
    ]
  },
  {
    key: 'study-long-dp-tips',
    by: 'phamduclong',
    daysAgo: 33,
    at: '22:00',
    title: 'Quy hoạch động không đáng sợ: 4 câu hỏi để tự đặt công thức',
    content: `Mỗi khi gặp bài DP, mình tự hỏi 4 câu:

1. **Trạng thái là gì?** \`dp[i]\` nghĩa là gì, nói thành lời được không?
2. **Chuyển trạng thái thế nào?** \`dp[i]\` tính từ những \`dp\` nhỏ hơn nào?
3. **Trường hợp cơ sở?** \`dp[0]\`, \`dp[1]\` bằng bao nhiêu?
4. **Đáp án nằm ở đâu?** \`dp[n]\` hay \`max(dp[...])\`?

Ví dụ bài leo cầu thang (mỗi lần bước 1 hoặc 2 bậc, có bao nhiêu cách lên bậc n):
- Trạng thái: \`dp[i]\` = số cách lên bậc i
- Chuyển: \`dp[i] = dp[i-1] + dp[i-2]\`
- Cơ sở: \`dp[0] = 1, dp[1] = 1\`
- Đáp án: \`dp[n]\`

Trả lời được 4 câu là code chỉ còn 5 dòng. Luyện thêm theo lộ trình ở https://neetcode.io/roadmap phần 1-D DP nhé.`,
    tags: ['QuyHoachDong', 'ThuatToan', 'IT101'],
    course: 'IT101',
    community: 'fit',
    likes: 16,
    saves: 14,
    comments: [
      { by: 'minhtuan_dev', text: 'Câu 1 "nói thành lời được không" là chìa khóa luôn. Không nói được là chưa hiểu bài', after: 50, likes: 5 },
      { by: 'vannam2k8', text: 'Em lưu để học kỳ sau ạ 🫡', after: 600 }
    ]
  },
  {
    key: 'study-physics-help',
    by: 'vannam2k8',
    daysAgo: 1,
    at: '22:50',
    type: 'question',
    title: 'Vật lý đại cương: vật trượt trên mặt phẳng nghiêng có ma sát, em ra sai đáp án',
    content: `Đề: Vật khối lượng 2kg trượt từ đỉnh mặt phẳng nghiêng góc 30°, hệ số ma sát 0,2. Tính gia tốc của vật (g = 10 m/s²).

Em làm: $a = g\\sin 30° = 5$ m/s² nhưng đáp án là khoảng 3,27 m/s². Em sai ở đâu ạ?`,
    tags: ['VatLy', 'CoHoc', 'HoiDap'],
    course: 'PHY102',
    likes: 5,
    comments: [
      {
        by: 'giabao_runs',
        after: 30,
        likes: 3,
        text: `Em quên lực ma sát rồi. Theo phương mặt phẳng nghiêng:

$$ma = mg\\sin\\alpha - \\mu mg\\cos\\alpha$$
$$a = g(\\sin 30° - 0{,}2\\cos 30°) = 10(0{,}5 - 0{,}173) \\approx 3{,}27 \\text{ m/s}^2$$

Lưu ý khối lượng triệt tiêu nên 2kg không ảnh hưởng gia tốc.`
      },
      { by: 'vannam2k8', text: 'Dạ đúng rồi ạ, em quên ma sát 🥲 Cảm ơn anh!', after: 15 }
    ]
  },
  {
    key: 'study-exam-poll',
    by: 'phamduclong',
    daysAgo: 6,
    at: '18:00',
    title: 'Lớp IT101 muốn ôn tập kiểu nào trước thi?',
    content: `Mình định tổ chức 1 buổi ôn tập trước thi cuối kỳ IT101. Mọi người vote giúp hình thức nhé, kết quả nhiều nhất mình chốt.`,
    tags: ['IT101', 'OnThi'],
    course: 'IT101',
    community: 'fit',
    poll: {
      question: 'Hình thức ôn tập IT101?',
      options: ['Chữa đề cũ trên lớp', 'Livestream giải bài tối', 'Mini contest 90 phút', 'Tổng hợp lý thuyết'],
      votes: [9, 4, 3, 2],
      closesInDays: 5
    },
    likes: 9,
    comments: [
      { by: 'vannam2k8', text: 'Chữa đề cũ đi anh, em sợ dạng cây nhị phân nhất 🥲', after: 20 },
      { by: 'minhquan_gg', text: 'Mini contest cho vui anh ơi 😎', after: 45 }
    ]
  }
]
