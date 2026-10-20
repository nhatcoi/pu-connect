import { logger } from './logger.mjs'

// Kho ảnh chất lượng cao theo chủ đề phục vụ đăng bài
export const IMAGE_SETS = {
  tech: [
    'https://images.unsplash.com/photo-1555066931-4365d14bab8c?w=1000&auto=format&fit=crop&q=80', // code editor
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=1000&auto=format&fit=crop&q=80', // coding laptop
    'https://images.unsplash.com/photo-1498050108023-c5249f4df085?w=1000&auto=format&fit=crop&q=80', // desk setup
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1000&auto=format&fit=crop&q=80', // matrix screen
    'https://images.unsplash.com/photo-1550751827-4bd374c3f58b?w=1000&auto=format&fit=crop&q=80', // cyber tech
    'https://images.unsplash.com/photo-1515879218367-8466d910aaa4?w=1000&auto=format&fit=crop&q=80'  // python code
  ],
  study: [
    'https://images.unsplash.com/photo-1521587760476-6c12a4b040da?w=1000&auto=format&fit=crop&q=80', // library aisle
    'https://images.unsplash.com/photo-1523240795612-9a054b0db644?w=1000&auto=format&fit=crop&q=80', // study group
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=1000&auto=format&fit=crop&q=80', // study desk
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1000&auto=format&fit=crop&q=80', // books stack
    'https://images.unsplash.com/photo-1456513080510-7bf3a84b82f8?w=1000&auto=format&fit=crop&q=80'  // studying with coffee
  ],
  campus: [
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=1000&auto=format&fit=crop&q=80', // modern campus
    'https://images.unsplash.com/photo-1562774053-701939374585?w=1000&auto=format&fit=crop&q=80', // university building
    'https://images.unsplash.com/photo-1525921429624-479b6a26d84d?w=1000&auto=format&fit=crop&q=80', // campus courtyard
    'https://images.unsplash.com/photo-1592280771190-3e2e4d571952?w=1000&auto=format&fit=crop&q=80'  // college building
  ],
  coffee: [
    'https://images.unsplash.com/photo-1501339847302-ac426a4a7cbb?w=1000&auto=format&fit=crop&q=80', // cafe cup
    'https://images.unsplash.com/photo-1554118811-1e0d58224f24?w=1000&auto=format&fit=crop&q=80', // cafe table laptop
    'https://images.unsplash.com/photo-1517256673644-36ad11246d21?w=1000&auto=format&fit=crop&q=80', // coffee shop talk
    'https://images.unsplash.com/photo-1514432324607-a09d9b4aefdd?w=1000&auto=format&fit=crop&q=80'  // warm latte
  ],
  business: [
    'https://images.unsplash.com/photo-1552664730-d307ca884978?w=1000&auto=format&fit=crop&q=80', // teamwork workshop
    'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=1000&auto=format&fit=crop&q=80', // charts analytics
    'https://images.unsplash.com/photo-1551836022-d5d88e9218df?w=1000&auto=format&fit=crop&q=80', // business meeting
    'https://images.unsplash.com/photo-1531403009284-440f080d1e12?w=1000&auto=format&fit=crop&q=80'  // wireframing ui
  ],
  ai: [
    'https://images.unsplash.com/photo-1677442136019-21780efad99a?w=1000&auto=format&fit=crop&q=80', // AI concept
    'https://images.unsplash.com/photo-1618005182384-a83a8bd57fbe?w=1000&auto=format&fit=crop&q=80', // AI visual neural
    'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=1000&auto=format&fit=crop&q=80'  // laboratory science
  ]
}

export function pickRandomImages(category = 'tech', count = 1) {
  const pool = IMAGE_SETS[category] || IMAGE_SETS.tech
  const shuffled = [...pool].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, Math.min(count, pool.length))
}

