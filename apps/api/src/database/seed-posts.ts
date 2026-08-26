import { Pool } from 'pg'

const pool = new Pool({
  connectionString:
    process.env.DATABASE_URL ||
    'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db'
})

interface FacultyData {
  code: string
  name: string
  short_name: string
  description: string
  dean_name: string
  office_location: string
}

interface CourseData {
  code: string
  name: string
  credits: number
  faculty_code: string
  description: string
  rating_avg: number
}

const facultiesData: FacultyData[] = [
  {
    code: 'FIT',
    name: 'Khoa Công nghệ Thông tin',
    short_name: 'FIT',
    description: 'Đào tạo kỹ sư phần mềm, an toàn thông tin và hệ thống thông tin.',
    dean_name: 'TS. Nguyễn Văn Hà',
    office_location: 'Tòa A2 - P.401'
  },
  {
    code: 'FCS',
    name: 'Khoa Khoa học Máy tính & Trí tuệ Nhân tạo',
    short_name: 'FCS',
    description: 'Nghiên cứu và đào tạo chuyên sâu về AI, Data Science và LLM.',
    dean_name: 'PGS.TS Trần Thị Thu',
    office_location: 'Tòa A2 - P.405'
  },
  {
    code: 'FEE',
    name: 'Khoa Điện - Điện tử & Tự động hóa',
    short_name: 'FEE',
    description: 'Đào tạo kỹ thuật điện tử, viễn thông, IoT và điều khiển robot.',
    dean_name: 'TS. Lê Quang Thắng',
    office_location: 'Tòa A3 - P.202'
  },
  {
    code: 'FAE',
    name: 'Khoa Kỹ thuật Ô tô & Năng lượng',
    short_name: 'FAE',
    description: 'Kỹ thuật ô tô, xe điện EV và xe tự hành Phenikaa-X.',
    dean_name: 'TS. Hoàng Văn Nam',
    office_location: 'Tòa A4 - P.101'
  },
  {
    code: 'FBA',
    name: 'Khoa Kinh tế & Quản trị Kinh doanh',
    short_name: 'FBA',
    description: 'Đào tạo quản trị kinh doanh, marketing số, logistics và tài chính ngân hàng.',
    dean_name: 'PGS.TS Đặng Thị Loan',
    office_location: 'Tòa A1 - P.502'
  },
  {
    code: 'FEL',
    name: 'Khoa Ngôn ngữ & Ngoại ngữ',
    short_name: 'FEL',
    description: 'Đào tạo ngôn ngữ Anh, Trung Quốc, Hàn Quốc và biên phiên dịch.',
    dean_name: 'TS. Lê Thanh Mai',
    office_location: 'Tòa A1 - P.304'
  },
  {
    code: 'FAS',
    name: 'Khoa Khoa học & Kỹ thuật Vật liệu',
    short_name: 'FAS',
    description: 'Nghiên cứu vật liệu nano tiên tiến, bán dẫn và pin mặt trời.',
    dean_name: 'GS.TS Bùi Đức Thành',
    office_location: 'Tòa A3 - P.501'
  },
  {
    code: 'FMS',
    name: 'Khối ngành Khoa học Sức khỏe & Y Dược',
    short_name: 'FMS',
    description: 'Đào tạo Bác sĩ đa khoa, Dược sĩ và Điều dưỡng tại BV ĐH Phenikaa.',
    dean_name: 'TTND.GS.TS Phạm Quang Đại',
    office_location: 'Tòa Bệnh viện ĐH Phenikaa'
  }
]

const coursesData: CourseData[] = [
  { code: 'IT101', name: 'Cấu trúc dữ liệu và Giải thuật', credits: 3, faculty_code: 'FIT', description: 'Cây nhị phân, đồ thị, thuật toán tìm kiếm và sắp xếp nâng cao.', rating_avg: 4.8 },
  { code: 'IT102', name: 'Lập trình Web Nâng cao (React & NestJS)', credits: 3, faculty_code: 'FIT', description: 'Kiến trúc Fullstack hiện đại, REST, GraphQL và Clean Architecture.', rating_avg: 4.9 },
  { code: 'IT103', name: 'Hệ quản trị Cơ sở Dữ liệu & SQL', credits: 3, faculty_code: 'FIT', description: 'PostgreSQL, thiết kế quan hệ, đánh chỉ mục và tối ưu hóa query.', rating_avg: 4.7 },
  { code: 'IT104', name: 'Lập trình Hướng đối tượng OOP C++/Java', credits: 3, faculty_code: 'FIT', description: 'Tính đa hình, đóng gói, kế thừa và các Design Patterns phổ biến.', rating_avg: 4.6 },
  { code: 'IT105', name: 'Lập trình Ứng dụng Di động (Flutter/React Native)', credits: 3, faculty_code: 'FIT', description: 'Xây dựng ứng dụng di động đa nền tảng kết nối API backend.', rating_avg: 4.8 },
  { code: 'IT106', name: 'Điện toán Đám mây & DevOps Thực chiến', credits: 3, faculty_code: 'FIT', description: 'Docker, CI/CD, Kubernetes, Microservices và Nginx.', rating_avg: 4.9 },
  { code: 'CS201', name: 'Trí tuệ Nhân tạo & Học máy Cơ bản', credits: 3, faculty_code: 'FCS', description: 'Hồi quy tuyến tính, cây quyết định, SVM và mạng nơ-ron cơ bản.', rating_avg: 4.8 },
  { code: 'CS202', name: 'Xử lý Ngôn ngữ Tự nhiên & LLM', credits: 3, faculty_code: 'FCS', description: 'Transformer, BERT, GPT, fine-tuning mô hình ngôn ngữ lớn.', rating_avg: 4.9 },
  { code: 'CS203', name: 'Thị giác Máy tính (Computer Vision)', credits: 3, faculty_code: 'FCS', description: 'Xử lý ảnh số, CNN, YOLOv8 nhận diện vật thể thời gian thực.', rating_avg: 4.7 },
  { code: 'CS204', name: 'Khai phá Dữ liệu & Big Data Analytics', credits: 3, faculty_code: 'FCS', description: 'Xử lý dữ liệu lớn với Spark, phân cụm và trích xuất tri thức.', rating_avg: 4.6 },
  { code: 'EE201', name: 'Kỹ thuật Điện tử Tương tự & Số', credits: 3, faculty_code: 'FEE', description: 'Mạch khuếch đại thuật toán, Flip-Flop, vi điều khiển logic.', rating_avg: 4.5 },
  { code: 'EE202', name: 'Hệ thống Nhúng & IoT Thông minh', credits: 3, faculty_code: 'FEE', description: 'Lập trình STM32, ESP32, FreeRTOS và giao thức MQTT.', rating_avg: 4.9 },
  { code: 'EE203', name: 'Kỹ thuật Robot & Điều khiển Tự động', credits: 3, faculty_code: 'FEE', description: 'Thuật toán PID, động học robot và thiết kế xe Robocon.', rating_avg: 4.8 },
  { code: 'FAE101', name: 'Nguyên lý Động cơ Đốt trong & Khung gầm', credits: 3, faculty_code: 'FAE', description: 'Chu trình nhiệt động lực, hệ thống treo và truyền lực ô tô.', rating_avg: 4.6 },
  { code: 'FAE102', name: 'Kỹ thuật Xe điện EV & Pin Lithium', credits: 3, faculty_code: 'FAE', description: 'Hệ thống truyền động điện, BMS và sạc xe điện thông minh.', rating_avg: 4.9 },
  { code: 'FAE103', name: 'Công nghệ Xe tự hành (Phenikaa-X)', credits: 3, faculty_code: 'FAE', description: 'Định vị GPS-RTK, LiDAR, camera fusion và lập kế hoạch đường đi.', rating_avg: 5.0 },
  { code: 'FBA101', name: 'Nguyên lý Marketing & Quản trị Thương hiệu', credits: 3, faculty_code: 'FBA', description: 'Nghiên cứu thị trường, định vị thương hiệu và hành vi người tiêu dùng.', rating_avg: 4.7 },
  { code: 'FBA102', name: 'Tài chính Tiền tệ & Ngân hàng', credits: 3, faculty_code: 'FBA', description: 'Thị trường vốn, lãi suất, phân tích báo cáo tài chính doanh nghiệp.', rating_avg: 4.6 },
  { code: 'FBA103', name: 'Quản trị Chuỗi Cung ứng & Logistics', credits: 3, faculty_code: 'FBA', description: 'Quản trị kho bãi, mô hình EOQ và tối ưu hóa vận tải giao nhận.', rating_avg: 4.8 },
  { code: 'FBA104', name: 'Thương mại Điện tử & Kinh doanh Số', credits: 3, faculty_code: 'FBA', description: 'Mô hình kinh doanh sàn TMĐT, phễu chuyển đổi và Digital Ads.', rating_avg: 4.8 },
  { code: 'FEL101', name: 'Tiếng Anh Học thuật & Luyện thi IELTS', credits: 3, faculty_code: 'FEL', description: 'Chiến thuật Academic Writing, Reading Comprehension và Speaking.', rating_avg: 4.8 },
  { code: 'FEL102', name: 'Tiếng Anh Chuyên ngành Kỹ thuật', credits: 2, faculty_code: 'FEL', description: 'Thuật ngữ kỹ thuật, viết Abstract và thuyết trình báo cáo khoa học.', rating_avg: 4.6 },
  { code: 'FEL103', name: 'Tiếng Trung Giao tiếp & Thương mại', credits: 3, faculty_code: 'FEL', description: 'Luyện nghe nói HSK 4-5 và đàm phán thương mại quốc tế.', rating_avg: 4.7 },
  { code: 'FAS101', name: 'Khoa học Vật liệu Tiên tiến & Công nghệ Nano', credits: 3, faculty_code: 'FAS', description: 'Cấu trúc tinh thể, màng mỏng oxit và hạt nano ứng dụng.', rating_avg: 4.7 },
  { code: 'FAS102', name: 'Pin Năng lượng Mặt trời & Bán dẫn', credits: 3, faculty_code: 'FAS', description: 'Vật liệu Perovskite, hiệu suất quang điện và kiểm thử độ bền.', rating_avg: 4.8 },
  { code: 'FMS101', name: 'Giải phẫu học & Sinh lý học Y khoa', credits: 4, faculty_code: 'FMS', description: 'Hệ tim mạch, hô hấp, thần kinh và thực hành tại bệnh viện.', rating_avg: 4.9 },
  { code: 'FMS102', name: 'Dược lý học & Hóa dược Lâm sàng', credits: 3, faculty_code: 'FMS', description: 'Cơ chế tác dụng thuốc, dược động học và tương tác thuốc.', rating_avg: 4.8 },
  { code: 'MATH101', name: 'Đại số Tuyến tính & Hình học Không gian', credits: 3, faculty_code: 'FIT', description: 'Ma trận, định thức, không gian vector và phép biến đổi tuyến tính.', rating_avg: 4.5 },
  { code: 'MATH201', name: 'Giải tích 1 & Giải tích 2', credits: 4, faculty_code: 'FIT', description: 'Tích phân vi phân nhiều biến, chuỗi số, tích phân đường và mặt.', rating_avg: 4.6 },
  { code: 'PHY102', name: 'Vật lý Đại cương 1 & 2', credits: 3, faculty_code: 'FEE', description: 'Cơ học chất điểm, nhiệt động học và điện từ trường.', rating_avg: 4.4 }
]

