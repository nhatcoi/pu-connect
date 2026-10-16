import type { SeedPost } from '../types'

// Công nghệ: frontend, AI, phần cứng, nghề lập trình
export const TECH_POSTS: SeedPost[] = [
  {
    key: 'tech-tuan-intern-lessons',
    by: 'minhtuan_dev',
    daysAgo: 4,
    at: '22:10',
    title: '3 tháng intern frontend: những thứ trường không dạy (mà mình ước biết sớm hơn)',
    content: `Hôm nay hết 3 tháng thực tập ở một startup fintech, viết lại vài điều cho mấy bạn năm 2–3 đang chuẩn bị đi intern:

**1. Đọc code nhiều hơn viết code.** Tuần đầu mình gần như không được merge dòng nào. Mentor bảo đọc hết luồng thanh toán rồi vẽ lại bằng sơ đồ. Lúc đầu thấy phí thời gian, sau mới hiểu: không hiểu hệ thống thì sửa 1 dòng hỏng 3 chỗ.

**2. Pull request nhỏ thôi.** PR đầu tiên của mình 1.200 dòng, review mất 4 ngày và bị comment 37 cái 🥲 Giờ mỗi PR dưới 300 dòng, có mô tả "vì sao" chứ không chỉ "làm gì".

**3. Hiệu năng là chuyện của người dùng thật.** Trên máy mình (M2, wifi công ty) mọi thứ đều nhanh. Bật chế độ *Slow 4G + CPU 4x slowdown* trong DevTools mới thấy trang danh sách giao dịch giật như slide. Fix bằng virtual list + bỏ bớt re-render là mượt hẳn.

**4. Hỏi đúng cách.** Trước khi hỏi: mình đã thử gì, kết quả ra sao, mình nghĩ lỗi ở đâu. Hỏi kiểu này mentor trả lời nhanh gấp đôi.

**5. Viết test cho phần tính tiền.** Không bàn cãi. Sai 1 đồng là ticket từ CS bay về ngay.

Tài liệu mình thấy đáng đọc nhất trong thời gian intern: https://react.dev/learn (đặc biệt phần *You Might Not Need an Effect*). Đọc xong bỏ được cả tá useEffect thừa.

Ai đang tìm chỗ intern frontend cứ hỏi, biết gì mình chia sẻ hết.`,
    tags: ['Intern', 'Frontend', 'React', 'KinhNghiem'],
    course: 'IT102',
    community: 'fit',
    images: [3, 532],
    likes: 19,
    saves: 11,
    comments: [
      {
        by: 'vannam2k8',
        text: 'Anh ơi năm nhất thì nên học gì trước để năm 3 đi intern được ạ? Em mới biết C++ cơ bản 🥲',
        after: 20,
        replies: [
          {
            by: 'minhtuan_dev',
            text: 'Năm nhất cứ học chắc C++ với cấu trúc dữ liệu đã em. Hè năm nhất học HTML/CSS/JS, năm 2 lên React. Đừng vội, nền tốt thì học framework nhanh lắm.',
            after: 18,
            likes: 6
          }
        ]
      },
      {
        by: 'haiyen_ux',
        text: 'Ý số 3 đúng quá. Design trên Figma đẹp lung linh, lên máy thật của user Android 3 triệu là thấy khác liền 😂',
        after: 55,
        likes: 4
      },
      { by: 'phamduclong', text: 'PR 1.200 dòng thì đúng là tội reviewer thật 😆 Bài hay, mình share cho lớp IT102.', after: 90 },
      { by: 'quochuy_dang', text: 'Chỗ team mình đang cần 1 bạn intern FE part-time, inbox mình nha ai quan tâm', after: 140 }
    ]
  },
  {
    key: 'tech-ducanh-rag-thesis',
    by: 'ducanh_ai',
    daysAgo: 6,
    at: '23:45',
    title: 'Khóa luận RAG tiếng Việt: chunk 512 token hay 256? Mình đã đo và đây là kết quả',
    content: `Cập nhật tiến độ khóa luận cho ai cùng làm mảng này.

Bài toán: hỏi đáp trên ~300 văn bản quy chế, thông báo của trường (PDF scan + docx). Mình thử 3 cách chia đoạn và đo trên 150 câu hỏi tự gán nhãn:

| Cách chia | Recall@5 | Câu trả lời đúng (chấm tay) |
|---|---|---|
| 256 token, không overlap | 0.71 | 62% |
| 512 token, overlap 64 | 0.78 | 69% |
| Theo tiêu đề / điều khoản | **0.86** | **77%** |

Rút ra:
- Văn bản quy chế có cấu trúc "Điều 5. Khoản 2…" rõ ràng, chia theo cấu trúc tốt hơn hẳn chia theo độ dài.
- Kết hợp BM25 + vector (hybrid) cứu được khá nhiều câu hỏi chứa mã môn, số hiệu văn bản mà embedding hay bỏ sót.
- OCR tiếng Việt từ PDF scan là nỗi đau lớn nhất, dấu sai là retrieval sai theo 🥲

Đang thử thêm bước rerank. Ai có kinh nghiệm reranker cho tiếng Việt thì chỉ mình với, cảm ơn nhiều!`,
    tags: ['RAG', 'NLP', 'KhoaLuan', 'LLM'],
    course: 'CS202',
    community: 'do-an-tot-nghiep',
    images: [26],
    likes: 17,
    saves: 13,
    comments: [
      {
        by: 'dovanquang',
        text: 'Kết quả hợp lý. Em nên báo thêm khoảng tin cậy hoặc ít nhất số câu mỗi loại, 150 câu thì chênh 5–7% có thể chưa có ý nghĩa thống kê. Phần phân tích lỗi OCR rất đáng đưa vào luận văn.',
        after: 480,
        likes: 6
      },
      { by: 'ducanh_ai', text: 'Dạ em cảm ơn thầy, em sẽ bootstrap để ra khoảng tin cậy ạ.', after: 30 },
      { by: 'minhtuan_dev', text: 'Đọc không hiểu hết nhưng thấy bảng là thấy xịn rồi 😂', after: 520, likes: 5 }
    ]
  },
  {
    key: 'tech-yen-figma-tips',
    by: 'haiyen_ux',
    daysAgo: 10,
    at: '15:30',
    title: '7 mẹo Figma mình ước biết từ năm nhất',
    content: `Tổng hợp mấy mẹo nhỏ mà tiết kiệm cho mình cả trăm giờ:

1. **Auto Layout mọi thứ.** Button, card, list… cái gì có padding là Auto Layout. Sửa text không phải kéo lại khung nữa.
2. **Variables cho màu & spacing.** Đổi theme sáng/tối bằng 1 cú click.
3. **Component có variant**, đừng copy-paste 6 cái button khác màu.
4. Phím tắt **Shift + A** (Auto Layout), **Ctrl + Alt + K** (tạo component), **Ctrl + D** (nhân bản).
5. Dùng plugin *Contrast* để check độ tương phản chữ, đừng tin mắt mình lúc 2h sáng.
6. Đặt tên layer tử tế. Dev nhìn file của bạn sẽ biết ơn lắm.
7. Xem design của người giỏi trên https://www.figma.com/community, mở file ra xem họ dựng layout thế nào.

Font tiếng Việt đẹp + miễn phí: lọc "Vietnamese" trên https://fonts.google.com, mình hay dùng Be Vietnam Pro với Inter.`,
    tags: ['Figma', 'UIUX', 'Design', 'Tips'],
    images: [534, 20],
    likes: 15,
    saves: 14,
    comments: [
      { by: 'minhtuan_dev', text: 'Số 6 xin được in đậm gạch chân 🙏 Mở file toàn "Frame 1234", "Rectangle 88"', after: 22, likes: 8 },
      { by: 'thuydung05', text: 'mình không học design mà đọc xong cũng muốn tải Figma về vẽ thử', after: 70 },
      { by: 'haiyen_ux', text: '@thuydung05 tải đi, bản free đủ dùng luôn á', after: 10 }
    ]
  },
  {
    key: 'tech-quan-pc-build',
    by: 'minhquan_gg',
    daysAgo: 8,
    at: '20:50',
    title: 'Build PC 15 triệu cho sinh viên IT vừa học vừa chơi game (tháng 10)',
    content: `Mấy hôm nay nhiều bạn hỏi nên mình chốt 1 cấu hình "vừa code vừa game" tầm 15 triệu:

- CPU: Ryzen 5 7500F
- Main: B650M
- RAM: 32GB DDR5 (2×16) → chạy Docker + Chrome 40 tab + game không lo
- VGA: RTX 4060 8GB
- SSD: 1TB NVMe Gen4
- PSU: 650W 80+ Bronze (đừng tiết kiệm PSU, thật đấy)
- Case: loại nào thoáng gió là được

Giá dao động tùy thời điểm, cứ so 2–3 cửa hàng. Mấy lưu ý:
- Học AI/ML nặng thì cân nhắc VGA nhiều VRAM hơn, hoặc dùng Colab/Kaggle cho đỡ.
- Laptop vẫn tiện hơn nếu bạn hay lên thư viện. PC hợp với người ở trọ cố định.
- RAM 16GB giờ hơi chật nếu vừa code vừa mở IDE nặng.

Ai cần mình build hộ thì cứ inbox, lấy công tượng trưng 1 ly trà sữa 😎`,
    tags: ['BuildPC', 'PhanCung', 'Gaming'],
    images: [96, 366],
    likes: 13,
    saves: 7,
    comments: [
      {
        by: 'vannam2k8',
        text: 'Anh ơi 10 triệu thì nên bỏ bớt gì ạ 🥹',
        after: 15,
        replies: [
          {
            by: 'minhquan_gg',
            text: 'Hạ xuống RAM 16GB + SSD 512GB, VGA lấy cũ đời trước. Còn không thì laptop cũ ThinkPad + học trên Colab cũng ổn em.',
            after: 25
          }
        ]
      },
      { by: 'tiendat_ngo', text: 'PSU 650W cho 4060 thì hơi dư nhưng an tâm, đồng ý với ông', after: 60 },
      { by: 'giabao_runs', text: 'Nhận 1 ly trà sữa là thấy hời cho người thuê rồi 😂', after: 110, likes: 3 }
    ]
  },
  {
    key: 'tech-tuan-nextjs-question',
    by: 'minhtuan_dev',
    daysAgo: 15,
    at: '01:20',
    type: 'question',
    title: 'Next.js App Router: vì sao fetch trong Server Component bị cache dù đã đổi dữ liệu?',
    content: `Mình có trang danh sách sản phẩm, dữ liệu lấy bằng \`fetch\` trong Server Component. Cập nhật DB rồi mà reload trang vẫn ra dữ liệu cũ, phải build lại mới đổi.

\`\`\`ts
export default async function Page() {
  const res = await fetch('https://api.example.com/products')
  const products = await res.json()
  return <ProductList items={products} />
}
\`\`\`

Đọc docs thấy nói về caching nhưng vẫn rối. Mình muốn dữ liệu luôn mới mỗi lần vào trang thì nên làm thế nào cho đúng ạ?`,
    tags: ['NextJS', 'Caching', 'HoiDap'],
    course: 'IT102',
    community: 'fit',
    resolved: true,
    likes: 9,
    saves: 5,
    comments: [
      {
        by: 'lehoangphuc',
        solution: true,
        after: 35,
        likes: 7,
        text: `Trang của bạn đang được render tĩnh lúc build nên mới giữ dữ liệu cũ. Có 2 cách tùy nhu cầu:

\`\`\`ts
// Luôn lấy mới mỗi request
const res = await fetch(url, { cache: 'no-store' })

// Hoặc làm mới định kỳ, VD mỗi 60 giây
const res = await fetch(url, { next: { revalidate: 60 } })
\`\`\`

Nếu dữ liệu đổi khi có thao tác (VD admin sửa sản phẩm) thì gọi \`revalidatePath('/products')\` trong Server Action là đẹp nhất. Docs phần này: https://nextjs.org/docs/app/building-your-application/caching`
      },
      { by: 'minhtuan_dev', text: 'Chạy rồi anh ơi, dùng revalidatePath đúng ý luôn. Cảm ơn anh nhiều 🙏', after: 20 }
    ]
  },
  {
    key: 'tech-ducanh-paper-weekly',
    by: 'ducanh_ai',
    daysAgo: 20,
    at: '21:00',
    title: 'Đọc paper mỗi tuần: mình bắt đầu thế nào khi tiếng Anh chưa giỏi',
    content: `Mấy bạn năm 2 hỏi mình cách đọc paper, chia sẻ quy trình của mình:

1. **Đọc theo thứ tự:** Abstract → hình vẽ & bảng kết quả → Conclusion. Thấy hay mới đọc Method.
2. **Ghi 5 dòng:** bài toán gì, ý tưởng chính, so với cái gì, kết quả, điểm yếu.
3. **Không hiểu thuật ngữ thì hỏi PU AI hoặc tra**, đừng dịch cả bài, rất tốn thời gian.
4. **Đọc code nếu có.** Nhiều khi đọc code 30 phút hiểu hơn đọc Method 2 tiếng.

Mình hay lấy paper từ arXiv rồi nghe giải thích trên kênh Yannic Kilcher. Người mới nên bắt đầu với các bài kinh điển như *Attention Is All You Need*, đọc chậm thôi.

Ai muốn lập nhóm đọc paper mỗi tối thứ 5 thì comment, đủ 5 người mình tạo nhóm chat.`,
    tags: ['AI', 'Paper', 'TuHoc'],
    course: 'CS201',
    images: [24],
    likes: 14,
    saves: 10,
    comments: [
      { by: 'phamduclong', text: 'Cho mình 1 slot nhé', after: 12 },
      {
        by: 'ngocanh_med',
        text: 'Bên Y cũng đọc paper kiểu này, bước 2 "ghi 5 dòng" cực kỳ hiệu quả. Cho mình tham gia ké được không 😆',
        after: 45,
        replies: [{ by: 'ducanh_ai', text: 'Được chứ! Góc nhìn khác ngành càng vui', after: 8 }]
      },
      { by: 'vannam2k8', text: 'Em xin 1 vé dự thính ạ', after: 80 }
    ]
  },
  {
    key: 'tech-phuc-docker-tip',
    by: 'lehoangphuc',
    daysAgo: 25,
    at: '22:30',
    type: 'resource_share',
    title: 'Docker cho đồ án: file compose tối thiểu chạy Postgres + Redis + app',
    content: `Nhiều nhóm đồ án vẫn cài Postgres thẳng lên máy rồi "trên máy em chạy mà" 😄 Đây là file compose mình hay dùng, copy về sửa tên là chạy:

\`\`\`yaml
services:
  db:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: app
    ports: ["5432:5432"]
    volumes: [db:/var/lib/postgresql/data]
  redis:
    image: redis:7
    ports: ["6379:6379"]
volumes:
  db:
\`\`\`

\`docker compose up -d\` là xong, cả nhóm cùng 1 môi trường. Đừng commit mật khẩu thật lên GitHub nhé, dùng file \`.env\` và thêm vào \`.gitignore\`.

Học Docker bài bản: https://docs.docker.com/get-started/`,
    tags: ['Docker', 'DevOps', 'DoAn'],
    course: 'IT106',
    community: 'do-an-tot-nghiep',
    likes: 12,
    saves: 12,
    comments: [
      { by: 'minhquan_gg', text: 'Thêm healthcheck cho db nữa là chuẩn bài anh ơi, app hay khởi động trước khi Postgres sẵn sàng', after: 40, likes: 3 },
      { by: 'lehoangphuc', text: '@minhquan_gg chuẩn, mà để bản tối thiểu cho các bạn mới đỡ rối 😄', after: 25 }
    ]
  },
  {
    key: 'tech-yen-portfolio-review',
    by: 'haiyen_ux',
    daysAgo: 3,
    at: '19:40',
    title: 'Xin review portfolio UI/UX đầu tay 🙏',
    content: `Mình làm xong case study đầu tiên: thiết kế lại luồng đăng ký học phần cho sinh viên (vì ai cũng ghét cái cũ 😅).

Quy trình: phỏng vấn 8 bạn → gom pain point → wireframe → test với 5 bạn → chỉnh → hi-fi.

Kết quả test: thời gian tìm và đăng ký 1 lớp giảm từ ~3 phút xuống ~1 phút 10 giây.

Mọi người góp ý giúp mình phần trình bày case study với ạ, nhất là mấy anh chị đã đi làm. Chê thẳng tay cũng được, mình chịu được 💪`,
    tags: ['UIUX', 'Portfolio', 'CaseStudy'],
    images: [529, 1, 445],
    likes: 16,
    comments: [
      {
        by: 'nguyenthuha',
        text: 'Phần đo thời gian trước/sau rất tốt. Em nên thêm 1–2 câu trích dẫn thật từ người được phỏng vấn, người đọc sẽ tin hơn nhiều.',
        after: 120,
        likes: 5
      },
      { by: 'minhtuan_dev', text: 'Ảnh mockup đẹp. Nếu thêm phần "những gì mình bỏ đi và vì sao" thì nhìn rất senior', after: 60, likes: 4 },
      { by: 'haiyen_ux', text: 'Dạ em cảm ơn cô và anh, em sửa liền 🥹', after: 30 }
    ]
  },
  {
    key: 'tech-quan-linux',
    by: 'minhquan_gg',
    daysAgo: 29,
    at: '23:59',
    content: `cài Arch Linux lần thứ 3 trong tuần. lần này chắc chắn sẽ không phá nữa 🙂`,
    tags: ['Linux'],
    images: [60],
    likes: 11,
    comments: [
      { by: 'minhtuan_dev', text: 'hẹn gặp lại ở lần thứ 4', after: 5, likes: 9 },
      { by: 'lehoangphuc', text: 'nhớ backup /home trước nhé 😄', after: 30 },
      { by: 'minhquan_gg', text: 'update: lần 4 rồi.', after: 1440, likes: 12 }
    ]
  },
  {
    key: 'tech-tuan-tool-list',
    by: 'minhtuan_dev',
    daysAgo: 36,
    at: '21:15',
    type: 'resource_share',
    title: 'Mấy trang web free mà dân IT nên bookmark',
    content: `Để dành mấy trang mình dùng gần như hằng ngày:

- https://roadmap.sh: lộ trình học frontend, backend, DevOps… rất trực quan
- https://visualgo.net/en: xem thuật toán sắp xếp, cây, đồ thị chạy từng bước, học IT101 đỡ khổ hẳn
- https://excalidraw.com: vẽ sơ đồ kiến trúc nhanh, nhìn kiểu vẽ tay rất xinh
- https://regex101.com: test regex, có giải thích từng phần
- https://neetcode.io/roadmap: luyện LeetCode có lộ trình, không bị ngợp

Ai có trang hay thì comment thêm để mình gom thành list nhé 👇`,
    tags: ['Tools', 'TuHoc', 'Bookmark'],
    community: 'fit',
    likes: 18,
    saves: 16,
    comments: [
      { by: 'phamduclong', text: 'Thêm https://cp-algorithms.com cho ai thích thuật toán nhé, giải thích rất kỹ', after: 30, likes: 4 },
      { by: 'haiyen_ux', text: 'Bên design có https://coolors.co để phối màu nha', after: 55 },
      { by: 'ducanh_ai', text: 'https://paperswithcode.com cho dân AI (dù giờ nó chuyển hướng rồi nhưng vẫn hữu ích)', after: 90 }
    ]
  },
  {
    key: 'tech-ducanh-gpu-colab',
    by: 'ducanh_ai',
    daysAgo: 13,
    at: '02:05',
    content: `2h sáng, model train được 87%, Colab báo hết phiên. Cảm xúc lúc này khó diễn tả thành lời.

Bài học: **lưu checkpoint mỗi epoch**. Lặp lại: mỗi epoch.`,
    tags: ['AI', 'Colab', 'DeepLearning'],
    likes: 15,
    comments: [
      { by: 'minhquan_gg', text: 'F cho ông 🫡', after: 8, likes: 3 },
      { by: 'dovanquang', text: 'Bài học đắt giá nhất của mọi nghiên cứu sinh 😄', after: 400, likes: 7 }
    ]
  },
  {
    key: 'tech-dat-arduino',
    by: 'tiendat_ngo',
    daysAgo: 18,
    at: '17:45',
    title: 'Làm cái đèn báo phòng trọ có người bằng Arduino, tốn đúng 120k',
    content: `Phòng trọ 3 đứa, hay xông vào lúc bạn đang học online 😅 Nên mình làm cái đèn ngoài cửa: bên trong bấm nút là đèn đỏ sáng = đang bận.

Linh kiện:
- Arduino Nano (clone): 65k
- LED đỏ + điện trở: 5k
- Nút bấm + dây: 15k
- Hộp nhựa + băng dính 2 mặt: 35k

Code chưa tới 30 dòng. Tuần sau định nâng cấp bằng ESP32 để bấm từ điện thoại. Có ai làm IoT EE202 rồi chỉ mình cách cho nó đỡ tốn pin không 🙏`,
    tags: ['Arduino', 'IoT', 'DIY'],
    course: 'EE202',
    images: [36],
    likes: 13,
    comments: [
      { by: 'giabao_runs', text: 'Ý tưởng hay vãi, phòng mình cần gấp', after: 30 },
      { by: 'lehoangphuc', text: 'ESP32 dùng deep sleep, chỉ wake khi có lệnh, pin sạc dự phòng dùng cả tuần nhé', after: 90, likes: 4 },
      { by: 'thuydung05', text: 'đèn xanh = đang ăn mì thì vào được không 😂', after: 140, likes: 8 }
    ]
  },
  {
    key: 'tech-tuan-ai-fear',
    by: 'minhtuan_dev',
    daysAgo: 23,
    at: '23:05',
    title: 'Có nên sợ AI thay thế lập trình viên junior?',
    content: `Câu này mình bị hỏi nhiều quá nên viết luôn quan điểm cá nhân.

Ở chỗ mình intern, AI giúp viết code nhanh hơn thật, nhất là mấy đoạn lặp lại. Nhưng những việc tốn thời gian nhất lại không phải gõ code:
- Hiểu yêu cầu đang mơ hồ
- Đọc hệ thống cũ, đoán vì sao người trước viết vậy
- Debug lỗi chỉ xảy ra trên máy khách hàng
- Thuyết phục team đổi một quyết định kỹ thuật

Junior dùng AI giỏi + nền tảng vững vẫn rất có giá. Junior chỉ biết copy từ AI mà không hiểu thì khó thật.

Còn mọi người nghĩ sao?`,
    tags: ['AI', 'NgheNghiep', 'ThaoLuan'],
    community: 'fit',
    likes: 17,
    comments: [
      {
        by: 'ducanh_ai',
        text: 'Đồng ý. Mô hình viết code đúng 80% nhưng 20% sai mới là phần nguy hiểm, mà không có nền thì không biết nó sai.',
        after: 25,
        likes: 6
      },
      {
        by: 'quochuy_dang',
        text: 'Từ phía người tuyển: mình hỏi ứng viên giải thích code họ nộp. Ai trả lời được thì AI hay không không quan trọng.',
        after: 50,
        likes: 8
      },
      { by: 'vannam2k8', text: 'Đọc xong yên tâm học tiếp C++ 😌', after: 160 }
    ]
  }
]