// Ngân hàng kịch bản mẫu phong phú, định dạng Markdown và có hình ảnh
const TEMPLATE_POSTS = {
  FIT: [
    {
      title: 'Kinh nghiệm xử lý Docker container ngốn 95% RAM trên macOS / WSL2',
      content: `Hôm nay ngồi build dự án NestJS + Next.js 15 trên Docker thì thấy máy nóng ran, RAM vọt lên 90%. Chia sẻ cho anh em FIT vài tips mình vừa rút ra:

- **Giới hạn RAM trong docker-compose**: Thêm \`deploy.resources.limits.memory: 1.5G\` để tránh OOM toàn hệ thống.
- **Tối ưu Webpack Next.js**: Bật \`webpackMemoryOptimizations: true\` trong file \`next.config.ts\`.
- **Dọn dẹp build cache**: Luôn thêm \`.dockerignore\` loại trừ \`node_modules\` và \`.next\` trước khi gửi context sang Docker daemon.

Ai đang bị tình trạng quạt quay như trực thăng thì áp dụng thử nhé 🚁💻`,
      tags: ['FIT', 'Docker', 'DevOps', 'NextJS', 'Tips'],
      mediaUrls: [IMAGE_SETS.tech[0], IMAGE_SETS.tech[2]]
    },
    {
      title: 'Bài tập lớn Kiến trúc Phần mềm: Khi nào nên Microservices, khi nào Modular Monolith?',
      content: `Nhiều bạn K16 làm đồ án hay hỏi mình có nên tách service microservices ngay từ đầu không. Lời khuyên chân thành từ trải nghiệm thực tế:

1. **Đồ án môn học hoặc MVP**: Cứ **Modular Monolith** kết hợp PostgreSQL thuần với ACID transaction là chuẩn nhất. Code nhanh, debug dễ, deploy 1 container là chạy.
2. **Microservices**: Chỉ nên cân nhắc khi team đông (mỗi service 1 team riêng) và đã hiểu rất sâu về transaction phân tán (Saga, Outbox pattern).

Theo các bạn kỳ này nên chọn hướng nào để bảo vệ điểm A dễ hơn?`,
      tags: ['FIT', 'K16', 'KienTrucPhanMem', 'BTL'],
      mediaUrls: [IMAGE_SETS.tech[1]]
    },
    {
      title: 'Lộ trình 30 ngày luyện thuật toán & LeetCode cho kỳ thực tập hè tới',
      content: `Mình vừa tổng hợp bảng danh sách 50 bài LeetCode quan trọng nhất về **Array, Hash Table, Sliding Window, DFS/BFS** và **Dynamic Programming** hay gặp ở các vòng phỏng vấn công ty công nghệ:

- Tuần 1-2: Nắm chắc hai con trỏ (Two Pointers) và Binary Search
- Tuần 3: Tree, Graph traversal và Priority Queue
- Tuần 4: Mock interview 1-1 và rèn kỹ năng giải thích tư duy code (Think Aloud)

Target mỗi ngày 1 bài Medium. Ai muốn cùng lập nhóm cày leetcode cuối tuần ở thư viện thì comment nhé 🚀`,
      tags: ['FIT', 'HocTap', 'ThucTap', 'LeetCode'],
      mediaUrls: [IMAGE_SETS.tech[3]]
    },
    {
      title: 'Hướng dẫn cấu hình định tuyến OSPF và chia VLAN phòng Lab A10',
      content: `Tổng hợp các bước chia Subnet và cấu hình Access/Trunk port trên Cisco Catalyst Switch cho bài lab Mạng máy tính tuần này.

Các bạn K17 lưu ý nhớ kiểm tra kĩ Native VLAN và bảng định tuyến \`show ip route ospf\` trước khi nộp bài check cho thầy nhé!`,
      tags: ['FIT', 'MangMayTinh', 'Cisco', 'Lab'],
      mediaUrls: [IMAGE_SETS.tech[4]]
    }
  ],
  FBA: [
    {
      title: 'Workshop: "Xây dựng thương hiệu cá nhân & CV chuyên nghiệp trên LinkedIn"',
      content: `Cuối tuần này CLB Kỹ năng mềm Phenikaa tổ chức buổi workshop đặc biệt tại **Hội trường A2** dành cho sinh viên khối ngành Kinh tế & Marketing:

✨ **Diễn giả**: Anh Hoàng Nam (Talent Acquisition Lead)
✨ **Nội dung**:
- Cách biến đề tài môn học thành dự án thực chiến gây ấn tượng với nhà tuyển dụng
- Vượt qua hệ thống lọc CV tự động (ATS)
- Tối ưu hồ sơ LinkedIn và kết nối networking chất lượng

Link đăng ký đang mở tại bio, có tea-break bánh ngọt và nước hoa quả miễn phí cho các bạn tham gia nhé 🌷`,
      tags: ['FBA', 'CLB', 'KyNang', 'SuKien', 'Workshop'],
      mediaUrls: [IMAGE_SETS.business[0], IMAGE_SETS.business[2]]
    },
    {
      title: 'Bộ bí kíp thiết kế Slide thuyết trình chuyên nghiệp phong cách Minimalist',
      content: `Sau bao mùa làm bài tập nhóm môn Quản trị chiến lược và Marketing căn bản, mình đúc kết được 3 nguyên tắc vàng khi làm slide:

1. **Nguyên tắc 10-20-30**: Tối đa 10 slide, trình bày trong 20 phút, cỡ chữ không dưới 30pt.
2. **Ít chữ, nhiều dữ liệu**: Thay vì chép cả đoạn văn bản, hãy dùng Bullet points ngắn kết hợp biểu đồ thống kê.
3. **Màu sắc đồng bộ**: Dùng tối đa 3 màu chủ đạo (mình hay lấy tone cam Phenikaa + xám trắng pastel).

Mình có để link bộ 15 template Canva tự làm, bạn nào cần comment mình gửi link clone nha! ✨`,
      tags: ['FBA', 'ThuyetTrinh', 'Slide', 'Canva'],
      mediaUrls: [IMAGE_SETS.business[1]]
    },
    {
      title: 'Top 3 quán cà phê yên tĩnh, wifi khoẻ quanh Phenikaa để chạy deadline',
      content: `Mùa thi đến rồi, chia sẻ cho các bạn 3 toạ độ ruột để ngồi cày đồ án từ sáng đến tối:

1. **Highlands toà A9**: Điều hoà mát rượi, không gian hiện đại, thích hợp học cá nhân.
2. **Cà Phê Tháng 10 (cổng phụ)**: Nhạc lofi nhẹ nhàng, nhiều ổ điện cắm sạc, giá hạt dẻ cho sinh viên.
3. **Katinat gần ga đường sắt**: View hoàng hôn cực chill, bánh trà thơm nức.

Mọi người hay ngồi quán nào quanh Yên Nghĩa nữa không, gợi ý cho mình với!`,
      tags: ['Phenikaa', 'Cafe', 'YenNghia', 'Review'],
      mediaUrls: [IMAGE_SETS.coffee[0], IMAGE_SETS.coffee[1]]
    }
  ],
  FCS: [
    {
      title: 'Thông báo: Mở đợt đăng ký đề tài Nghiên cứu Khoa học Sinh viên năm học 2026-2027',
      content: `Khoa Khoa học Máy tính (FCS) chính thức mở đợt tiếp nhận đề cương Nghiên cứu Khoa học dành cho sinh viên các khoá K16, K17, K18:

🎯 **Các định hướng ưu tiên**:
- Ứng dụng mô hình ngôn ngữ lớn (LLM/RAG) trong hỗ trợ giáo dục đại học
- Xử lý ngôn ngữ tự nhiên tiếng Việt cho phân tích văn bản pháp lý & học thuật
- Thị giác máy tính nhận diện hành vi trong hệ thống giao thông thông minh

Các nhóm sinh viên (từ 2-4 bạn) quan tâm vui lòng gửi tóm tắt ý tưởng qua email khoa trước ngày 15 tháng tới. Thầy sẽ trực tiếp hỗ trợ định hướng phương pháp và tài nguyên tính toán GPU.`,
      tags: ['FCS', 'NCKH', 'AI', 'ThongBao'],
      mediaUrls: [IMAGE_SETS.ai[0], IMAGE_SETS.ai[2]]
    },
    {
      title: 'Gợi ý 2 cuốn sách gối đầu giường về Thiết kế Hệ thống & Cơ sở Dữ liệu',
      content: `Dành cho các bạn sinh viên muốn hiểu bản chất kiến trúc phần mềm và hạ tầng dữ liệu:

1. **Designing Data-Intensive Applications** (*Martin Kleppmann*): Cuốn sách kinh điển giải thích chi tiết về Replication, Partitioning và Distributed Transactions.
2. **Database Internals** (*Alex Petrov*): Giải phẫu cách vận hành của B-Tree, LSM-Tree, WAL log và Storage Engines.

Sách bản in hiện đã có sẵn tại Thư viện toà A10, các em có thể lên mượn đọc bất cứ lúc nào.`,
      tags: ['FCS', 'TaiLieu', 'SachHay', 'Database'],
      mediaUrls: [IMAGE_SETS.study[0]]
    }
  ],
  general: [
    {
      title: 'Góc học tập: Thư viện toà A10 mới nâng cấp thêm dãy bàn nhóm cực xịn',
      content: `Hôm nay vừa lên thư viện toà A10 tầng 4 thấy trường mới lắp thêm loạt bàn học nhóm có vách ngăn cách âm và ổ điện đôi ở từng vị trí ngồi.

Wifi tầng 4 chạy vù vù, điều hoà mát lịm luôn. Điểm 10 cho ban quản lý cơ sở vật chất trường mình 👏✨ Ai chưa thử thì ghé trải nghiệm nhé!`,
      tags: ['Phenikaa', 'ThuVien', 'GocHocTap'],
      mediaUrls: [IMAGE_SETS.study[1], IMAGE_SETS.study[2]]
    },
    {
      title: 'Cơm trưa cổng phụ: Quán nào ngon - bổ - rẻ cho sinh viên?',
      content: `Dạo này trưa nắng quá, loanh quanh khu Yên Nghĩa có quán cơm nào sạch sẽ, có điều hoà mà giá tầm 30k-40k không các bác?

Mình mới thử cơm tấm sườn nướng cổng chính ăn cũng ổn, anh em hay ăn ở đâu chỉ điểm cho mình với!`,
      tags: ['Phenikaa', 'DoiSongSV', 'Review', 'AmThuc'],
      mediaUrls: [IMAGE_SETS.coffee[2]]
    }
  ],
  lecturer: [
    {
      title: '[Nhắc nhở học phần] Hạn nộp Báo cáo Tiến độ Đồ án Tốt nghiệp & Khóa luận',
      content: `Thầy nhắc nhở sinh viên các lớp hướng dẫn Khóa luận tốt nghiệp:

Hạn chót nộp báo cáo tiến độ Đợt 2 là **23h59 Chủ nhật tuần này**. Yêu cầu:
- Nộp file PDF đính kèm biểu đồ kiến trúc hệ thống và kết quả kiểm thử tải ban đầu.
- Ghi rõ những mục đã hoàn thành và khó khăn cần hỗ trợ.

Các nhóm chú ý đúng deadline để khoa kịp tổng hợp đánh giá.`,
      tags: ['ThongBao', 'HocPhan', 'Deadline', 'DoAn'],
      mediaUrls: [IMAGE_SETS.business[2]]
    }
  ],
  ta: [
    {
      title: '[Lớp thực hành] Lưu ý quan trọng bài Lab 3 môn Khoa học Dữ liệu',
      content: `Chào các bạn, mình là Trợ giảng môn Khoa học Dữ liệu. Nhắc nhanh một số lỗi phổ biến các bạn hay mắc phải trong bài nộp Lab tuần này:

- Không hardcode đường dẫn file cục bộ (\`C:\\Users\\...\`), hãy dùng relative path.
- Nhớ chạy \`Restart & Run All\` trên Jupyter Notebook trước khi nộp để đảm bảo không bị lỗi thứ tự biến.
- Điền đúng Họ tên và MSSV ở cell đầu tiên.

Deadline là 23h59 tối mai, các bạn tranh thủ nộp sớm tránh nghẽn mạng nhé!`,
      tags: ['FIT', 'DataScience', 'Lab', 'Deadline'],
      mediaUrls: [IMAGE_SETS.tech[5]]
    }
  ]
}

