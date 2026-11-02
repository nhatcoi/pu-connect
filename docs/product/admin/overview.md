# Tổng quan Admin Console

## Mục đích

Admin Console (`admin-puc.vnhat.dev`) là cổng quản trị tách biệt khỏi ứng dụng người dùng: ứng dụng một trang tĩnh (Vite, React) gọi API `/api/admin/*`. Quản trị viên dùng để xử lý vi phạm, quản lý người dùng, duy trì danh mục học thuật và vận hành AI.

## Truy cập

- Vai trò `admin` có mọi quyền.
- Người khác chỉ vào được khi thuộc một nhóm quyền (xem [Thông báo và nhóm quyền](announcements-groups)).
- Quyền hiệu lực bằng quyền vai trò cộng quyền các nhóm, lưu đệm 30 giây. Bảng quyền ở [Vai trò và phân quyền](../roles-permissions).
- Mọi thao tác quản trị ghi `admin_audit_logs`; nhật ký không sửa được.

## Cấu trúc menu

| Menu | Quyền | Nội dung | Tài liệu |
|---|---|---|---|
| Tổng quan | `dashboard:view` | Số liệu tổng, việc cần xử lý | Dưới đây |
| Kiểm duyệt | `moderation:read`, `moderation:write` | Báo cáo, bài viết, bình luận, từ cấm, sự kiện tự động | [Kiểm duyệt](moderation) |
| Người dùng | `users:*` | Danh sách, hồ sơ, xử phạt, phiên, bảo mật | [Người dùng và bảo mật](users-security) |
| Đề xuất | `academic:manage` | Duyệt đề xuất trường, lĩnh vực, môn học | [Danh mục học thuật](academic-catalog) |
| Học thuật | `academic:read`, `academic:manage` | Đơn vị, môn học, tài liệu, cộng đồng | [Danh mục học thuật](academic-catalog) |
| N7AI | `ai:read`, `ai:manage` | Telemetry, ticket, skill, LLM, RAG, OCR | [Vận hành AI](ai-operations) |
| Tìm kiếm | `search:read` | Từ khóa phổ biến, không có kết quả | Dưới đây |
| Thông báo | `system:broadcast` | Thông báo hệ thống | [Thông báo và nhóm quyền](announcements-groups) |
| Nhóm quyền | `users:role` | Tập quyền gán cho người dùng | [Thông báo và nhóm quyền](announcements-groups) |
| Bot | `academic:manage` | Tài khoản bot, job đăng bài | [Bot và tin tức](bots-news) |
| Thu thập tin | `academic:manage` | Nguồn RSS, duyệt bài tin tức | [Bot và tin tức](bots-news) |
| Nhật ký | `audit:read` | Thao tác quản trị, đăng nhập, sự kiện bảo mật | [Người dùng và bảo mật](users-security) |
| Thùng rác | `moderation:write` | Khôi phục nội dung đã xóa theo lô | Dưới đây |

## Tổng quan

Các chỉ số: người dùng, bài viết, bình luận, báo cáo chờ xử lý, đề xuất chờ duyệt, cộng đồng chờ duyệt, số liệu N7AI. Từ đây nhảy tới hàng chờ tương ứng. Badge menu Đề xuất cộng dồn mọi loại đề xuất chờ duyệt.

## Phân tích tìm kiếm

Hai báo cáo: từ khóa được tìm nhiều nhất (`/admin/search/top`) và từ khóa không có kết quả (`/admin/search/zero-results`). Từ khóa không có kết quả là gợi ý bổ sung môn học, tài liệu hoặc từ đồng nghĩa.

## Thùng rác

Nội dung bị xóa (ví dụ bản nháp tài liệu bị dọn) vào thùng rác theo lô. Admin xem danh sách và khôi phục cả lô (`GET /admin/trash`, `POST /admin/trash/:batch/restore`).

## Quy ước giao diện

- Mọi bộ lọc, trang, tab, hồ sơ đang mở nằm trên URL, ví dụ `#/users?risk=high&user=<id>`: gửi liên kết là mở đúng màn hình.
- Nút View trên mỗi trang: bộ lọc có sẵn, lưu riêng hoặc chia sẻ (`GET, POST, DELETE /admin/views`).
- Thao tác hàng loạt trên danh sách người dùng, bài viết, bình luận.
- Giao diện tối giản, không văn bản hướng dẫn dài trong hộp thoại; thông tin ngắn nằm ở placeholder.
