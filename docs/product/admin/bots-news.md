# Bot và tin tức

## Bot theo job

### Mục đích

Làm sôi động nội dung bằng bài đã sưu tầm thật, đăng theo lịch dưới danh nghĩa tài khoản bot, thay cho hệ bot phức tạp trước đây.

### Quy trình

1. Admin tạo hoặc chọn tài khoản bot (hồ sơ, vai trò, giọng điệu).
2. Nhập bài đã sưu tầm bằng Excel, CSV hoặc JSON gồm: tiêu đề, nội dung, ảnh, thẻ, loại bài, môn, cộng đồng, khảo sát, giờ đăng.
3. Tạo job và giao cho một bot. Ảnh tải qua `POST /bots/ingest/images`.
4. Bot đăng đúng giờ. Admin có thể đăng ngay hoặc xóa từng bài trong job.
5. Tùy chọn Tự trả lời và Tự thả tim: bot phản hồi bình luận của người thật ở các bài của job.

### Thành phần

| Thành phần | Mô tả |
|---|---|
| Tài khoản bot | Tạo, sửa, bật tắt, xóa; mặc định bật khi tạo |
| Job | Danh sách bài, trạng thái từng bài, lịch đăng |
| Bài trong job | Đăng ngay, xóa |

API: `GET /admin/bots`, `POST, PATCH, DELETE /admin/bots/accounts...`, `POST, GET, PATCH, DELETE /admin/bots/jobs...`, `POST /admin/bots/jobs/:id/posts/:postId/publish`.

Bài của bot được xếp hạng như bài thường; thuật toán giảm điểm bài thứ ba trở đi của cùng tác giả để một bot không chiếm cả trang.

## Thu thập tin

### Mục đích

Tự động tổng hợp tin công nghệ và AI từ nguồn RSS, viết phần phân tích tác động bằng AI, và đăng lên bảng tin dưới bot `@ainews` sau khi admin duyệt (hoặc hoàn toàn tự động).

### Tab

| Tab | Nội dung |
|---|---|
| Bản tin thu thập | Bài đã lấy, lọc theo chuyên mục và trạng thái `pending`, `posted`, `rejected`; đăng ngay hoặc từ chối |
| Nguồn RSS | Danh sách nguồn (Google News AI, OpenAI, The Verge, TechCrunch, arXiv...), bật tắt, thêm theo chuyên mục `ai`, `tech`, `security`, `robotics`, `general` |
| Cấu hình và Telegram | Bot đăng mặc định, model tóm tắt, chế độ tự động hoàn toàn hay duyệt tay, kết nối Telegram để đẩy bản tin mới cho admin xem |

Thống kê: tổng bài thu thập, chờ duyệt, đã đăng, số nguồn.

API: `GET /admin/news`, `POST /admin/news/fetch`, `POST /admin/news/articles/:id/publish`, `PATCH .../articles/:id/status`, `POST, PATCH, DELETE /admin/news/sources...`, `PATCH /admin/news/config`.

Dữ liệu: `news_sources`, `news_articles`, `news_crawler_config`. Ứng dụng phụ `apps/ai-news` hỗ trợ trang tổng hợp tin.