const TEMPLATE_POLLS = [
  {
    title: 'Khảo sát: Đâu là môn học "thử thách" nhất đối với sinh viên IT Phenikaa?',
    content: `Chào mọi người, để chuẩn bị cho kỳ học tới, mình muốn khảo sát nhanh xem theo đánh giá của các bạn khóa trước, môn học nào trong chương trình đòi hỏi nhiều thời gian cày cuốc nhất?`,
    tags: ['KhaoSat', 'FIT', 'HocTap'],
    mediaUrls: [IMAGE_SETS.tech[1]],
    poll: {
      question: 'Môn học nào thử thách nhất đối với bạn?',
      options: ['Cấu trúc dữ liệu & Giải thuật', 'Kiến trúc máy tính & Vi xử lý', 'Toán rời rạc & Giải tích', 'Hệ điều hành & Mạng máy tính'],
      closesInDays: 7
    }
  },
  {
    title: 'Thăm dò: Nỗi sợ lớn nhất của bạn khi làm bài tập nhóm là gì?',
    content: `Làm việc nhóm là kỹ năng bắt buộc ở đại học, nhưng không phải lúc nào cũng êm ả. Bạn thấy điều gì khiến nhóm dễ mất đoàn kết nhất?`,
    tags: ['KhaoSat', 'KyNang', 'DoiSongSV'],
    mediaUrls: [IMAGE_SETS.business[0]],
    poll: {
      question: 'Nỗi sợ lớn nhất khi làm bài tập lớn nhóm?',
      options: ['Thành viên "seen" tin nhắn không hồi âm', 'Sát deadline mới bắt đầu làm', 'Một người phải gánh hết công việc', 'Bất đồng ý kiến không ai chịu ai'],
      closesInDays: 5
    }
  },
  {
    title: 'Khảo sát: Không gian học tập lý tưởng nhất của bạn?',
    content: `Mỗi người đều có một môi trường riêng để đạt trạng thái "Flow" tập trung cao độ. Bạn thường học hiệu quả nhất ở đâu?`,
    tags: ['KhaoSat', 'GocHocTap', 'ThuVien'],
    mediaUrls: [IMAGE_SETS.study[0]],
    poll: {
      question: 'Bạn học tập trung nhất ở đâu?',
      options: ['Thư viện tầng 4 toà A10', 'Quán cà phê mở nhạc lofi', 'Bàn học tại phòng riêng ban đêm', 'Học nhóm cùng bạn bè ở sảnh trường'],
      closesInDays: 7
    }
  }
]

