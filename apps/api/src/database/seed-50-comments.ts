import { Pool } from 'pg'

const pool = new Pool({
  connectionString: process.env.DATABASE_URL || 'postgresql://pu_user:pu_password@localhost:5432/pu_connector_db'
})

const targetPostId = 'ff05f219-2405-4954-b530-2122d65925a6'

const commentTemplates = [
  'Dạ chúng em cảm ơn Thầy ạ! Nhóm em K15-FIT02 đang hoàn thành nốt module xác thực OAuth2 và Payment Gateway.',
  'Thầy cho em hỏi phần Video Demo có bắt buộc quay mặt thành viên nhóm thuyết trình không ạ?',
  'Nhóm em làm đồ án về Xử lý ảnh y tế với mô hình UNet, có cần đính kèm cả dataset benchmark không Thầy?',
  'Dạ Thầy ơi cho em hỏi nếu nhóm 2 bạn thì phân chia báo cáo theo từng chương hay theo chức năng ạ?',
  'Báo cáo tiến độ có giới hạn số trang tối thiểu hay tối đa không ạ thầy?',
  'Thầy ơi cho em hỏi mẫu bìa báo cáo lấy ở cổng Portal Đào tạo hay tải ở group khoa ạ?',
  'Các bạn cho mình hỏi phần SRS có cần vẽ biểu đồ Sequence Diagram cho toàn bộ Use Case không hay chỉ những luồng chính?',
  'Nhóm mình đang làm ứng dụng Flutter + NestJS, phần DevOps CI/CD có được tính điểm cộng tiến độ không Thầy?',
  'Dạ Thầy cho em hỏi lịch bảo vệ thử (Pre-defense) Đợt 1 dự kiến diễn ra vào tuần nào ạ?',
  'Kỳ này đồ án tốt nghiệp được nộp link GitHub riêng hay bắt buộc dùng GitLab của trường vậy các bác?',
  'Em chào Thầy, nhóm em đã nộp bản nháp qua email của Thầy hướng dẫn rồi, có cần upload lại lên đây nữa không ạ?',
  'Cảm ơn thông báo của Khoa! Chúc toàn thể anh em K15 vượt qua đợt kiểm tra tiến độ êm đẹp 💪',
  'Nhóm em gặp lỗi khi deploy mô hình LLM lên server nội bộ, có được xin gia hạn thêm 1 ngày nộp link demo không Thầy?',
  'Thầy ơi phần kiến trúc hệ thống Microservices nhóm em vẽ bằng C4 Model được không ạ?',
  'Đã nộp xong báo cáo! Anh em K15 chuẩn bị tinh thần chiến đấu đợt 2 thôi 🔥',
  'Mọi người cho mình hỏi tài liệu tham khảo có bắt buộc phải format chuẩn IEEE không?',
  'Dạ Thầy ơi, video demo 3 phút upload lên Google Drive để quyền Anyone with the link can view đúng không ạ?',
  'Nhóm em làm đề tài Blockchain Smart Contract, phần kiểm thử bảo mật Mythril có cần đưa vào báo cáo không ạ?',
  'Khoa mình có tổ chức buổi Q&A trực tuyến giải đáp thắc mắc về đồ án tốt nghiệp trước ngày 15/03 không Thầy?',
  'Cho mình hỏi mã nguồn có cần commit đầy đủ lịch sử git từ đầu kỳ hay chỉ cần release tag v1.0 là được?',
  'Đồ án kỳ này có yêu cầu nộp file Word kèm PDF không ạ hay chỉ cần duy nhất 1 file PDF?',
  'Dạ Thầy cho em hỏi sinh viên đi thực tập doanh nghiệp kết hợp làm đồ án thì có cần giấy xác nhận của công ty đợt 1 không ạ?',
  'Tuyệt vời quá, cảm ơn thầy Hà và các thầy cô trong Khoa đã luôn đồng hành và hỗ trợ sinh viên!',
  'Nhóm em đang train mô hình YOLOv8 cho camera giám sát, kết quả accuracy đạt 91%, đợt 1 demo phần này được chưa Thầy?',
  'Các bạn K15 chú ý check kỹ đạo văn bằng Turnitin trước khi nộp báo cáo nhé!',
  'Dạ Thầy ơi, nếu nhóm có 1 thành viên bị ốm phải nằm viện thì có làm đơn bảo lưu tiến độ riêng được không ạ?',
  'Phần thiết kế cơ sở dữ liệu có cần xuất file schema SQL đính kèm trong repository không mọi người?',
  'Chúc tất cả các nhóm K15 hoàn thành xuất sắc đồ án tốt nghiệp năm 2026! 🎉',
  'Thầy ơi tài liệu SRS viết bằng tiếng Anh được không ạ hay bắt buộc tiếng Việt?',
  'Đã hoàn thành 80% khối lượng công việc, cố lên anh em K15 CNTT Phenikaa!',
  'Cho mình hỏi phần front-end dùng Next.js 15 App Router có được khuyến khích không?',
  'Dạ Thầy cho em hỏi nếu muốn đổi tên đề tài đồ án thì đợt kiểm tra tiến độ này có kịp làm đơn xin đổi không ạ?',
  'Báo cáo tiến độ cần chữ ký xác nhận của Giáo viên hướng dẫn trước khi nộp không ạ Thầy?',
  'Nhóm mình vừa test xong luồng thanh toán VNPay trên môi trường Sandbox, chạy mượt lắm anh em ơi.',
  'Các bác cho hỏi slide thuyết trình có mẫu template chuẩn của trường không hay tự thiết kế?',
  'Dạ Thầy ơi, điểm tiến độ đợt 1 chiếm bao nhiêu phần trăm trong tổng điểm đồ án ạ?',
  'Thông báo rất chi tiết và kịp thời, cảm ơn Ban chủ nhiệm Khoa CNTT!',
  'Anh em nào đang làm đồ án về Kubernetes & Docker cần hỗ trợ cluster test thì nhắn mình nhé!',
  'Nhóm em đã hoàn thiện backend NestJS + PostgreSQL + Redis, đang ghép với Flutter mobile app.',
  'Thầy ơi cho em hỏi nếu đồ án làm sản phẩm phần cứng IoT thì mang sản phẩm đến khoa hay quay video demo là được ạ?',
  'Mọi người nhớ kiểm tra kỹ quyền truy cập link Drive và repo GitHub trước giờ G nhé, tránh bị chấm 0 điểm.',
  'Dạ Thầy ơi, mẫu báo cáo tiến độ tải ở mục nào trên PU Connector ạ?',
  'Khoa CNTT Phenikaa luôn tổ chức rất chuyên nghiệp và hỗ trợ nhiệt tình!',
  'Anh em K15 điểm danh nào, ai làm đồ án Web/App thì kết nối trao đổi kinh nghiệm nhé.',
  'Nhóm em sử dụng Kafka để xử lý luồng dữ liệu thời gian thực, phần này sẽ demo trực tiếp trong video 3 phút ạ.',
  'Thầy cho em hỏi nếu đồ án có bài báo khoa học được chấp nhận thì có được miễn kiểm tra đợt 1 không ạ?',
  'Đã nộp thành công! Cảm ơn thầy cô Khoa CNTT rất nhiều ạ.',
  'Các bạn cho mình hỏi phần Unit Test có yêu cầu độ bao phủ Coverage tối thiểu bao nhiêu % không?',
  'Nhóm em làm đề tài Hệ thống gợi ý học tập AI, đợt này đã tích hợp xong pgvector và RAG.',
  'Cố lên các bạn K15 ơi, chặng đường sắp về đích rồi! 🚀'
]