function slugify(text: string, idSuffix: string): string {
  const base = text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[đĐ]/g, 'd')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .slice(0, 80)
  return `${base}-${idSuffix}`
}

function getRandomItem<T>(arr: readonly T[] | T[]): T {
  return arr[Math.floor(Math.random() * arr.length)]
}

function getRandomItems<T>(arr: readonly T[] | T[], count: number): T[] {
  const shuffled = [...arr].sort(() => 0.5 - Math.random())
  return shuffled.slice(0, count)
}

function getRandomInt(min: number, max: number): number {
  return Math.floor(Math.random() * (max - min + 1)) + min
}

async function main() {
  console.log('🚀 Starting PU Connector Database Seeding for 280+ Posts...')

  // 1. Seed Faculties
  console.log('📦 Seeding faculties...')
  for (const f of facultiesData) {
    await pool.query(
      `INSERT INTO faculties (code, name, short_name, description, dean_name, office_location)
       VALUES ($1, $2, $3, $4, $5, $6)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         short_name = EXCLUDED.short_name,
         description = EXCLUDED.description,
         dean_name = EXCLUDED.dean_name,
         office_location = EXCLUDED.office_location`,
      [f.code, f.name, f.short_name, f.description, f.dean_name, f.office_location]
    )
  }

  // Get Faculty Map
  const facRes = await pool.query('SELECT id, code FROM faculties')
  const facultyMap = new Map<string, string>()
  for (const row of facRes.rows) {
    facultyMap.set(row.code, row.id)
  }

  // 2. Seed Courses
  console.log('📚 Seeding courses...')
  for (const c of coursesData) {
    const facId = facultyMap.get(c.faculty_code) || null
    await pool.query(
      `INSERT INTO courses (code, name, credits, faculty_id, faculty_code, description, rating_avg)
       VALUES ($1, $2, $3, $4, $5, $6, $7)
       ON CONFLICT (code) DO UPDATE SET
         name = EXCLUDED.name,
         credits = EXCLUDED.credits,
         faculty_id = EXCLUDED.faculty_id,
         faculty_code = EXCLUDED.faculty_code,
         description = EXCLUDED.description,
         rating_avg = EXCLUDED.rating_avg`,
      [c.code, c.name, c.credits, facId, c.faculty_code, c.description, c.rating_avg]
    )
  }

  // Get Course Map
  const courseRes = await pool.query('SELECT id, code, faculty_code FROM courses')
  const courseMap = new Map<string, { id: string; faculty_code: string }>()
  for (const row of courseRes.rows) {
    courseMap.set(row.code, { id: row.id, faculty_code: row.faculty_code })
  }

  // 3. Load Users
  const userRes = await pool.query(
    'SELECT id, username, display_name, role, faculty, student_id FROM users'
  )
  const users = userRes.rows
  if (users.length === 0) {
    console.error('❌ No users found in database! Please run seed-users.sql first.')
    process.exit(1)
  }
  console.log(`👤 Found ${users.length} users in database.`)

  const lecturers = users.filter((u) => u.role === 'lecturer')
  const tas = users.filter((u) => u.role === 'ta')
  const admin = users.find((u) => u.role === 'admin') || users[0]
  const students = users.filter((u) => u.role === 'student')

  const usersByFaculty: Record<string, typeof users> = {}
  for (const u of users) {
    const fac = u.faculty || 'FIT'
    if (!usersByFaculty[fac]) usersByFaculty[fac] = []
    usersByFaculty[fac].push(u)
  }

  // Clear existing posts & comments to ensure clean state
  console.log('🧹 Clearing old posts, comments, and reactions...')
  await pool.query('TRUNCATE TABLE comments, post_reactions, posts CASCADE')

  // 4. Generate Structured Posts
  interface PostSeedTemplate {
    postType: 'question' | 'resource_share' | 'pbl_recruitment' | 'general' | 'announcement'
    courseCode?: string
    facultyCode: string
    title: string
    content: string
    tags: string[]
    mediaUrls?: string[]
    authorRole?: 'lecturer' | 'ta' | 'admin' | 'student'
    preferredUsername?: string
    isPinned?: boolean
    daysAgo: number
    comments: Array<{
      authorUsername?: string
      authorRole?: 'lecturer' | 'ta' | 'student'
      content: string
      isSolution?: boolean
      likesCount?: number
      replies?: Array<{
        authorUsername?: string
        authorRole?: 'lecturer' | 'ta' | 'student'
        content: string
      }>
    }>
  }

  // Large curated catalog of realistic posts
  const postTemplates: PostSeedTemplate[] = [
    // --- FIT / FCS (Lập trình, Thuật toán, Web, AI) ---
    {
      postType: 'question',
      courseCode: 'IT101',
      facultyCode: 'FIT',
      preferredUsername: 'vudinhnam',
      title: 'Hỏi về độ phức tạp của thuật toán duyệt cây AVL vs Cây đỏ đen (Red-Black Tree)',
      content: `Chào thầy cô và các bạn K16, K17!\n\nTrong bài tập lớn môn **Cấu trúc dữ liệu và Giải thuật (IT101)**, nhóm em đang phân vân giữa việc dùng **AVL Tree** và **Red-Black Tree** để lưu trữ chỉ mục danh bạ sinh viên Phenikaa.\n\nTheo lý thuyết:\n- AVL Tree cân bằng ngặt hơn ($|h_L - h_R| \\le 1$), nên tìm kiếm nhanh hơn ($O(\\log n)$ với hệ số nhỏ).\n- Red-Black Tree lại có chi phí cân bằng khi Insert/Delete ít hơn do số lần xoay (rotations) tối đa chỉ là 2-3.\n\nCho em hỏi trong trường hợp bài toán có **90% thao tác tìm kiếm** và **10% thao tác ghi dữ liệu** thì nên chọn cấu trúc nào để tối ưu hiệu năng bộ nhớ Cache CPU nhất ạ?\n\n\`\`\`cpp\n// Định nghĩa Node cây AVL hiện tại của nhóm\nstruct Node {\n    int studentId;\n    string name;\n    int height;\n    Node *left, *right;\n};\n\`\`\``,
      tags: ['IT101', 'DataStructures', 'Tree', 'Cpp', 'Algorithms'],
      daysAgo: 2,
      comments: [
        {
          authorUsername: 'ta_phamthanhbinh',
          authorRole: 'ta',
          content: 'Chào Nam! Với tỷ lệ 90% Read / 10% Write, **AVL Tree** là lựa chọn tối ưu hơn nhé. Chiều cao cây AVL luôn được duy trì tối thiểu nên số lần so sánh con trỏ ít hơn. Red-Black Tree chỉ thực sự vượt trội khi hệ thống có tần suất Insert/Delete liên tục như trong `std::map` của C++.',
          isSolution: true,
          likesCount: 15,
          replies: [
            {
              authorUsername: 'vudinhnam',
              content: 'Em cảm ơn thầy Bình nhiều ạ! Nhóm em sẽ triển khai theo hướng AVL Tree.'
            },
            {
              authorUsername: 'nguyenvanan',
              content: 'Nếu cần benchmark thực tế trên 100,000 phần tử thì bạn có thể dùng thư viện `chrono` trong C++20 đo microsecond nhé!'
            }
          ]
        },
        {
          authorUsername: 'dothanhtung',
          content: 'K15 cũng từng làm đề tài này. Nhớ chú ý hàm xoay kép Left-Right (LR) và Right-Left (RL), rất dễ bị rò rỉ bộ nhớ (memory leak) nếu không giải phóng đúng cách.',
          likesCount: 8
        }
      ]
    },
    {
      postType: 'resource_share',
      courseCode: 'IT102',
      facultyCode: 'FIT',
      preferredUsername: 'tranminhduc',
      title: 'Chia sẻ Boilerplate Next.js 15 App Router + NestJS + PostgreSQL pgvector chuẩn Monorepo',
      content: `Xin chào mọi người! 🎉\n\nSau kỳ làm đồ án PBL vừa rồi, mình đã tổng hợp lại toàn bộ kiến trúc mã nguồn thành một template Monorepo chuẩn chỉ cho anh em sinh viên Phenikaa làm bài tập lớn hoặc đồ án tốt nghiệp.\n\n### 🚀 Các tính năng tích hợp sẵn:\n1. **Turborepo** quản lý multi-package (\`@pu/web\`, \`@pu/api\`, \`@pu/schemas\`).\n2. **Zustand v5** với Pattern tách Slice nguyên tử (Zero Unnecessary Re-render).\n3. **PostgreSQL 16 + pgvector** hỗ trợ Vector Search cho RAG AI.\n4. **GraphQL Apollo + REST API** đầy đủ xác thực Passport Local Session & JWT.\n5. **Tailwind CSS v4 + Radix UI** hỗ trợ Dark/Light mode chuẩn semantic tokens.\n\nLink GitHub repo và tài liệu hướng dẫn đã được cập nhật trên trang cá nhân của mình. Chúc mọi người code mượt mà! 🔥`,
      tags: ['IT102', 'NextJS', 'NestJS', 'PostgreSQL', 'Monorepo', 'OpenSource'],
      daysAgo: 4,
      comments: [
        {
          authorUsername: 'hoangthuytrang',
          content: 'Quá xịn luôn anh Đức ơi! Phần xử lý Zustand Slice dùng chuẩn bài luôn, đỡ bị re-render toàn bộ feed.',
          likesCount: 12
        },
        {
          authorUsername: 'gv_nguyenvanha',
          authorRole: 'lecturer',
          content: 'Rất hoan nghênh tinh thần chia sẻ kiến thức của em Đức. Thầy sẽ gửi link template này cho các bạn K17 tham khảo trong môn Lập trình Web nâng cao.',
          likesCount: 24,
          isSolution: true
        }
      ]
    },
    {
      postType: 'pbl_recruitment',
      courseCode: 'CS201',
      facultyCode: 'FCS',
      preferredUsername: 'nguyenducthong',
      title: '[PBL3 - FCS] Tuyển 02 thành viên làm đồ án "Hệ thống RAG Tra cứu Quy chế Đào tạo Phenikaa"',
      content: `Chào các bạn sinh viên K16, K17 Khoa Khoa học Máy tính & AI!\n\nNhóm mình hiện có 2 người (đều K16 FCS) đang chuẩn bị làm đồ án PBL3 với đề tài:\n**"Xây dựng Trợ lý ảo AI hỏi đáp Quy chế & Sổ tay Sinh viên Phenikaa dựa trên RAG (Retrieval-Augmented Generation)"**.\n\n### 🎯 Yêu cầu ứng viên:\n- **01 bạn AI Engineer:** Nắm vững LangChain/LlamaIndex, kỹ thuật Chunking văn bản tiếng Việt, tính Cosine Similarity trên pgvector.\n- **01 bạn Frontend/UI:** Sử dụng Next.js, Tailwind CSS, biết tạo chat widget streaming Markdown realtime.\n\n### 💡 Lợi ích khi tham gia:\n- Đồ án được hướng dẫn trực tiếp bởi PGS.TS Trần Thị Thu.\n- Có cơ hội phát triển thành bài báo NCKH sinh viên cấp Trường.\n\nBạn nào quan tâm comment bên dưới hoặc nhắn tin trực tiếp cho mình nhé!`,
      tags: ['CS201', 'PBL3', 'FCS', 'AI', 'RAG', 'TuyenThanhVien'],
      daysAgo: 5,
      comments: [
        {
          authorUsername: 'lequocanh',
          content: 'Em K17 AI đã từng làm qua LangChain và Embeddings với OpenAI API, xin 1 slot chân AI Engineer với anh Thông ơi!',
          likesCount: 6
        },
        {
          authorUsername: 'buithuhuong',
          content: 'Mình làm Figma UI/UX và Next.js Frontend đây, mình gửi portfolio qua message cho bạn nhé!',
          likesCount: 5
        }
      ]
    },
    {
      postType: 'question',
      courseCode: 'CS202',
      facultyCode: 'FCS',
      preferredUsername: 'tranphuonglinh',
      title: 'Hỏi về kỹ thuật Fine-tuning QLoRA mô hình Llama-3-8B-Instruct trên GPU 16GB VRAM',
      content: `Mọi người cho mình hỏi về lỗi **CUDA Out of Memory (OOM)** khi fine-tune Llama 3 8B với thư viện \`unsloth\` và \`peft\` trên card RTX 4080 (16GB VRAM).\n\nMặc dù mình đã đặt:\n- \`load_in_4bit = True\`\n- \`r = 16\`, \`lora_alpha = 32\`\n- \`per_device_train_batch_size = 2\`\n- \`gradient_accumulation_steps = 4\`\n\nNhưng cứ khi chạy qua chuỗi context dài hơn 2048 tokens là bị tràn VRAM. Có kỹ thuật nào như Flash Attention 2 hay Gradient Checkpointing giúp giải phóng thêm bộ nhớ không ạ?\n\n\`\`\`python\nfrom unsloth import FastLanguageModel\nmodel, tokenizer = FastLanguageModel.from_pretrained(\n    model_name = "unsloth/llama-3-8b-Instruct-bnb-4bit",\n    max_seq_length = 2048,\n    load_in_4bit = True,\n)\n\`\`\``,
      tags: ['CS202', 'NLP', 'LLM', 'QLoRA', 'PyTorch', 'GPU'],
      daysAgo: 6,
      comments: [
        {
          authorUsername: 'nguyenducthong',
          content: 'Linh bật `use_gradient_checkpointing = "unsloth"` và dùng `Flash Attention 2` là giảm được gần 3GB VRAM đấy. Ngoài ra nhớ set `optim = "adamw_8bit"` thay vì adamw mặc định nhé!',
          isSolution: true,
          likesCount: 14
        },
        {
          authorUsername: 'gv_tranthithu',
          authorRole: 'lecturer',
          content: 'Phòng Lab AI của khoa hiện có cụm GPU Server A100 80GB phục vụ NCKH. Nhóm nghiên cứu của em có thể đăng ký tài khoản qua email khoa để train nhé.',
          likesCount: 30
        }
      ]
    },
    {
      postType: 'announcement',
      courseCode: 'IT106',
      facultyCode: 'FIT',
      authorRole: 'lecturer',
      preferredUsername: 'gv_nguyenvanha',
      title: '[Khoa CNTT] Thông báo lịch nộp Báo cáo Tiến độ Đồ án Tốt nghiệp K15 (Đợt 1 - 2026)',
      content: `Kính gửi toàn thể sinh viên K15 Khoa Công nghệ Thông tin đang thực hiện Đồ án Tốt nghiệp!\n\nKhoa thông báo kế hoạch kiểm tra tiến độ Đợt 1 như sau:\n\n### 📅 Thời gian & Hình thức nộp:\n- **Hạn chót:** 23h59 ngày 15/03/2026.\n- **Hồ sơ gồm:**\n  1. Báo cáo tiến độ (PDF theo mẫu chuẩn của Trường).\n  2. Link Git Repository (chứa mã nguồn và tài liệu kiến trúc SRS/SDD).\n  3. Video Demo ngắn 3-5 phút các chức năng đã hoàn thành.\n\n### ⚠️ Lưu ý quan trọng:\n- Sinh viên không nộp báo cáo đúng hạn sẽ bị trừ điểm tiến độ theo quy chế.\n- Mọi thắc mắc liên hệ Trợ giảng hoặc Giáo viên hướng dẫn qua hệ thống PU Connector.\n\nChúc các em hoàn thành tốt đồ án!`,
      tags: ['FIT', 'DoAnTotNghiep', 'K15', 'ThongBao', 'TienDo'],
      daysAgo: 7,
      comments: [
        {
          authorUsername: 'dothanhtung',
          content: 'Dạ chúng em cảm ơn thầy! Nhóm em đang gấp rút hoàn thiện phần tích hợp thanh toán VNPAY để demo ạ.',
          likesCount: 9
        },
        {
          authorUsername: 'nguyenngoctuyen',
          content: 'Thầy cho em hỏi phần Video Demo có cần up lên YouTube Unlisted hay đính kèm link Google Drive là được ạ?',
          replies: [
            {
              authorUsername: 'gv_nguyenvanha',
              authorRole: 'lecturer',
              content: 'Em đính kèm link YouTube Unlisted hoặc Google Drive (mở quyền xem) vào file PDF nộp lên hệ thống là được nhé.'
            }
          ]
        }
      ]
    },

    // --- FEE & FAE (Robotics, IoT, Ô tô, Phenikaa-X) ---
    {
      postType: 'resource_share',
      courseCode: 'EE203',
      facultyCode: 'FEE',
      preferredUsername: 'dovanphuc',
      title: 'Tổng hợp sơ đồ nguyên lý mạch điều khiển Motor Driver MOSFET công suất cao cho Robocon',
      content: `Gửi anh em CLB Robocon Phenikaa và các bạn học môn **Kỹ thuật Robot (EE203)**!\n\nSau khi thử nghiệm nhiều phiên bản mạch cầu H, mình đã vẽ lại sơ đồ nguyên lý hoàn chỉnh sử dụng cặp MOSFET N-Channel **IRFB7430** kết hợp Driver **IR2104** có cách ly quang Opto PC817.\n\n### ⚡ Thông số kỹ thuật:\n- Điện áp hoạt động: 12V - 36V DC.\n- Dòng điện liên tục: 30A (tản nhiệt nhôm cơ bản).\n- Tần số PWM đáp ứng: lên tới 20kHz không bị méo dạng sóng.\n- Tích hợp bảo vệ quá nhiệt và diode dập xung ngược (Flyback Diode).\n\nFile CAD KiCAD và Gerber sẵn sàng để đặt mạch tại xưởng A3. Mời anh em tải về dùng thử! 🚀`,
      tags: ['EE203', 'Robocon', 'FEE', 'MOSFET', 'KiCAD', 'Hardware'],
      daysAgo: 8,
      comments: [
        {
          authorUsername: 'gv_lequangthang',
          authorRole: 'lecturer',
          content: 'Thiết kế rất chỉn chu em Phúc. Lưu ý thêm tụ lọc nguồn Low ESR gần chân công suất để giảm gai điện áp khi đảo chiều động cơ đột ngột nhé.',
          isSolution: true,
          likesCount: 18
        },
        {
          authorUsername: 'buiminhhoang',
          content: 'Cảm ơn Phúc! Nhóm mình đang cần mạch driver này cho bài tập lớn xe bám line tốc độ cao.',
          likesCount: 5
        }
      ]
    },
    {
      postType: 'question',
      courseCode: 'FAE103',
      facultyCode: 'FAE',
      preferredUsername: 'lethanhlong',
      title: 'Hỏi về giải thuật NDT Matching trong gói Autoware.Universe trên xe tự hành Phenikaa-X',
      content: `Chào mọi người! 👋\n\nNhóm nghiên cứu xe tự hành Phenikaa-X của mình đang gặp vấn đề định vị ở khu vực đường nội bộ giữa Tòa A2 và Tòa A3 (nơi có nhiều cây xanh và tán lá rung động):\n- Dữ liệu Point Cloud từ LiDAR 32-beam khi chạy qua thuật toán **NDT (Normal Distributions Transform) Matching** bị drift tọa độ khoảng 0.5 - 1.2 mét.\n- Khi xe chuyển động với vận tốc trên 20km/h thì độ trễ ước lượng tư thế (Pose Estimation) tăng lên rõ rệt.\n\nCó anh chị nào đã tích hợp EKF (Extended Kalman Filter) kết hợp giữa IMU tần số 200Hz và GNSS-RTK để bù sai số này chưa ạ? Cho em xin ít kinh nghiệm thực tế với ạ!`,
      tags: ['FAE103', 'AutonomousVehicle', 'PhenikaaX', 'LiDAR', 'ROS2', 'Autoware'],
      daysAgo: 9,
      comments: [
        {
          authorUsername: 'tranquocbao',
          content: 'Long thử giảm voxel size xuống 0.2m khi downsample pointcloud bằng VoxelGrid filter xem sao. Với lại nhớ filter bớt các điểm phản xạ động từ tán cây trước khi đưa vào NDT nhé.',
          likesCount: 11
        },
        {
          authorUsername: 'vumanhcuong',
          content: 'Đợt trước bên Phenikaa-X dùng thêm thuật toán Point-to-Plane ICP kết hợp Odom xe là chạy mượt hơn hẳn NDT thuần túy đấy.',
          isSolution: true,
          likesCount: 14
        }
      ]
    },

    // --- FBA (Kinh tế, Marketing, Logistics) ---
    {
      postType: 'resource_share',
      courseCode: 'FBA101',
      facultyCode: 'FBA',
      preferredUsername: 'dangthuha',
      title: 'Slide & Phân tích Case Study: Chiến lược Marketing hỗn hợp 4P của chuỗi bán lẻ WinCommerce',
      content: `Dành cho các bạn K16, K17 đang học môn **Nguyên lý Marketing (FBA101)**!\n\nMình xin chia sẻ bài tập lớn phân tích ma trận BCG, SWOT và chiến lược 4P (Product, Price, Place, Promotion) của hệ thống siêu thị WinMart+ đã đạt điểm A trong kỳ trước.\n\n### 📊 Nội dung chính của bài báo cáo:\n1. Phân tích phân khúc khách hàng mục tiêu tại các khu đô thị vệ tinh phía Tây Hà Nội.\n2. Chiến lược giá xâm nhập thị trường (Penetration Pricing) và chính sách hội viên Win.\n3. Ứng dụng chuyển đổi số và Loyalty App trong việc tăng tỷ lệ quay lại mua sắm (Retention Rate).\n\nHy vọng tài liệu sẽ giúp ích cho các nhóm đang lên ý tưởng thuyết trình! ❤️`,
      tags: ['FBA101', 'Marketing', 'CaseStudy', 'FBA', 'Presentation', 'TaiLieu'],
      daysAgo: 10,
      comments: [
        {
          authorUsername: 'buingocanh',
          content: 'Tài liệu cực kỳ chi tiết, phần phân tích ma trận SWOT làm rất sắc bén luôn Hà ơi!',
          likesCount: 7
        },
        {
          authorUsername: 'dophuongthao',
          content: 'Cảm ơn bạn nhiều, nhóm mình đang cần mẫu tham khảo cách trình bày biểu đồ doanh thu.',
          likesCount: 4
        }
      ]
    },
    {
      postType: 'question',
      courseCode: 'FBA103',
      facultyCode: 'FBA',
      preferredUsername: 'dophuongthao',
      title: 'Hỏi về cách tính chi phí lưu kho tối ưu trong bài toán Quản trị Chuỗi cung ứng (Mô hình EOQ)',
      content: `Mọi người cho mình hỏi câu hỏi bài tập môn **Quản trị Chuỗi cung ứng & Logistics (FBA103)**:\n\nĐề bài: Một doanh nghiệp phân phối thiết bị y tế có nhu cầu hàng năm $D = 12,000$ sản phẩm. Chi phí đặt hàng mỗi lần $S = 500,000$ VNĐ, chi phí lưu kho mỗi đơn vị sản phẩm một năm $H = 20,000$ VNĐ.\n\nCông thức tính lượng đặt hàng kinh tế:\n$$EOQ = \\sqrt{\\frac{2DS}{H}} = \\sqrt{\\frac{2 \\times 12000 \\times 500000}{20000}} = 774.6 \\approx 775 \\text{ sp}$$\n\nNếu nhà cung cấp đưa ra chiết khấu số lượng: Mua từ 1,000 sản phẩm trở lên được giảm giá 5% trên đơn giá $P = 100,000$ VNĐ/sp, thì tổng chi phí hàng năm (Total Cost) trong trường hợp nhận chiết khấu có thấp hơn khi mua theo $EOQ$ không ạ? Nhờ các bạn giải thích giúp mình các bước so sánh với ạ!`,
      tags: ['FBA103', 'Logistics', 'EOQ', 'SupplyChain', 'Math'],
      daysAgo: 11,
      comments: [
        {
          authorUsername: 'nguyenquangdat',
          content: 'Thảo tính $TC = (D \\times P) + \\left(\\frac{D}{Q} \\times S\\right) + \\left(\\frac{Q}{2} \\times H\\right)$. So sánh $TC(Q=775)$ với $TC(Q=1000, P=95000)$. Phần tiết kiệm 5% giá mua $(12000 \\times 5000 = 60 \\text{ triệu})$ lớn hơn nhiều so với phần tăng chi phí lưu kho, nên nhận chiết khấu sẽ có lợi hơn nhé!',
          isSolution: true,
          likesCount: 16
        }
      ]
    },

    // --- FEL (Ngoại ngữ, IELTS) ---
    {
      postType: 'resource_share',
      courseCode: 'FEL101',
      facultyCode: 'FEL',
      preferredUsername: 'lethanhhuong',
      title: 'Lộ trình tự học IELTS từ 5.5 lên 7.5 trong 6 tháng dành cho sinh viên Phenikaa',
      content: `Chào các bạn sinh viên Phenikaa! 🇬🇧\n\nNhiều bạn khối Kỹ thuật và Kinh tế hỏi mình về phương pháp tự ôn IELTS để đạt chuẩn đầu ra và săn học bổng du học, nên mình tổng hợp lại toàn bộ lộ trình mình đã áp dụng để đạt IELTS 8.0 (Listening 8.5, Reading 8.5, Writing 7.5, Speaking 7.5).\n\n### 📌 3 Giai đoạn cốt lõi:\n1. **Tháng 1-2: Xây nền từ vựng & Ngữ pháp học thuật**\n   - Học bộ từ vựng Academic Word List (AWL) qua app Anki.\n   - Luyện nghe thụ động qua podcast BBC 6 Minute English & TED Talks.\n2. **Tháng 3-4: Luyện đề Cam 14-19 theo dạng bài**\n   - Tập trung Matching Headings, True/False/Not Given trong Reading.\n   - Luyện Dictation (chép chính tả) cho Listening Section 3 & 4.\n3. **Tháng 5-6: Tăng tốc Writing & Speaking**\n   - Luyện viết Task 2 theo 5 dạng bài chuẩn (Opinion, Discussion, Problem-Solution...).\n   - Tham gia CLB Phenikaa English Zone để luyện phản xạ nói tự nhiên mỗi tuần.\n\nLink tải trọn bộ tài liệu PDF và audio mình đính kèm ở dưới. Chúc mọi người ôn thi hiệu quả!`,
      tags: ['FEL101', 'IELTS', 'FEL', 'English', 'StudyTips', 'TaiLieu'],
      daysAgo: 12,
      comments: [
        {
          authorUsername: 'hoangtuanminh',
          content: 'Bài viết cực kỳ tâm huyết chị Hương ơi! Mời chị tuần này sang làm diễn giả khách mời cho CLB English Zone nhé!',
          likesCount: 15
        },
        {
          authorUsername: 'phamquanghuy',
          content: 'Sinh viên IT đang cày tiếng Anh đọc bài này như vớ được vàng. Cảm ơn bạn rất nhiều!',
          likesCount: 9
        }
      ]
    },

    // --- FAS & FMS (Vật liệu, Y Dược, Lâm sàng) ---
    {
      postType: 'question',
      courseCode: 'FMS101',
      facultyCode: 'FMS',
      preferredUsername: 'phamquangdai',
      title: 'Ca lâm sàng trao đổi: Nhận định đoạn ST chênh lên trên chuyển đạo DII, DIII, aVF',
      content: `Chào các bạn sinh viên Y khoa K16, K17!\n\nTrong buổi trực đêm qua tại Khoa Cấp cứu Bệnh viện Đại học Phenikaa, nhóm mình tiếp nhận bệnh nhân nam 58 tuổi, vào viện vì đau thắt ngực trái dữ dội lan ra sau lưng, vã mồ hôi kéo dài trên 30 phút.\n\nKết quả đo Điện tâm đồ (ECG) 12 chuyển đạo ghi nhận:\n- ST chênh lên dạng vòm $> 2mm$ ở các chuyển đạo **DII, DIII, aVF**.\n- ST chênh xuống soi gương ở **DI, aVL**.\n\nTheo giải phẫu động mạch vành, tổn thương này gợi ý tắc nghẽn nhánh động mạch nào nhiều nhất (Động mạch vành phải - RCA hay Nhánh mũ - LCx)? Nhờ các anh chị K15 và bác sĩ nội trú cùng thảo luận nhé!`,
      tags: ['FMS101', 'Medical', 'ECG', 'Cardiology', 'LamSang', 'PhenikaaHospital'],
      daysAgo: 13,
      comments: [
        {
          authorUsername: 'buivanloc',
          content: 'Với hình ảnh ST chênh lên ở thành dưới (DII, DIII, aVF) kèm ST chênh ở DIII > DII và ST chênh xuống ở DI, aVL thì khả năng cao $> 90\\%$ là tắc **Động mạch vành phải (RCA)** nhé Đại. Cần đo thêm các chuyển đạo V3R, V4R để loại trừ nhồi máu thất phải đi kèm trước khi chỉ định Nitroglycerin.',
          isSolution: true,
          likesCount: 22
        },
        {
          authorUsername: 'vutronghieu',
          content: 'Phân tích rất chuẩn xác! Cảm ơn anh Lộc đã nhắc nhở điểm lưu ý sống còn về đo V3R-V4R.',
          likesCount: 8
        }
      ]
    },
    {
      postType: 'resource_share',
      courseCode: 'FAS101',
      facultyCode: 'FAS',
      preferredUsername: 'buiducthanh',
      title: 'Tổng hợp tài liệu & Video mô phỏng cấu trúc tinh thể mạng lập phương tâm diện (FCC) và tâm khối (BCC)',
      content: `Gửi các bạn sinh viên Khoa Khoa học & Kỹ thuật Vật liệu (FAS)!\n\nĐể giúp các bạn dễ hình dung không gian mạng tinh thể trong môn **Khoa học Vật liệu (FAS101)**, mình đã dựng lại mô hình 3D tương tác của các cấu trúc tinh thể phổ biến:\n\n1. **Simple Cubic (SC):** Số phối vị $CN = 6$, hệ số xếp chặt $APF = 0.52$.\n2. **Body-Centered Cubic (BCC):** Số phối vị $CN = 8$, hệ số xếp chặt $APF = 0.68$.\n3. **Face-Centered Cubic (FCC):** Số phối vị $CN = 12$, hệ số xếp chặt $APF = 0.74$.\n4. **Hexagonal Close-Packed (HCP):** Hệ số xếp chặt $APF = 0.74$.\n\nFile 3D có thể mở trực tiếp trên trình duyệt hoặc phần mềm VESTA. Chúc các bạn học tốt! 🧪`,
      tags: ['FAS101', 'MaterialScience', 'Crystallography', 'FAS', 'Nano', 'TaiLieu'],
      daysAgo: 14,
      comments: [
        {
          authorUsername: 'dongocminh',
          content: 'Mô hình 3D xoay nhìn trực quan hơn hình vẽ trong giáo trình nhiều. Cảm ơn bạn Thành!',
          likesCount: 6
        }
      ]
    },

    // --- Campus Life, Đời sống Sinh viên, Tuyến Bus, KTX ---
    {
      postType: 'general',
      facultyCode: 'FIT',
      preferredUsername: 'danghaianh',
      title: 'Review chi tiết tuyến xe bus điện Phenikaa (Metro Yên Nghĩa ⇄ Trường) và mẹo đi lại cho tân sinh viên',
      content: `Chào các bạn sinh viên Phenikaa! 🚌\n\nMình thấy nhiều bạn K17, K18 mới nhập học còn bỡ ngỡ về cách di chuyển đến trường, nên mình viết bài chia sẻ kinh nghiệm đi lại thuận tiện nhất:\n\n### ⚡ 1. Tuyến Xe Bus Điện Phenikaa (Miễn phí):\n- Điểm đón: Ngay chân cầu thang Lối ra số 2 Ga Metro Yên Nghĩa (Tuyến Cát Linh - Hà Đông).\n- Tần suất: 10-15 phút/chuyến vào giờ cao điểm (6h30 - 8h30 và 16h30 - 18h30), 20 phút/chuyến giờ thấp điểm.\n- Điều hòa mát lạnh, xe chạy êm ru không mùi xăng dầu.\n\n### 🚍 2. Các tuyến xe bus công cộng trợ giá Hà Nội:\n- **Tuyến 01:** Bến xe Gia Lâm ⇄ Bến xe Yên Nghĩa.\n- **Tuyến 19:** Trần Khánh Dư ⇄ Học viện Chính sách và Phát triển (đi qua cổng trường).\n- **Tuyến 21A:** Bến xe Giáp Bát ⇄ Bến xe Yên Nghĩa.\n\nAi có câu hỏi gì về đường đi thì comment mình chỉ đường tận tình nhé! 😄`,
      tags: ['CampusLife', 'PhenikaaBus', 'MetroCatLinh', 'YenNghia', 'SinhVien'],
      daysAgo: 15,
      comments: [
        {
          authorUsername: 'hoangngocdiep',
          content: 'Em K18 tân sinh viên cảm ơn anh nhiều ạ! Đi tàu điện trên cao xong xuống bắt bus điện của trường tiện thật sự.',
          likesCount: 11
        },
        {
          authorUsername: 'vudinhnam',
          content: 'Bác tài xe bus điện trường mình nhiệt tình lắm, hôm nào mưa to còn dừng sát sảnh A2 cho sinh viên đỡ ướt.',
          likesCount: 14
        }
      ]
    },
    {
      postType: 'general',
      facultyCode: 'FIT',
      preferredUsername: 'pu_admin_lead',
      authorRole: 'admin',
      title: 'Chào mừng các bạn đến với PU Connector - Nền tảng Học tập & Kết nối Sinh viên Phenikaa',
      content: `🎉 **Chào mừng toàn thể Giảng viên và Sinh viên Đại học Phenikaa!**\n\n**PU Connector** là không gian số được xây dựng nhằm thúc đẩy văn hóa học tập, nghiên cứu và trao đổi học thuật sôi nổi trong toàn trường.\n\n### 🌟 Các phân hệ nổi bật:\n- **Bảng tin Học thuật & Q&A:** Đặt câu hỏi, thảo luận đồ án và nhận câu trả lời từ Giảng viên & Trợ giảng.\n- **Kho Tri thức & Đề thi:** Tìm kiếm slide, đề thi cũ và tài liệu học tập có gắn nhãn phân loại theo từng học phần.\n- **Ghép nhóm PBL & NCKH:** Tìm đồng đội cùng chí hướng để thực hiện đồ án, tham gia Robocon, Hackathon.\n- **Nhịp sống Phenikaa:** Cập nhật thông báo đào tạo, sự kiện CLB, thông tin nhà trọ và xe bus.\n\nChúc các bạn có những trải nghiệm học tập và kết nối tuyệt vời tại Phenikaa University! 🚀`,
      tags: ['PUConnector', 'PhenikaaUniversity', 'ThongBao', 'Welcome', 'Community'],
      daysAgo: 20,
      comments: [
        {
          authorUsername: 'gv_nguyenvanha',
          authorRole: 'lecturer',
          content: 'Chúc mừng hệ thống đã chính thức đi vào hoạt động! Đây sẽ là kênh hỗ trợ đắc lực cho sinh viên trong các kỳ đồ án môn học.',
          likesCount: 35
        },
        {
          authorUsername: 'tranminhduc',
          content: 'Giao diện mượt và đẹp xuất sắc, cảm ơn BQT!',
          likesCount: 20
        }
      ]
    }
  ]

  // Now, programmatically generate additional ~260 diverse realistic posts to reach ~280+ total
  const additionalTopics = [
    // Tech & Coding
    {
      faculty: 'FIT',
      course: 'IT101',
      type: 'question' as const,
      tagSet: ['IT101', 'Recursion', 'Backtracking', 'Cpp'],
      titleGen: (n: number) => `Cách khử đệ quy cho bài toán Tháp Hà Nội và Quay lui N-Queens (Mã môn IT101 - Bài #${n})`,
      contentGen: () => `Mọi người cho mình hỏi về cách chuyển đổi hàm đệ quy sang sử dụng cấu trúc \`std::stack\` thủ công để tránh lỗi tràn ngăn xếp (Stack Overflow) khi $N > 30$. Nhờ thầy cô và các bạn cho ý kiến tối ưu memory.`
    },
    {
      faculty: 'FIT',
      course: 'IT102',
      type: 'resource_share' as const,
      tagSet: ['IT102', 'TailwindCSS', 'React', 'Frontend'],
      titleGen: (n: number) => `Bộ Component UI mẫu chuẩn Accessibility (a11y) bằng Radix UI & Tailwind cho đồ án Web #${n}`,
      contentGen: () => `Chia sẻ cho các bạn K16, K17 bộ UI Kit gồm Dialog, Dropdown, Accordion, Toast thông báo đã tối ưu tương thích bàn phím và Screen Reader. Có hỗ trợ Dark/Light Theme đồng bộ.`
    },
    {
      faculty: 'FIT',
      course: 'IT103',
      type: 'question' as const,
      tagSet: ['IT103', 'PostgreSQL', 'Index', 'Database'],
      titleGen: (n: number) => `Phân tích hiệu năng Query Execution Plan: Seq Scan vs Index Scan trong PostgreSQL #${n}`,
      contentGen: () => `Khi bảng có hơn 500,000 dòng, truy vấn \`EXPLAIN ANALYZE SELECT * FROM users WHERE faculty = 'FIT'\` vẫn chọn Sequential Scan thay vì dùng Index. Mọi người giải thích giúp mình tại sao Cost ước lượng của Planner lại ưu tiên Seq Scan trong trường hợp này?`
    },
    {
      faculty: 'FIT',
      course: 'IT104',
      type: 'question' as const,
      tagSet: ['IT104', 'OOP', 'Java', 'DesignPatterns'],
      titleGen: (n: number) => `Ứng dụng Factory Pattern và Singleton Pattern trong bài tập quản lý tài khoản ngân hàng #${n}`,
      contentGen: () => `Nhóm mình đang thiết kế các lớp đối tượng theo nguyên lý SOLID. Cho mình hỏi khi nào nên áp dụng Abstract Factory thay vì Simple Factory trong mô hình nạp rút tiền đa cổng thanh toán?`
    },
    {
      faculty: 'FIT',
      course: 'IT105',
      type: 'pbl_recruitment' as const,
      tagSet: ['IT105', 'Mobile', 'Flutter', 'PBL', 'TuyenThanhVien'],
      titleGen: (n: number) => `[Tuyển Team] Tìm bạn làm Mobile App Flutter kết nối Firebase & Socket.IO cho dự án Smart Campus #${n}`,
      contentGen: () => `Nhóm K16 đã có Backend NestJS và thiết kế Figma hoàn chỉnh. Cần tuyển 01 bạn làm Mobile Flutter phụ trách module Chat thời gian thực và Push Notification qua Expo/FCM.`
    },
    {
      faculty: 'FIT',
      course: 'IT106',
      type: 'resource_share' as const,
      tagSet: ['IT106', 'Docker', 'DevOps', 'Nginx', 'CI_CD'],
      titleGen: (n: number) => `Hướng dẫn cấu hình Docker Multi-stage Build tối ưu dung lượng Node.js Container từ 1.2GB xuống 140MB #${n}`,
      contentGen: () => `Chia sẻ file \`Dockerfile\` tối ưu dùng \`node:20-alpine\`, tách riêng giai đoạn \`deps\`, \`builder\`, và \`runner\` giúp giảm thời gian build image trên GitHub Actions từ 6 phút xuống còn 45 giây.`
    },
    {
      faculty: 'FCS',
      course: 'CS201',
      type: 'question' as const,
      tagSet: ['CS201', 'MachineLearning', 'Python', 'ScikitLearn'],
      titleGen: (n: number) => `Hiện tượng Overfitting khi huấn luyện mô hình Random Forest trên tập dữ liệu nhỏ #${n}`,
      contentGen: () => `Mô hình của mình đạt accuracy 99% trên tập Train nhưng chỉ được 72% trên tập Test. Mình đã thử điều chỉnh \`max_depth=10\`, \`min_samples_split=5\` và dùng K-Fold Cross Validation. Có thêm phương pháp nào như Regularization hay Data Augmentation hiệu quả hơn không ạ?`
    },
    {
      faculty: 'FCS',
      course: 'CS202',
      type: 'resource_share' as const,
      tagSet: ['CS202', 'NLP', 'BERT', 'Transformer', 'HuggingFace'],
      titleGen: (n: number) => `Tổng hợp tập dữ liệu và mã nguồn phân loại sắc thái bình luận tiếng Việt (PhoBERT) #${n}`,
      contentGen: () => `Bộ code mẫu dùng thư viện HuggingFace Transformers kết hợp PhoBERT tiền huấn luyện để phân loại cảm xúc tích cực/tiêu cực từ 20,000 đánh giá sản phẩm. Đạt F1-score 91.4%.`
    },
    {
      faculty: 'FCS',
      course: 'CS203',
      type: 'question' as const,
      tagSet: ['CS203', 'ComputerVision', 'OpenCV', 'YOLOv8'],
      titleGen: (n: number) => `Cách tăng FPS khi chạy mô hình nhận diện khuôn mặt YOLOv8n trên vi máy tính Raspberry Pi 4 #${n}`,
      contentGen: () => `Hiện tại khi chạy OpenCV trên Raspberry Pi 4 chỉ đạt khoảng 6-8 FPS. Nếu xuất mô hình sang định dạng ONNX Runtime hoặc NCNN thì có thể đạt mức 20-25 FPS thời gian thực không ạ?`
    },
    {
      faculty: 'FCS',
      course: 'CS204',
      type: 'resource_share' as const,
      tagSet: ['CS204', 'BigData', 'PySpark', 'DataMining'],
      titleGen: (n: number) => `Cheat Sheet PySpark DataFrame API & Thuật toán phân cụm K-Means phân tích dữ liệu lớn #${n}`,
      contentGen: () => `Tài liệu tổng hợp các thao tác chuyển đổi \`groupBy\`, \`agg\`, \`window function\` và xây dựng Pipeline tiền xử lý dữ liệu với \`VectorAssembler\` trong Apache Spark.`
    },

    // FEE & FAE (Robotics, IoT, Automotive)
    {
      faculty: 'FEE',
      course: 'EE201',
      type: 'question' as const,
      tagSet: ['EE201', 'Electronics', 'OpAmp', 'Circuit'],
      titleGen: (n: number) => `Tính toán độ lợi khuếch đại mạch vi sai dùng Op-Amp LM358 và lọc thông thấp #${n}`,
      contentGen: () => `Mọi người cho mình hỏi về công thức xác định tần số cắt $f_c = \\frac{1}{2\\pi R C}$ khi tín hiệu cảm biến sinh học bị nhiễu sóng 50Hz từ lưới điện xoay chiều. Cần chọn giá trị R và C như thế nào để vừa khử nhiễu vừa không làm méo biên độ tín hiệu?`
    },
    {
      faculty: 'FEE',
      course: 'EE202',
      type: 'resource_share' as const,
      tagSet: ['EE202', 'IoT', 'ESP32', 'FreeRTOS', 'MQTT'],
      titleGen: (n: number) => `Thư viện kết nối ESP32 với AWS IoT Core và MQTT Broker có mã hóa TLS 1.2 #${n}`,
      contentGen: () => `Chia sẻ mã nguồn C++ cho ESP32 tự động reconnect khi mất mạng WiFi, lưu trữ dữ liệu cảm biến vào bộ nhớ SPIFFS khi offline và tự đồng bộ khi có kết nối trở lại.`
    },
    {
      faculty: 'FEE',
      course: 'EE203',
      type: 'pbl_recruitment' as const,
      tagSet: ['EE203', 'Robocon', 'PBL', 'Hardware', 'FEE'],
      titleGen: (n: number) => `[Đội Robocon Phenikaa] Tuyển thành viên cơ khí và điều khiển tay gắp tự động #${n}`,
      contentGen: () => `CLB Robocon đang chế tạo mẫu robot cơ động mới cho cuộc thi sắp tới. Cần tuyển 02 bạn chuyên ngành Cơ điện tử / Tự động hóa biết vẽ SolidWorks và lập trình STM32.`
    },
    {
      faculty: 'FAE',
      course: 'FAE101',
      type: 'question' as const,
      tagSet: ['FAE101', 'Automotive', 'Engine', 'Chassis'],
      titleGen: (n: number) => `Phân tích ưu nhược điểm của hệ thống phun xăng trực tiếp GDI so với phun đa điểm MPI #${n}`,
      contentGen: () => `Em đang làm chuyên đề môn Động cơ đốt trong. Thầy cô và các anh chị cho em hỏi về vấn đề bám muội than trên van nạp của động cơ GDI và các giải pháp kỹ thuật hiện đại của các hãng xe để khắc phục hiện tượng này ạ?`
    },
    {
      faculty: 'FAE',
      course: 'FAE102',
      type: 'resource_share' as const,
      tagSet: ['FAE102', 'ElectricVehicle', 'BMS', 'Battery', 'EV'],
      titleGen: (n: number) => `Tài liệu mô hình hóa suy giảm dung lượng Pin Lithium-ion (NMC vs LFP) theo chu kỳ sạc xả #${n}`,
      contentGen: () => `Chia sẻ bài báo khoa học và file mô phỏng Matlab Simulink về thuật toán ước lượng trạng thái sạc SOC (State of Charge) sử dụng Extended Kalman Filter.`
    },
    {
      faculty: 'FAE',
      course: 'FAE103',
      type: 'resource_share' as const,
      tagSet: ['FAE103', 'PhenikaaX', 'SelfDriving', 'CANBus'],
      titleGen: (n: number) => `Hướng dẫn đọc và giải mã gói tin mạng truyền thông CAN Bus trên hệ thống lái ô tô điện #${n}`,
      contentGen: () => `Tài liệu hướng dẫn dùng vi điều khiển STM32 kết hợp IC thu phát TJA1050 để bắt dữ liệu tốc độ bánh xe, góc lái vô lăng và nhiệt độ pack pin.`
    },

    // FBA (Business, Marketing, Finance, Logistics)
    {
      faculty: 'FBA',
      course: 'FBA101',
      type: 'resource_share' as const,
      tagSet: ['FBA101', 'Marketing', 'DigitalMarketing', 'SEO', 'TikTok'],
      titleGen: (n: number) => `Bí quyết xây dựng nội dung ngắn (Short-form Video) thu hút triệu view cho các thương hiệu F&B #${n}`,
      contentGen: () => `Phân tích thuật toán đề xuất video, kỹ thuật Hook 3 giây đầu tiên và cách gắn CTA chuyển đổi đơn hàng hiệu quả cho các bạn sinh viên khởi nghiệp.`
    },
    {
      faculty: 'FBA',
      course: 'FBA102',
      type: 'question' as const,
      tagSet: ['FBA102', 'Finance', 'StockMarket', 'Valuation'],
      titleGen: (n: number) => `Phương pháp định giá cổ phiếu DCF (Discounted Cash Flow) so với phương pháp P/E, P/B #${n}`,
      contentGen: () => `Cho mình hỏi khi chi phí vốn bình quân gia quyền (WACC) thay đổi $1\\%$, giá trị nội tại ước tính của doanh nghiệp biến động như thế nào? Cách chọn tốc độ tăng trưởng dài hạn g hợp lý cho nền kinh tế đang phát triển?`
    },
    {
      faculty: 'FBA',
      course: 'FBA103',
      type: 'resource_share' as const,
      tagSet: ['FBA103', 'Logistics', 'Warehouse', 'ERP'],
      titleGen: (n: number) => `Tổng hợp quy trình quản lý kho hàng WMS theo nguyên tắc FIFO và mã vạch Barcode/RFID #${n}`,
      contentGen: () => `Chia sẻ sơ đồ luồng nhập hàng, kiểm đếm, lưu kho và xuất hàng chuẩn hóa dành cho sinh viên làm đề tài thực tập tại các trung tâm phân phối logistics.`
    },
    {
      faculty: 'FBA',
      course: 'FBA104',
      type: 'pbl_recruitment' as const,
      tagSet: ['FBA104', 'Ecommerce', 'Startup', 'Innovation', 'PBL'],
      titleGen: (n: number) => `[Dự án Khởi nghiệp] Tìm đồng đội xây dựng nền tảng trao đổi giáo trình cũ trong khuôn viên Phenikaa #${n}`,
      contentGen: () => `Nhóm cần tuyển 01 bạn chuyên ngành Thương mại điện tử phụ trách kế hoạch kinh doanh và 01 bạn Marketing chạy truyền thông nội bộ trường.`
    },

    // FEL (Languages, English, Chinese)
    {
      faculty: 'FEL',
      course: 'FEL101',
      type: 'resource_share' as const,
      tagSet: ['FEL101', 'IELTS', 'Writing', 'Vocabulary'],
      titleGen: (n: number) => `50 Cụm từ nâng cấp Band điểm từ 6.0 lên 7.5 trong bài thi IELTS Writing Task 2 #${n}`,
      contentGen: () => `Tổng hợp các cấu trúc câu phức, từ nối học thuật (Cohesive Devices) và các Collocation chuyên sâu theo từng chủ đề: Environment, Technology, Education và Health.`
    },
    {
      faculty: 'FEL',
      course: 'FEL102',
      type: 'resource_share' as const,
      tagSet: ['FEL102', 'EnglishForTech', 'Research', 'IEEE'],
      titleGen: (n: number) => `Cấu trúc chuẩn và các mẫu câu thông dụng khi viết bài báo NCKH bằng tiếng Anh #${n}`,
      contentGen: () => `Hướng dẫn chi tiết cách viết phần Abstract, Methodology, Results and Discussion chuẩn format IEEE/Elsevier không bị lỗi ngữ pháp hay từ ngữ văn nói.`
    },
    {
      faculty: 'FEL',
      course: 'FEL103',
      type: 'resource_share' as const,
      tagSet: ['FEL103', 'Chinese', 'HSK', 'Flashcards'],
      titleGen: (n: number) => `Bộ Flashcard Anki 1,200 từ vựng HSK 4 & HSK 5 kèm phiên âm Pinyin và câu ví dụ #${n}`,
      contentGen: () => `File deck Anki đã được chia theo cấp độ và chủ đề giao tiếp, có audio phát âm chuẩn Bắc Kinh giúp ghi nhớ nhanh chữ Hán.`
    },

    // FAS & FMS (Materials, Medical, Pharmacy)
    {
      faculty: 'FAS',
      course: 'FAS101',
      type: 'resource_share' as const,
      tagSet: ['FAS101', 'NanoTechnology', 'Materials', 'Chemistry'],
      titleGen: (n: number) => `Tổng hợp phương pháp tổng hợp hạt nano oxit kẽm (ZnO) kháng khuẩn ứng dụng trong bao bì y tế #${n}`,
      contentGen: () => `Báo cáo nghiên cứu tổng hợp hạt nano ZnO kích thước trung bình 25nm bằng phương pháp kết tủa hóa học, kiểm tra hoạt tính diệt khuẩn trên chủng E. coli.`
    },
    {
      faculty: 'FAS',
      course: 'FAS102',
      type: 'question' as const,
      tagSet: ['FAS102', 'SolarCell', 'Perovskite', 'Semiconductor'],
      titleGen: (n: number) => `Nguyên nhân suy giảm hiệu suất quang điện của pin mặt trời Perovskite dưới tác động của độ ẩm #${n}`,
      contentGen: () => `Khi tiếp xúc với độ ẩm không khí $> 60\\%$, lớp hấp thụ ánh sáng bị phân hủy thành $PbI_2$. Có những vật liệu đóng gói kỵ nước nào giúp kéo dài tuổi thọ pin trên 10 năm không ạ?`
    },
    {
      faculty: 'FMS',
      course: 'FMS101',
      type: 'resource_share' as const,
      tagSet: ['FMS101', 'Anatomy', 'Physiology', 'Medical', 'Flashcards'],
      titleGen: (n: number) => `Sơ đồ tư duy Giải phẫu 12 đôi dây thần kinh sọ não và chức năng chi phối #${n}`,
      contentGen: () => `Bản đồ Mindmap trực quan tóm tắt nguyên ủy, đường đi, phân nhánh và triệu chứng tổn thương lâm sàng của từng đôi dây thần kinh sọ.`
    },
    {
      faculty: 'FMS',
      course: 'FMS102',
      type: 'question' as const,
      tagSet: ['FMS102', 'Pharmacology', 'Antibiotics', 'Pharmacy'],
      titleGen: (n: number) => `Cơ chế kháng thuốc của vi khuẩn đối với nhóm kháng sinh Beta-lactam và giải pháp ức chế enzyme Beta-lactamase #${n}`,
      contentGen: () => `Cho mình hỏi về phối hợp kháng sinh Amoxicillin + Acid Clavulanic: Tỷ lệ phối hợp tối ưu là bao nhiêu để hạn chế tối đa tác dụng phụ trên đường tiêu hóa của bệnh nhân?`
    },

    // General, Campus Life, Food, Bus, Dorm
    {
      faculty: 'FIT',
      type: 'general' as const,
      tagSet: ['CampusLife', 'Library', 'Phenikaa', 'StudySpace'],
      titleGen: (n: number) => `Góc review: Top những vị trí tự học yên tĩnh và nhiều ổ cắm nhất Thư viện Tòa A2 #${n}`,
      contentGen: () => `Chia sẻ kinh nghiệm cày deadline cho anh em: Tầng 3 khu vực bàn sát cửa kính hướng hồ điều hòa có điều hòa mát, wifi căng đét và rất ít người qua lại.`
    },
    {
      faculty: 'FEE',
      type: 'general' as const,
      tagSet: ['CampusLife', 'Food', 'YenNghia', 'SinhVien'],
      titleGen: (n: number) => `Review các quán ăn ngon - bổ - rẻ xung quanh cổng trường Phenikaa cho tân sinh viên #${n}`,
      contentGen: () => `Tổng hợp danh sách các quán cơm tấm, bún chả, bánh mì chảo và quán trà sữa ruột của sinh viên trường mình. Giá chỉ từ 25k - 35k/suất no căng bụng.`
    },
    {
      faculty: 'FAE',
      type: 'general' as const,
      tagSet: ['Sports', 'Football', 'PhenikaaCup', 'CampusLife'],
      titleGen: (n: number) => `Tổng hợp kết quả vòng bảng Giải bóng đá Sinh viên Phenikaa Cup 2026 #${n}`,
      contentGen: () => `Trận cầu nảy lửa giữa Đội tuyển Khoa CNTT và Khoa Kỹ thuật Ô tô đã khép lại với tỷ số 3-2. Chúc mừng các chàng thủ đã cống hiến những pha bóng mãn nhãn!`
    },
    {
      faculty: 'FBA',
      type: 'general' as const,
      tagSet: ['Hostel', 'YenNghia', 'HaDong', 'TroSinhVien'],
      titleGen: (n: number) => `Kinh nghiệm tìm phòng trọ khu vực Yên Nghĩa, Đồng Mai gần trường Phenikaa #${n}`,
      contentGen: () => `Một số lưu ý quan trọng khi ký hợp đồng thuê trọ: Giá điện nước sinh hoạt, tiền cọc, giờ giấc đóng cổng và an ninh khu trọ. Chúc các bạn tìm được phòng ưng ý.`
    }
  ]

  // Add 260 programmatic templates
  let counter = 1
  while (postTemplates.length < 280) {
    const topic = additionalTopics[counter % additionalTopics.length]
    const daysAgo = Math.floor((counter * 58) / 280) + 1

    postTemplates.push({
      postType: topic.type,
      courseCode: topic.course,
      facultyCode: topic.faculty,
      title: topic.titleGen(counter),
      content: topic.contentGen(),
      tags: topic.tagSet,
      daysAgo,
      comments: [
        {
          content: 'Bài viết rất hữu ích, cảm ơn bạn đã chia sẻ!',
          likesCount: getRandomInt(1, 5)
        },
        {
          content: 'Mình cũng đang quan tâm đến chủ đề này, đánh dấu để theo dõi thảo luận.',
          likesCount: getRandomInt(0, 3)
        }
      ]
    })
    counter++
  }

  console.log(`📝 Generated ${postTemplates.length} post templates to insert.`)

  let postCount = 0
  let commentCount = 0
  let reactionCount = 0

  // 5. Insert Posts, Comments & Reactions
  for (let i = 0; i < postTemplates.length; i++) {
    const t = postTemplates[i]
    let author: any

    if (t.preferredUsername) {
      author = users.find((u) => u.username === t.preferredUsername)
    }

    if (!author) {
      if (t.authorRole === 'lecturer') {
        author = getRandomItem(lecturers)
      } else if (t.authorRole === 'ta') {
        author = getRandomItem(tas)
      } else if (t.authorRole === 'admin') {
        author = admin
      } else {
        const facUsers = usersByFaculty[t.facultyCode] || students
        author = getRandomItem(facUsers)
      }
    }

    if (!author) {
      author = getRandomItem(users)
    }

    const courseInfo = t.courseCode ? courseMap.get(t.courseCode) : null
    const courseId = courseInfo ? courseInfo.id : null

    const idSuffix = `${i + 1}-${Math.random().toString(36).substring(2, 7)}`
    const slug = slugify(t.title, idSuffix)
    const createdAt = new Date(Date.now() - t.daysAgo * 86400000 - getRandomInt(100, 36000) * 1000)

    const baseLikes = getRandomInt(3, 45)
    const viewsCount = baseLikes * getRandomInt(8, 25) + getRandomInt(20, 200)
    const sharesCount = Math.floor(baseLikes / getRandomInt(3, 6))

    const insertPostRes = await pool.query(
      `INSERT INTO posts (
         author_id, course_id, post_type, title, slug, content, tags, media_urls,
         attached_document_ids, visibility, is_pinned, is_resolved, likes_count,
         comments_count, shares_count, views_count, created_at, updated_at
       ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
       RETURNING id`,
      [
        author.id,
        courseId,
        t.postType,
        t.title,
        slug,
        t.content,
        t.tags,
        t.mediaUrls || [],
        [],
        'public',
        t.isPinned || false,
        t.postType === 'question' ? Math.random() > 0.4 : false,
        0, // will update with actual reactions count
        0, // will update with actual comments count
        sharesCount,
        viewsCount,
        createdAt,
        createdAt
      ]
    )

    const postId = insertPostRes.rows[0].id
    postCount++

    // Insert Comments
    let currentPostCommentCount = 0
    if (t.comments && t.comments.length > 0) {
      for (let cIdx = 0; cIdx < t.comments.length; cIdx++) {
        const c = t.comments[cIdx]
        let commentAuthor: any

        if (c.authorUsername) {
          commentAuthor = users.find((u) => u.username === c.authorUsername)
        }
        if (!commentAuthor) {
          if (c.authorRole === 'lecturer') commentAuthor = getRandomItem(lecturers)
          else if (c.authorRole === 'ta') commentAuthor = getRandomItem(tas)
          else {
            const potentialAuthors = users.filter((u) => u.id !== author.id)
            commentAuthor = getRandomItem(potentialAuthors)
          }
        }
        if (!commentAuthor) commentAuthor = getRandomItem(users)

        const commentCreatedAt = new Date(createdAt.getTime() + (cIdx + 1) * getRandomInt(300, 7200) * 1000)

        const commentRes = await pool.query(
          `INSERT INTO comments (
             post_id, author_id, parent_id, content, likes_count, is_solution, created_at, updated_at
           ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
           RETURNING id`,
          [
            postId,
            commentAuthor.id,
            null,
            c.content,
            c.likesCount || getRandomInt(1, 10),
            c.isSolution || false,
            commentCreatedAt,
            commentCreatedAt
          ]
        )
        const commentId = commentRes.rows[0].id
        currentPostCommentCount++
        commentCount++

        // Sub-replies
        if (c.replies && c.replies.length > 0) {
          for (let rIdx = 0; rIdx < c.replies.length; rIdx++) {
            const r = c.replies[rIdx]
            let replyAuthor: any
            if (r.authorUsername) replyAuthor = users.find((u) => u.username === r.authorUsername)
            if (!replyAuthor) replyAuthor = getRandomItem(users.filter((u) => u.id !== commentAuthor.id))
            if (!replyAuthor) replyAuthor = getRandomItem(users)

            const replyCreatedAt = new Date(commentCreatedAt.getTime() + (rIdx + 1) * getRandomInt(300, 3600) * 1000)

            await pool.query(
              `INSERT INTO comments (
                 post_id, author_id, parent_id, content, likes_count, is_solution, created_at, updated_at
               ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8)`,
              [
                postId,
                replyAuthor.id,
                commentId,
                r.content,
                getRandomInt(0, 5),
                false,
                replyCreatedAt,
                replyCreatedAt
              ]
            )
            currentPostCommentCount++
            commentCount++
          }
        }
      }
    }

    // Insert Reactions
    const reactionUsers = getRandomItems(
      users.filter((u) => u.id !== author.id),
      Math.min(baseLikes, users.length - 1)
    )

    const reactionTypes = ['like', 'helpful', 'insightful', 'celebrate']
    for (const rUser of reactionUsers) {
      const reactType = getRandomItem(reactionTypes)
      await pool.query(
        `INSERT INTO post_reactions (post_id, user_id, reaction, created_at)
         VALUES ($1, $2, $3, $4)
         ON CONFLICT (post_id, user_id) DO NOTHING`,
        [postId, rUser.id, reactType, new Date(createdAt.getTime() + getRandomInt(60, 86400) * 1000)]
      )
      reactionCount++
    }

    // Update counts on post
    await pool.query(
      `UPDATE posts SET likes_count = $1, comments_count = $2 WHERE id = $3`,
      [reactionUsers.length, currentPostCommentCount, postId]
    )
  }

  // 6. Seed User Follows
  console.log('🤝 Seeding user follow relationships...')
  let followCount = 0
  for (const user of users) {
    // Each user follows 3 to 10 other users
    const followCandidates = users.filter((u) => u.id !== user.id)
    const numFollows = getRandomInt(3, 10)
    const followedUsers = getRandomItems(followCandidates, numFollows)

    for (const target of followedUsers) {
      const res = await pool.query(
        `INSERT INTO user_follows (follower_id, following_id, created_at)
         VALUES ($1, $2, NOW() - INTERVAL '${getRandomInt(1, 30)} days')
         ON CONFLICT (follower_id, following_id) DO NOTHING`,
        [user.id, target.id]
      )
      if (res.rowCount && res.rowCount > 0) followCount++
    }
  }

  // 7. Update course post counts
  console.log('🔄 Updating course post counts...')
  await pool.query(`
    UPDATE courses c
    SET post_count = (
      SELECT COUNT(*)::int FROM posts p WHERE p.course_id = c.id
    )
  `)

  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
  console.log('✅ SEEDING SUMMARY:')
  console.log(`   🏛️  Faculties: ${facultiesData.length}`)
  console.log(`   📚 Courses:   ${coursesData.length}`)
  console.log(`   👤 Users:     ${users.length}`)
  console.log(`   📝 Posts:     ${postCount}`)
  console.log(`   💬 Comments:  ${commentCount}`)
  console.log(`   ❤️  Reactions: ${reactionCount}`)
  console.log(`   🤝 Follows:   ${followCount}`)
  console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

  await pool.end()
}

main().catch((err) => {
  console.error('❌ Error executing seed script:', err)
  pool.end()
  process.exit(1)
})