const TEMPLATE_DIRECT_CHATS = [
  {
    topic: 'Hỏi bài tập lớn',
    script: [
      { fromA: true, text: 'Hê sờ lô, ông đã làm xong câu 3 phần SQL bài tập lớn chưa?' },
      { fromA: false, text: 'Tôi vừa viết xong đoạn query tối ưu index hôm qua, ông đang kẹt chỗ nào thế?' },
      { fromA: true, text: 'Chỗ join bảng phức tạp ấy, chạy thử thấy explain analyze quét cả table luôn.' },
      { fromA: false, text: 'À thế phải thêm composite index vào hai cột foreign key là mượt ngay. Lát chiều lên thư viện tôi chỉ cho.' },
      { fromA: true, text: 'Oki tuyệt vời luôn, chiều tầm 2h nhé, bao cốc trà sữa!' }
    ]
  },
  {
    topic: 'Rủ đi học thư viện',
    script: [
      { fromA: true, text: 'Bà ơi chiều nay có lên trường không? Qua thư viện tầng 4 ôn thi với tui đi.' },
      { fromA: false, text: 'Có nè, tầm 2h15 tui qua. Bà lên trước giữ hộ tui 1 chỗ cạnh ổ điện với nha!' },
      { fromA: true, text: 'Oki tui đang ngồi dãy A4 rồi, tiện đường mua hộ tui cốc trà đào nhé 🌷' },
      { fromA: false, text: 'Nhất trí, 15 phút nữa tui tới!' }
    ]
  },
  {
    topic: 'Hỏi về thực tập',
    script: [
      { fromA: true, text: 'Phúc ơi, bên công ty ông có đang mở đợt tuyển thực tập sinh backend không thế?' },
      { fromA: false, text: 'Đang có đợt tuyển intern Node.js/NestJS đấy ông. Yêu cầu nắm chắc SQL với REST API là được.' },
      { fromA: true, text: 'Uầy đúng stack tôi đang cày luôn. Ông xem qua CV giúp tôi được không?' },
      { fromA: false, text: 'Gửi link drive qua đây tôi xem rồi feedback cho, tự tin lên!' }
    ]
  }
]