async function seedComments() {
  const client = await pool.connect()
  try {
    console.log('🚀 Seeding 50 realistic comments for post:', targetPostId)

    // Check if post exists
    const postRes = await client.query('SELECT id, author_id FROM posts WHERE id = $1', [targetPostId])
    if (postRes.rows.length === 0) {
      console.error('❌ Post not found:', targetPostId)
      return
    }

    // Get all users
    const usersRes = await client.query('SELECT id, username, display_name FROM users')
    const users = usersRes.rows

    if (users.length === 0) {
      console.error('❌ No users found in database')
      return
    }

    // Clear old comments on this post to test cleanly
    await client.query('DELETE FROM comments WHERE post_id = $1', [targetPostId])

    const insertedIds: string[] = []

    for (let i = 0; i < commentTemplates.length; i++) {
      const user = users[i % users.length]
      const content = commentTemplates[i]
      const likesCount = Math.floor(Math.random() * 25) + 1
      const isSolution = i === 0 // Mark the first comprehensive comment as solution

      // Top-level comment or reply to previous comment
      let parentId: string | null = null
      if (i > 3 && i % 4 === 0 && insertedIds.length > 0) {
        parentId = insertedIds[Math.floor(Math.random() * (insertedIds.length - 1))]
      }

      // Generate realistic timestamp in past 7 days
      const hoursAgo = Math.floor((50 - i) * 2.5) + 1
      const createdAt = new Date(Date.now() - hoursAgo * 3600 * 1000)

      const insertRes = await client.query(
        `INSERT INTO comments (post_id, author_id, parent_id, content, likes_count, is_solution, created_at, updated_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, $7)
         RETURNING id`,
        [targetPostId, user.id, parentId, content, likesCount, isSolution, createdAt]
      )

      insertedIds.push(insertRes.rows[0].id)
    }

    // Update post comments_count
    await client.query('UPDATE posts SET comments_count = $1, is_resolved = TRUE WHERE id = $2', [insertedIds.length, targetPostId])

    console.log(`✅ Successfully seeded ${insertedIds.length} comments for post ${targetPostId}!`)
  } catch (err: any) {
    console.error('❌ Error seeding comments:', err.message)
  } finally {
    client.release()
    await pool.end()
  }
}

seedComments()
