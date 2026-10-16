import type { SeedPost } from '../types'

// Bài ngắn thường ngày để bảng tin dày & tự nhiên hơn / Everyday short posts
export const MORE_POSTS: SeedPost[] = [
  {
    key: 'more-quang-ml-myth',
    by: 'dovanquang',
    daysAgo: 16,
    at: '21:10',
    title: 'Ba hiểu lầm phổ biến của sinh viên khi mới học Machine Learning',
    content: `Chấm đồ án mấy năm nay, thầy hay gặp 3 hiểu lầm:

**1. "Accuracy cao là mô hình tốt."** Dữ liệu 95% một lớp thì đoán bừa cũng được 95%. Hãy nhìn precision, recall, ma trận nhầm lẫn.

**2. "Mô hình càng to càng tốt."** Với vài nghìn mẫu, một mô hình đơn giản được chọn đặc trưng cẩn thận thường thắng. Và nó giải thích được.

**3. "Chia train/test xong là xong."** Nếu em chỉnh tham số dựa trên tập test thì tập test đã thành tập train. Cần tập validation riêng, hoặc cross-validation.

Lời khuyên: trước khi train bất cứ gì, hãy dành một buổi chỉ để **nhìn dữ liệu**. Đọc 100 mẫu bằng mắt. Rất nhiều lỗi lộ ra ở bước này.`,
    tags: ['MachineLearning', 'CS201', 'LoiKhuyen'],
    course: 'CS201',
    community: 'fit',
    likes: 18,
    saves: 14,
    comments: [
      { by: 'ducanh_ai', text: '"Đọc 100 mẫu bằng mắt", em ước biết câu này trước khi train 3 ngày trên dữ liệu gán nhãn sai 🥲', after: 30, likes: 6 },
      { by: 'minhquan_gg', text: 'Số 3 đúng là lỗi kinh điển, nhóm em bị trừ điểm vụ này kỳ trước', after: 90 }
    ]
  },
  {
    key: 'more-ha-reading-list',
    by: 'nguyenthuha',
    daysAgo: 25,
    at: '20:30',
    type: 'resource_share',
    title: 'Danh sách đọc cho sinh viên Marketing năm 1–2',
    content: `Nhiều em hỏi nên đọc gì ngoài giáo trình, cô gợi ý vài cuốn dễ đọc mà thấm:

- *Positioning* – Al Ries & Jack Trout: nền tảng về định vị, ngắn và dễ hiểu
- *How Brands Grow* – Byron Sharp: góc nhìn dựa trên dữ liệu, sẽ làm các em nghi ngờ vài điều trên lớp (tốt!)
- *Contagious* – Jonah Berger: vì sao có thứ được chia sẻ, có thứ không
- *Made to Stick* – Chip & Dan Heath: viết thông điệp dễ nhớ

Đọc xong mỗi cuốn, thử viết 1 đoạn: "Điều mình không đồng ý với tác giả là…". Đó là lúc các em thực sự học.`,
    tags: ['Marketing', 'SachHay', 'FBA'],
    course: 'FBA101',
    images: [1073],
    likes: 16,
    saves: 15,
    comments: [
      { by: 'khanhvy_mkt', text: 'How Brands Grow đọc xong đúng là "vỡ mộng" vài điều thật cô ạ 😆', after: 60, likes: 4 },
      {
        by: 'thutrang_ly',
        text: 'Em lưu lại, thư viện trường có Positioning bản tiếng Việt không cô?',
        after: 120,
        replies: [{ by: 'nguyenthuha', text: 'Có em, tầng 2 khu sách kinh tế nhé.', after: 40 }]
      }
    ]
  },
  {
    key: 'more-diep-volunteer',
    by: 'tranngocdiep',
    daysAgo: 8,
    at: '19:45',
    type: 'announcement',
    title: 'Tuyển 30 tình nguyện viên "Mùa đông ấm" – quyên góp áo ấm cho trẻ em vùng cao',
    content: `CLB Tình nguyện Phenikaa mở đơn tuyển tình nguyện viên cho chương trình cuối tháng 11:

📦 Nhận và phân loại quần áo, sách vở quyên góp tại sảnh tòa A (tối thứ 3, 5)
🚌 Chuyến trao quà 2 ngày 1 đêm lên Yên Bái (giới hạn 15 người)

Không cần kinh nghiệm, chỉ cần nhiệt tình. Ai không đi được vẫn có thể góp quần áo cũ còn tốt, sách giáo khoa cấp 1–2.

Đăng ký bằng cách comment "Tham gia" + khoa/khóa, BTC sẽ nhắn lại nhé 🧣`,
    tags: ['TinhNguyen', 'MuaDongAm', 'CLB'],
    community: 'clb-hoat-dong',
    likes: 17,
    comments: [
      { by: 'anhthu_phan', text: 'Tham gia – K17 QTDL, mình chụp ảnh cho chuyến đi được nha', after: 15, likes: 4 },
      { by: 'giabao_runs', text: 'Tham gia – K17 Ô tô. Cần người khuân vác thì gọi mình 💪', after: 30, likes: 3 },
      { by: 'ngocanh_med', text: 'Tham gia – K18 Y khoa, mình mang theo túi sơ cứu cơ bản được ạ', after: 45, likes: 5 },
      {
        by: 'vannam2k8',
        text: 'Em góp sách lớp 1–5 của em gái được không chị?',
        after: 70,
        replies: [{ by: 'tranngocdiep', text: 'Được luôn em, quý lắm đó!', after: 10 }]
      }
    ]
  },
  {
    key: 'more-yen-color',
    by: 'haiyen_ux',
    daysAgo: 13,
    at: '14:10',
    content: `Mẹo nhỏ phối màu cho người không học design: chọn **1 màu chủ đạo, 1 màu nhấn, còn lại là xám**. Slide thuyết trình của bạn sẽ "sang" lên ngay 🎨

Chỉ cần nhớ vậy thôi là đủ cho 90% bài thuyết trình trên lớp.`,
    tags: ['Design', 'Tips', 'ThuyetTrinh'],
    images: [534],
    likes: 14,
    saves: 9,
    comments: [{ by: 'thuydung05', text: 'slide của mình đang có 7 màu, chắc là 7 màu chủ đạo 🌈', after: 20, likes: 7 }]
  },
  {
    key: 'more-thu-motorbike',
    by: 'anhthu_phan',
    daysAgo: 15,
    at: '18:30',
    content: `Hà Nội 6h chiều, giờ cao điểm mà vẫn thấy thành phố này đẹp kiểu gì ấy. Chụp vội ở ngã tư trên đường về.`,
    tags: ['HaNoi', 'Photography', 'StreetPhoto'],
    images: [342],
    likes: 15,
    comments: [
      { by: 'haiyen_ux', text: 'màu ảnh như phim luôn', after: 30 },
      { by: 'tiendat_ngo', text: 'mình ở trong bức ảnh này đó, đang kẹt xe', after: 50, likes: 8 }
    ]
  },
  {
    key: 'more-thu-hoi-an',
    by: 'anhthu_phan',
    daysAgo: 38,
    at: '20:00',
    title: 'Hội An 2 ngày: đi chậm, ăn nhiều, chụp ít thôi',
    content: `Lần thứ 3 đến Hội An, lần này mình không chạy lịch trình nữa. Sáng đạp xe ra đồng Trà Quế, trưa ăn cơm gà, chiều ngồi quán cà phê nhìn tường vàng, tối thả đèn.

Vài lưu ý:
- Phố cổ đẹp nhất **trước 8h sáng**, chưa đông khách.
- Đi xe đạp thay vì xe máy, vừa rẻ vừa ngắm được nhiều.
- Cao lầu ở quán nhỏ trong hẻm ngon hơn nhiều chỗ nổi tiếng 😉`,
    tags: ['HoiAn', 'DuLich'],
    images: [428],
    likes: 19,
    saves: 8,
    comments: [
      { by: 'khanhlinh_eat', text: 'xin tên quán cao lầu trong hẻm 🙏', after: 25, likes: 3 },
      { by: 'thutrang_ly', text: 'Ảnh tường vàng đẹp quá, đúng chất Hội An', after: 70 }
    ]
  },
  {
    key: 'more-huy-podcast',
    by: 'quochuy_dang',
    daysAgo: 22,
    at: '07:40',
    content: `Thói quen mới: nghe podcast kinh doanh trên đường đi học, 25 phút mỗi chiều. Một tháng được khoảng 15 tập, bằng mấy cuốn sách.

Đang nghe lại các tập về những công ty thất bại. Học từ cái sai của người khác rẻ hơn nhiều so với tự mình sai 😅`,
    tags: ['Podcast', 'TuHoc', 'KinhDoanh'],
    likes: 11,
    comments: [
      {
        by: 'khanhvy_mkt',
        text: 'Recommend vài tập đi Huy',
        after: 40,
        replies: [{ by: 'quochuy_dang', text: 'Mình hay nghe "How I Built This", có nhiều tập về founder thất bại rồi làm lại', after: 15 }]
      }
    ]
  },
  {
    key: 'more-vy-ad-review',
    by: 'khanhvy_mkt',
    daysAgo: 17,
    at: '22:00',
    content: `Dân marketing đi siêu thị: 5 phút chọn đồ, 25 phút đứng đọc bao bì và thầm chấm điểm thiết kế 🛒

Hôm nay thấy một hãng mì đổi bao bì mà mình không nhận ra luôn. Hiểu ngay cái case study cô Hà cho làm tuần trước 😂`,
    tags: ['Marketing', 'Branding'],
    likes: 13,
    comments: [{ by: 'nguyenthuha', text: 'Đây là lúc lý thuyết gặp thực tế đó em 😄', after: 90, likes: 5 }]
  },
  {
    key: 'more-anh-flashcard',
    by: 'ngocanh_med',
    daysAgo: 3,
    at: '06:30',
    content: `6h30 sáng, 120 thẻ Anki dược lý đã xong ✅ Còn 3 tuần nữa thi, đều đặn mỗi sáng thì chắc ổn.

Ai học Y mà buổi sáng không ôn được thì thử ôn trong lúc chờ xe buýt, 15 phút cũng được 40 thẻ.`,
    tags: ['Anki', 'DuocLy', 'OnThi'],
    course: 'FMS102',
    images: [691],
    likes: 12,
    comments: [{ by: 'thao_ielts', text: 'Kỷ luật dễ sợ. Mình 6h30 vẫn đang ngủ 😅', after: 60 }]
  },
  {
    key: 'more-bao-ev-visit',
    by: 'giabao_runs',
    daysAgo: 12,
    at: '17:20',
    title: 'Đi tham quan nhà máy lắp ráp xe điện với lớp FAE102',
    content: `Hôm nay lớp được đi thực tế nhà máy lắp ráp. Ấn tượng nhất:

- Robot hàn thân xe chạy đều tăm tắp, cả xưởng hàn gần như không có người.
- Pin được kiểm tra từng module trước khi lắp, có cả buồng thử nhiệt độ.
- Các anh kỹ sư nói phần khó nhất không phải lắp ráp mà là **phần mềm quản lý pin (BMS)**.

Về nhà thấy muốn học thêm lập trình nhúng hẳn. Ai bên FEE có tài liệu EE202 cho người ngoại đạo thì xin với 🙏`,
    tags: ['XeDien', 'ThucTe', 'FAE102'],
    course: 'FAE102',
    images: [1071],
    likes: 15,
    comments: [
      { by: 'tiendat_ngo', text: 'Có nè, mình gửi slide nhập môn vi điều khiển, đọc dễ hiểu', after: 40, likes: 3 },
      { by: 'lehoangphuc', text: 'BMS đúng là phần mềm "khó nhằn" nhất trên xe điện. Học nhúng là hướng rất đáng đầu tư', after: 120 }
    ]
  },
  {
    key: 'more-tuan-darkmode',
    by: 'minhtuan_dev',
    daysAgo: 19,
    at: '00:40',
    content: `Hotfix production lúc 0h40 vì một dấu \`?\` bị thiếu trong optional chaining. Một ký tự, 2 tiếng debug.

Ngày mai mình sẽ viết thêm test. Chắc chắn. Lần này thật đấy.`,
    tags: ['Debug', 'DevLife'],
    images: [445],
    likes: 16,
    comments: [
      { by: 'minhquan_gg', text: '"Lần này thật đấy", câu nói nổi tiếng thứ 2 sau "trên máy em chạy mà"', after: 15, likes: 9 },
      { by: 'lehoangphuc', text: 'Thêm strict null check trong tsconfig là đỡ cả đống mấy lỗi này', after: 60, likes: 4 }
    ]
  },
  {
    key: 'more-quan-anime',
    by: 'minhquan_gg',
    daysAgo: 10,
    at: '23:30',
    content: `Mùa anime mới có 3 bộ hay, mà tuần sau thi giữa kỳ. Ai đó cho mình xin chút ý chí với 😭`,
    tags: ['Anime', 'MuaThi'],
    likes: 10,
    comments: [
      { by: 'thuydung05', text: 'xem 1 tập thưởng sau mỗi chương ôn xong, mình làm vậy với K-drama', after: 20, likes: 5 },
      { by: 'phamduclong', text: 'Thi xong anime vẫn ở đó, điểm thì không quay lại được đâu 😌', after: 45, likes: 8 }
    ]
  },
  {
    key: 'more-dung-korean',
    by: 'thuydung05',
    daysAgo: 23,
    at: '13:15',
    type: 'resource_share',
    title: 'Học tiếng Hàn từ con số 0: lộ trình 3 tháng đầu mình đã đi',
    content: `Nghiêm túc 1 bài nha mọi người 😆

**Tháng 1:** bảng chữ cái Hangul (1 tuần là thuộc), phát âm, 300 từ vựng cơ bản bằng Anki.
**Tháng 2:** ngữ pháp sơ cấp 1: đuôi câu 요/습니다, trợ từ 은/는/이/가. Nghe podcast cho người mới mỗi ngày 10 phút.
**Tháng 3:** viết nhật ký 3 câu mỗi ngày, nhờ bạn Hàn hoặc giáo viên sửa.

Đừng xem phim không phụ đề ngay từ đầu, nản lắm 😭 Xem phụ đề song ngữ, dừng lại chép câu hay.`,
    tags: ['TiengHan', 'TuHoc', 'LoTrinh'],
    images: [367],
    likes: 13,
    saves: 10,
    comments: [
      { by: 'thao_ielts', text: 'Viết nhật ký 3 câu mỗi ngày là cách mình dùng cho tiếng Anh hồi đầu luôn, hiệu quả lắm', after: 40 },
      { by: 'vannam2k8', text: 'Chị Dung nghiêm túc thì đáng nể ghê 😳', after: 90, likes: 6 }
    ]
  },
  {
    key: 'more-dat-midnight-walk',
    by: 'tiendat_ngo',
    daysAgo: 14,
    at: '23:50',
    content: `đi bộ quanh khu ký túc lúc gần nửa đêm. yên tĩnh, mát, chỉ có tiếng xe lác đác. mấy lúc thế này thấy đầu óc nhẹ hẳn.`,
    tags: ['DemKhuya'],
    images: [195],
    likes: 12,
    comments: [{ by: 'anhthu_phan', text: 'ảnh có màu đèn vàng đẹp ghê', after: 30 }]
  },
  {
    key: 'more-trang-excel',
    by: 'thutrang_ly',
    daysAgo: 20,
    at: '21:30',
    type: 'resource_share',
    title: '10 hàm Excel dân kinh tế dùng hằng ngày (kèm ví dụ)',
    content: `Tổng hợp cho các bạn FBA năm 1–2:

1. \`XLOOKUP\` – tìm kiếm, thay cho VLOOKUP (không bị lệch cột)
2. \`SUMIFS\` – tổng có nhiều điều kiện
3. \`COUNTIFS\` – đếm có điều kiện
4. \`IFERROR\` – bọc công thức để không hiện #N/A xấu xí
5. \`TEXT\` – định dạng ngày, số tiền
6. \`EOMONTH\` – ngày cuối tháng, hay dùng khi làm báo cáo
7. \`UNIQUE\` + \`SORT\` – lọc danh sách không trùng
8. \`PMT\` – tính tiền trả góp mỗi kỳ
9. \`NPV\` / \`IRR\` – thẩm định dự án (FBA102 thi chắc chắn có)
10. **PivotTable** – không phải hàm nhưng biết là được cộng điểm phỏng vấn

Ai cần file bài tập mẫu thì comment, mình gửi link Drive.`,
    tags: ['Excel', 'TaiChinh', 'FBA102'],
    course: 'FBA102',
    images: [370],
    likes: 17,
    saves: 16,
    comments: [
      { by: 'khanhvy_mkt', text: 'XLOOKUP đổi đời thật sự, cho mình xin file nhé', after: 25 },
      { by: 'quochuy_dang', text: 'PivotTable + IRR là 2 thứ mình bị hỏi khi phỏng vấn thực tập luôn', after: 80, likes: 4 }
    ]
  },
  {
    key: 'more-linh-strawberry',
    by: 'khanhlinh_eat',
    daysAgo: 21,
    at: '15:30',
    content: `Phát hiện tiệm sữa chua dâu tằm mới mở gần cổng phụ, 25k một cốc to 🍓 Chua chua ngọt ngọt, ăn sau giờ thể dục là hết sảy.`,
    tags: ['AnVat', 'ReviewQuan'],
    images: [1080],
    likes: 14,
    comments: [
      { by: 'thuydung05', text: 'chiều nay đi luôn, ai đi chung không', after: 10, likes: 3 },
      { by: 'giabao_runs', text: 'sau buổi chạy sáng mai ghé thử', after: 50 }
    ]
  },
  {
    key: 'more-long-office-hours',
    by: 'phamduclong',
    daysAgo: 9,
    at: '17:00',
    type: 'announcement',
    title: 'IT101 – Buổi hỗ trợ thêm tối thứ 4 (online)',
    content: `Mấy tuần nay nhiều bạn hỏi về cây nhị phân tìm kiếm và đệ quy, nên mình mở thêm buổi hỗ trợ:

🕗 20h–21h30 tối thứ 4, online qua Google Meet (link mình gửi trong nhóm lớp)
📌 Nội dung: chèn/xóa trên BST, duyệt cây, các lỗi con trỏ hay gặp

Ai có câu hỏi trước thì đăng lên đây, gắn #IT101 để mình gom lại.`,
    tags: ['IT101', 'HoTro', 'BST'],
    course: 'IT101',
    community: 'fit',
    likes: 12,
    comments: [
      {
        by: 'vannam2k8',
        text: 'Em hỏi trước: xóa nút có 2 con thì sao lại lấy nút nhỏ nhất bên phải ạ?',
        after: 30,
        replies: [
          {
            by: 'phamduclong',
            text: 'Vì nút đó lớn hơn mọi nút bên trái và nhỏ hơn mọi nút còn lại bên phải, thay vào vẫn giữ đúng tính chất BST. Tối thứ 4 mình vẽ hình giải thích kỹ nhé.',
            after: 25,
            likes: 4
          }
        ]
      }
    ]
  },
  {
    key: 'more-phuc-coffee',
    by: 'lehoangphuc',
    daysAgo: 30,
    at: '08:10',
    content: `Sáng thứ Bảy, 1 ly cà phê, đọc lại đống feedback mọi người gửi tuần này. Có 47 góp ý, sửa xong 31, còn 16 đang xếp hàng. Cảm ơn mọi người đã chịu khó báo lỗi ☕`,
    tags: ['BehindTheScenes'],
    images: [425],
    likes: 15,
    comments: [
      { by: 'tranngocdiep', text: 'Anh nhớ nghỉ cuối tuần nữa nha 😄', after: 45, likes: 4 },
      { by: 'haiyen_ux', text: '16 cái còn lại có cái của em không ạ 👀', after: 70, replies: [{ by: 'lehoangphuc', text: 'Có, tuần sau xong 😁', after: 10 }] }
    ]
  },
  {
    key: 'more-nam-question-laptop',
    by: 'vannam2k8',
    daysAgo: 30,
    at: '21:15',
    type: 'question',
    title: 'Sinh viên IT năm nhất nên mua laptop Windows hay MacBook ạ?',
    content: `Em có khoảng 18 triệu, học CNTT. Em phân vân giữa laptop Windows cấu hình mạnh và MacBook Air M-series cũ. Em có chơi game nhẹ. Mong anh chị cho lời khuyên ạ 🙏`,
    tags: ['Laptop', 'TanSinhVien', 'HoiDap'],
    community: 'fit',
    resolved: true,
    likes: 9,
    comments: [
      {
        by: 'minhquan_gg',
        solution: true,
        after: 20,
        likes: 7,
        text: `Em có chơi game + 18 triệu thì mình nghiêng về **Windows**: RAM 16GB, SSD 512GB, màn tốt, card rời tầm trung.

MacBook rất tốt cho lập trình web/mobile (pin trâu, màn đẹp), nhưng game ít và một số môn dùng phần mềm chỉ có trên Windows (mô phỏng mạch, vài công cụ CAD).

Mua thì ưu tiên: **RAM ≥ 16GB > SSD > CPU > card màn hình**.`
      },
      { by: 'minhtuan_dev', text: 'Mình dùng Mac code web thì rất sướng, nhưng đúng là chơi game thì nên Windows', after: 60 },
      { by: 'vannam2k8', text: 'Em cảm ơn anh, em chốt Windows ạ!', after: 15 }
    ]
  },
  {
    key: 'more-thao-speaking-club',
    by: 'thao_ielts',
    daysAgo: 4,
    at: '19:00',
    title: 'English Speaking Club mở lại tối thứ 6 hằng tuần 🗣️',
    content: `Sau kỳ nghỉ, CLB nói tiếng Anh mở lại rồi:

- 19h–20h30 tối thứ 6, phòng sinh hoạt tầng 1 thư viện
- Mỗi tuần 1 chủ đề, tuần này: *"Should university attendance be mandatory?"*
- Không cần giỏi, chỉ cần dám nói. Sai thì cả nhóm cùng sửa vui vẻ

Ai đi lần đầu cứ đến, không cần đăng ký 😊`,
    tags: ['TiengAnh', 'CLB', 'Speaking'],
    community: 'clb-hoat-dong',
    images: [192],
    likes: 13,
    comments: [
      { by: 'ngocanh_med', text: 'Chủ đề tuần này hợp với dân Y quá, tụi mình học 7h sáng mỗi ngày 😭', after: 40, likes: 4 },
      {
        by: 'vannam2k8',
        text: 'Em nói tiếng Anh dở lắm có đi được không chị',
        after: 60,
        replies: [{ by: 'thao_ielts', text: 'Được chứ! CLB lập ra cho mấy bạn như em mà 😊', after: 10 }]
      }
    ]
  },
  {
    key: 'more-ha-feedback',
    by: 'nguyenthuha',
    daysAgo: 6,
    at: '21:45',
    content: `Chấm xong 42 bài tiểu luận, cô thấy các em tiến bộ rõ ở phần phân tích insight. Có 3 bài trích dẫn số liệu khảo sát tự làm, rất đáng khen 👏

Điểm trừ chung: nhiều bài kết luận quá chung chung. Kết luận nên trả lời: **vậy brand nên làm gì vào thứ Hai tới?**`,
    tags: ['FBA101', 'NhanXet'],
    course: 'FBA101',
    likes: 14,
    comments: [{ by: 'khanhvy_mkt', text: '"Vậy brand nên làm gì vào thứ Hai tới", câu này cô nói hoài mà tụi em vẫn quên 😅', after: 60, likes: 5 }]
  },
  {
    key: 'more-ducanh-defense',
    by: 'ducanh_ai',
    daysAgo: 0,
    at: '16:40',
    content: `Vừa bảo vệ đề cương khóa luận xong, hội đồng góp ý nhiều nhưng qua rồi 🎉 Cảm ơn thầy Quang với mọi người đã góp ý cho mấy bài RAG trước đây, nhiều câu hội đồng hỏi trùng y chang 😂`,
    tags: ['KhoaLuan', 'RAG'],
    images: [1067],
    likes: 18,
    comments: [
      { by: 'dovanquang', text: 'Chúc mừng em. Giờ là phần khó nhất: làm đúng những gì đã hứa trong đề cương 😄', after: 30, likes: 8 },
      { by: 'minhtuan_dev', text: 'Congrats ông! Tối nay đi ăn mừng 🍻', after: 15, likes: 3 },
      { by: 'thuydung05', text: 'không hiểu RAG là gì nhưng chúc mừng nha 🎉', after: 45, likes: 6 }
    ]
  },
  {
    key: 'more-dung-weather',
    by: 'thuydung05',
    daysAgo: 1,
    at: '07:15',
    content: `Hà Nội sáng nay 19 độ, gió nhẹ, trời hơi se lạnh. Thời tiết hoàn hảo để… nằm trong chăn và nghỉ học tiết 1 🥲 (đùa thôi, đang trên đường đi rồi)`,
    tags: ['HaNoi', 'MuaThu'],
    likes: 15,
    comments: [
      { by: 'giabao_runs', text: 'thời tiết hoàn hảo để chạy bộ mới đúng 🏃', after: 20, likes: 3 },
      { by: 'tiendat_ngo', text: 'tôi đã chọn phương án 1', after: 35, likes: 9 }
    ]
  },
  {
    key: 'more-huy-pitch',
    by: 'quochuy_dang',
    daysAgo: 26,
    at: '22:30',
    title: 'Đi thi pitching lần đầu: 3 phút trên sân khấu dài như 3 tiếng',
    content: `Hôm nay team mình pitch ở vòng sơ loại cuộc thi khởi nghiệp sinh viên. Không vào chung kết, nhưng học được nhiều:

- Giám khảo không hỏi về công nghệ, họ hỏi **"ai trả tiền và vì sao?"**
- Slide 12 trang là quá nhiều cho 3 phút. Đội thắng chỉ có 6 slide.
- Câu chuyện mở đầu quan trọng hơn bảng số liệu.

Tháng sau có cuộc thi khác, lần này chuẩn bị kỹ hơn 💪`,
    tags: ['Pitching', 'KhoiNghiep'],
    images: [452],
    likes: 15,
    comments: [
      {
        by: 'nguyenthuha',
        text: 'Câu hỏi "ai trả tiền và vì sao" là câu hỏi quan trọng nhất của mọi mô hình kinh doanh. Cô tin lần sau team sẽ làm tốt hơn.',
        after: 120,
        likes: 6
      },
      { by: 'khanhvy_mkt', text: 'Cần người làm slide gọn 6 trang thì gọi mình nhé 😎', after: 50 }
    ]
  }
]