const TEMPLATE_GROUP_CHATS = [
  {
    groupName: 'Nhóm BTL - Kỹ thuật Phần mềm K16',
    script: [
      { role: 0, text: 'Alo cả nhóm ơi, tối nay 20h họp Google Meet chốt nốt giao diện với báo cáo nhé!' },
      { role: 1, text: 'Oki bạn, phần thiết kế Figma với luồng người dùng mình đã xuất PDF sẵn rồi nhé.' },
      { role: 2, text: 'Backend API auth với post cũng đã pass hết unit test rồi, tối mình demo luôn.' },
      { role: 0, text: 'Đỉnh quá cả nhà ơi, tối gặp nhé, cố gắng lấy điểm A môn này nào 🔥' }
    ]
  },
  {
    groupName: 'Hội SV Phenikaa - Thảo luận & Cà phê',
    script: [
      { role: 0, text: 'Trưa nay có ai rủ rê ăn cơm gà gần cổng phụ trường không?' },
      { role: 1, text: 'Quán cơm gà Hải Âu đúng không? Cho tôi ké 1 chân với!' },
      { role: 2, text: '11h45 hẹn ở sảnh toà A nhé cả nhà, đi sớm kẻo đông hết chỗ.' },
      { role: 0, text: 'Oki chốt kèo 11h45 nha!' }
    ]
  }
]

export class ContentGenerator {
  constructor(config) {
    this.config = config
    this.aiConfig = config.ai || {}
    this.safety = config.safety || { blockedKeywords: [] }
  }

  isSafe(text) {
    if (!text) return true
    const lower = text.toLowerCase()
    return !this.safety.blockedKeywords.some(kw => lower.includes(kw.toLowerCase()))
  }

  async generateWithLLM(prompt, systemInstruction) {
    const apiKey = process.env.AI_API_KEY || this.aiConfig.apiKey || 'dummy'
    const baseUrl = (process.env.AI_BASE_URL || this.aiConfig.baseUrl || 'https://api-ai.vnhat.dev/v1').replace(/\/+$/, '')
    const model = process.env.AI_MODEL || this.aiConfig.model || 'v9'

    try {
      const res = await fetch(`${baseUrl}/chat/completions`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${apiKey}`
        },
        body: JSON.stringify({
          model,
          temperature: this.aiConfig.temperature || 0.8,
          stream: false,
          messages: [
            { role: 'system', content: systemInstruction },
            { role: 'user', content: prompt }
          ]
        })
      })

      if (!res.ok) {
        throw new Error(`LLM API returned ${res.status}`)
      }

      const rawText = await res.text()
      let content = ''
      try {
        const json = JSON.parse(rawText)
        content = json.choices?.[0]?.message?.content?.trim() || ''
      } catch {
        // Hỗ trợ trường hợp gateway trả về dạng Server-Sent Events (SSE / streaming)
        const lines = rawText.split('\n')
        for (const line of lines) {
          const trimmed = line.trim()
          if (trimmed.startsWith('data: ') && !trimmed.includes('[DONE]')) {
            try {
              const chunk = JSON.parse(trimmed.slice(6))
              const delta = chunk.choices?.[0]?.delta?.content || chunk.choices?.[0]?.message?.content || ''
              content += delta
            } catch {}
          }
        }
        content = content.trim()
      }

      if (content && this.isSafe(content)) {
        return content
      }
    } catch (err) {
      logger.warn(`LLM generation fallback: ${err.message}`)
    }
    return null
  }

  // 1. Sinh bài đăng phong phú có Title, Markdown, Hashtags và Hình ảnh
  async generatePost(persona, topic = null) {
    // A. Cơ hội sinh khảo sát (Poll)
    if (this.config.postSettings?.allowPolls && Math.random() < (this.config.postSettings?.pollProbability || 0.25)) {
      const pollTemplate = TEMPLATE_POLLS[Math.floor(Math.random() * TEMPLATE_POLLS.length)]
      return {
        ...pollTemplate,
        mediaUrls: pollTemplate.mediaUrls || pickRandomImages('tech', 1)
      }
    }

    // B. Sinh bài bằng LLM nếu có cấu hình
    if (this.config.simulation.mode !== 'template_only') {
      const sysPrompt = `Bạn là sinh viên hoặc giảng viên Đại học Phenikaa tên là ${persona.displayName} (@${persona.username}), khoa ${persona.faculty}, vai trò: ${persona.role}. Tính cách: ${persona.tone}.
Nhiệm vụ: Viết 1 bài đăng mạng xã hội đại học chất lượng cao, định dạng Markdown đẹp mắt, có tiêu đề súc tích ở dòng đầu tiên (# Tiêu đề), nội dung phân đoạn rõ ràng bằng gạch đầu dòng, có emoji tự nhiên, cuối bài có 2-3 hashtag dạng #Tag.
Chủ đề liên quan mật thiết đến đời sống sinh viên, đồ án, thư viện, cà phê hoặc học thuật.`

      const userPrompt = topic 
        ? `Viết bài chia sẻ về: "${topic}".` 
        : `Viết bài ngẫu nhiên về sở thích (${persona.interests.join(', ')}) hoặc kinh nghiệm học tập tại Phenikaa.`

      const text = await this.generateWithLLM(userPrompt, sysPrompt)
      if (text) {
        const lines = text.split('\n').filter(Boolean)
        let title = ''
        let body = text
        if (lines[0]?.startsWith('#')) {
          title = lines[0].replace(/^#+\s*/, '').trim()
          body = lines.slice(1).join('\n').trim()
        }

        const tags = (text.match(/#([a-zA-Z0-9_\p{L}]+)/gu) || []).map(t => t.replace('#', ''))
        const cleanContent = body.replace(/#([a-zA-Z0-9_\p{L}]+)/gu, '').trim()

        // Chọn ảnh phù hợp với persona/khoa
        let imageCategory = 'campus'
        if (persona.faculty === 'FIT') imageCategory = 'tech'
        else if (persona.faculty === 'FBA') imageCategory = 'business'
        else if (persona.faculty === 'FCS') imageCategory = 'ai'

        return {
          title: title || `${persona.displayName} chia sẻ góc nhìn học tập`,
          content: cleanContent || body,
          tags: tags.length ? tags : [persona.faculty || 'Phenikaa', 'HocTap'],
          mediaUrls: pickRandomImages(imageCategory, Math.random() < 0.3 ? 2 : 1)
        }
      }
    }

    // C. Template Fallback phong phú
    let pool = TEMPLATE_POSTS[persona.faculty] || TEMPLATE_POSTS.general
    if (persona.role === 'lecturer') {
      pool = [...pool, ...TEMPLATE_POSTS.lecturer]
    } else if (persona.role === 'ta') {
      pool = [...pool, ...TEMPLATE_POSTS.ta]
    }
    const picked = pool[Math.floor(Math.random() * pool.length)]
    return {
      ...picked,
      mediaUrls: picked.mediaUrls || pickRandomImages('tech', 1)
    }
  }

  // 2. Sinh bình luận ngữ cảnh cho bài viết
  async generateComment(post, persona) {
    if (this.config.simulation.mode !== 'template_only') {
      const prompt = `Bài đăng: "${post.title ? post.title + ' - ' : ''}${post.content || ''}"
Bạn là ${persona.displayName} (${persona.faculty}, vai trò: ${persona.role}, phong cách: ${persona.tone}).
Hãy viết 1 câu bình luận ngắn phản hồi bài viết trên: tự nhiên, đúng chuyên môn hoặc đồng tình, thân thiện như sinh viên/thầy cô trên mạng xã hội trường. Tối đa 1-2 câu.`
      const text = await this.generateWithLLM(prompt, 'Bạn là thành viên trường Đại học Phenikaa đang bình luận trên bài viết. Tự nhiên, ngắn gọn.')
      if (text) return text
    }

    // Template bình luận theo ngành & vai trò
    if (persona.role === 'lecturer') {
      const lecturerComments = [
        'Ý kiến chia sẻ rất thiết thực, các em sinh viên nên lưu lại áp dụng vào đồ án nhé.',
        'Bài viết phân tích khá rõ ràng. Nếu các em cần thêm tài liệu chuyên sâu thì có thể gặp thầy ở văn phòng khoa.',
        'Thầy đánh giá cao tinh thần tự học và chia sẻ của em. Chúc em tiếp tục phát huy!',
        'Rất đúng, phần này trong thực tế doanh nghiệp áp dụng rất nhiều.'
      ]
      return lecturerComments[Math.floor(Math.random() * lecturerComments.length)]
    }

    if (persona.role === 'ta') {
      const taComments = [
        'Chuẩn luôn bạn ơi, các bạn sinh viên làm bài lab cũng nhớ chú ý đoạn này nha.',
        'Bài chia sẻ chất lượng quá! Mình sẽ ghim lưu ý này vào buổi chữa bài tập tới.',
        'Đúng đoạn mình hay nhắc các bạn trên lớp này, cảm ơn bạn đã tổng hợp chi tiết 👍',
        'Cách xử lý này tối ưu hơn hẳn, rất đáng học hỏi!'
      ]
      return taComments[Math.floor(Math.random() * taComments.length)]
    }

    if (persona.faculty === 'FIT') {
      const fitComments = [
        'Chuẩn luôn ông ơi, đợt trước tôi cũng dính bug này debug mất cả buổi tối 🥲',
        'Cách này hay quá, lưu lại để mai áp dụng vào bài tập lớn luôn 💻🔥',
        'Đồng quan điểm, làm kiến trúc clean từ đầu đỡ công refactor sau này nhiều lắm.',
        'Cho mình xin thêm ít tài liệu tham khảo với bạn ơi!',
        'Đỉnh nóc kịch trần luôn bạn ơi, thả tim mạnh!'
      ]
      return fitComments[Math.floor(Math.random() * fitComments.length)]
    }

    const generalComments = [
      'Bài viết hữu ích quá bạn ơi, cảm ơn bạn đã chia sẻ nhé! ✨',
      'Đúng chủ đề mình đang tìm kiếm luôn, cảm ơn bạn nhiều nha!',
      'Góc nhìn rất thực tế, lưu lại ngay để áp dụng 👍',
      'Chuẩn luôn, hôm nào hẹn nhau ở thư viện trao đổi thêm nhé!',
      'Thả tim cho bài viết xịn xò này ❤️'
    ]
    return generalComments[Math.floor(Math.random() * generalComments.length)]
  }

  // 3. Bot tác giả phản hồi lại bình luận (Author Reply Thread)
  async generateAuthorReply(post, authorPersona, comment) {
    if (this.config.simulation.mode !== 'template_only') {
      const prompt = `Bài đăng của bạn: "${post.content?.slice(0, 100)}"
Bình luận của bạn học: "${comment.content}"
Bạn là ${authorPersona.displayName} (${authorPersona.tone}). Hãy viết 1 câu phản hồi ngắn, thân thiện, cảm ơn hoặc tiếp nối câu chuyện.`
      const text = await this.generateWithLLM(prompt, 'Phản hồi bình luận ngắn gọn, thân mật.')
      if (text) return text
    }

    const replies = [
      'Cảm ơn bạn nhé! Có gì cần trao đổi thêm cứ ới mình nha.',
      'Chuẩn luôn bạn ơi, hy vọng giúp ích được cho mọi người.',
      'Hehe cảm ơn bác nhiều nha, chúc bác làm đồ án mượt mà!',
      'Dạ em cảm ơn thầy/bạn nhiều ạ!',
      'Oki bạn ơi, có gì hẹn nhau cà phê thư viện trao đổi thêm nhé!'
    ]
    return replies[Math.floor(Math.random() * replies.length)]
  }

  // 4. Bot reply vào 1 comment có sẵn (Nested discussion)
  async generateReplyComment(post, persona, targetComment) {
    if (this.config.simulation.mode !== 'template_only') {
      const prompt = `Bình luận gốc: "${targetComment.content}"
Bạn là ${persona.displayName} (${persona.tone}). Hãy viết 1 câu trả lời trực tiếp cho bình luận này (đồng tình, góp ý thêm hoặc hỏi lại).`
      const text = await this.generateWithLLM(prompt, 'Trả lời bình luận của bạn học ngắn gọn, tự nhiên.')
      if (text) return text
    }

    const replies = [
      'Đồng ý với bác đoạn này luôn, làm vậy nhanh hơn hẳn.',
      'Công nhận, hôm trước mình cũng thử cách giống bạn nói thấy hiệu quả thật.',
      'Chuẩn luôn bạn ơi, mình cũng thấy vậy 👍',
      'Hay nè, để mình thử áp dụng xem sao!',
      'Like mạnh cho ý kiến này của bạn!'
    ]
    return replies[Math.floor(Math.random() * replies.length)]
  }

  // 5. Sinh hội thoại 1-1
  async generateDirectChat(personaA, personaB, customTopic = null) {
    if (this.config.simulation.mode !== 'template_only') {
      const topic = customTopic || 'trao đổi về bài tập lớn hoặc hẹn nhau đi cà phê / thư viện trường Phenikaa'
      const sysPrompt = `Hãy đóng vai hai sinh viên trường ĐH Phenikaa:
- Người A: ${personaA.displayName} (@${personaA.username}, khoa ${personaA.faculty})
- Người B: ${personaB.displayName} (@${personaB.username}, khoa ${personaB.faculty})
Hai người đang nhắn tin 1-1 qua ứng dụng chat của trường. Viết đoạn hội thoại ngắn 3-5 câu qua lại tự nhiên, phong cách giới trẻ sinh viên Việt Nam, xưng hô thân mật (ông-tôi, bà-tôi hoặc bạn-mình).
Trả về JSON đúng cấu trúc:
[
  {"fromA": true, "text": "..."},
  {"fromA": false, "text": "..."},
  {"fromA": true, "text": "..."}
]`

      const result = await this.generateWithLLM(`Viết hội thoại về chủ đề: "${topic}"`, sysPrompt)
      if (result) {
        try {
          const jsonMatch = result.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed) && parsed.length >= 2) {
              return { topic, script: parsed }
            }
          }
        } catch {}
      }
    }

    const template = TEMPLATE_DIRECT_CHATS[Math.floor(Math.random() * TEMPLATE_DIRECT_CHATS.length)]
    return template
  }

  // 6. Sinh hội thoại nhóm (Group Chat)
  async generateGroupChat(members, customTopic = null) {
    if (this.config.simulation.mode !== 'template_only') {
      const memberNames = members.map((m, idx) => `Thành viên ${idx}: ${m.displayName} (@${m.username})`).join('\n')
      const topic = customTopic || 'họp nhóm làm bài tập lớn hoặc rủ nhau đi ăn trưa'
      const sysPrompt = `Bạn đang giả lập một cuộc trò chuyện nhóm của sinh viên Đại học Phenikaa gồm:\n${memberNames}
Chủ đề thảo luận: "${topic}".
Hãy viết 3-4 tin nhắn luân phiên giữa các thành viên, ngắn gọn, tự nhiên như tin nhắn Messenger/Zalo.
Trả về JSON đúng cấu trúc:
[
  {"role": 0, "text": "..."},
  {"role": 1, "text": "..."},
  {"role": 2, "text": "..."}
]`

      const result = await this.generateWithLLM('Tạo kịch bản nhóm chat', sysPrompt)
      if (result) {
        try {
          const jsonMatch = result.match(/\[[\s\S]*\]/)
          if (jsonMatch) {
            const parsed = JSON.parse(jsonMatch[0])
            if (Array.isArray(parsed) && parsed.length >= 2) {
              return { groupName: `Nhóm thảo luận: ${topic}`, script: parsed }
            }
          }
        } catch {}
      }
    }

    const template = TEMPLATE_GROUP_CHATS[Math.floor(Math.random() * TEMPLATE_GROUP_CHATS.length)]
    return template
  }
}
