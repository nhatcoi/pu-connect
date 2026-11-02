# Nhắn tin

## Mục đích

Trò chuyện trực tiếp, nhóm và với N7AI trong cùng một mô hình thống nhất: hội thoại, tin nhắn, thành viên. N7AI là một tài khoản bot đặc biệt, có thể được nhắc tên như người thật nhưng mọi truy vấn dữ liệu chạy dưới quyền của người gọi.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Hội thoại 1-1 | Tạo từ hồ sơ hoặc từ nút nhắn tin; mỗi cặp một hội thoại |
| Chat nhóm | Có chủ nhóm, thêm hoặc xóa thành viên, đổi chủ, rời nhóm; tối đa 50 thành viên khi dùng `@all` |
| Chat nhóm học | Mỗi nhóm học có hội thoại riêng (`POST /conversations/study-groups/:groupId`) |
| Tin nhắn | Gửi, sửa, xóa, phản ứng biểu tượng, ghim, tìm trong hội thoại, xem tệp đính kèm |
| Chưa đọc | Số chưa đọc theo hội thoại và tổng, đánh dấu đã đọc |
| Tắt tiếng | Theo hội thoại; bị nhắc tên vẫn nhận Push |
| Nhắc tên | `@username` và `@all` (chỉ chủ nhóm) |
| Gắn ngữ cảnh | Chip phía trên ô soạn, tối đa 5 mục: bài viết, tài liệu, hội thoại N7AI của chính mình |
| Gọi N7AI | `@n7ai` trong chat nhóm hoặc cá nhân: N7AI đọc 30 tin gần nhất và trả lời |
| Chia sẻ bài viết | Gửi bài vào hội thoại với bản xem trước (`POST /chat/share/post`) |
| Hiện diện | Trạng thái trực tuyến qua `GET /presence` |
| Chặn | Người bị chặn không nhắn được cho nhau |

## Luồng gửi tin

1. Client gửi `POST /conversations/:id/messages`.
2. Máy chủ kiểm tra thành viên, hạn chế tài khoản, chặn; lưu tin, trích nhắc tên và ngữ cảnh vào `meta`.
3. Phát sự kiện tới phòng hội thoại; người nhận ngoại tuyến nhận Web Push.
4. Nếu có `@n7ai`, tạo lượt trả lời AI chạy nền và truyền từng phần về hội thoại.

## Quy tắc nghiệp vụ

- Nội dung tin lưu dạng chữ đọc được (`@username`), thực thể có cấu trúc lưu ở `messages.meta` (nhắc tên, ngữ cảnh, skill).
- Ngữ cảnh "chat khác" chỉ cho phép hội thoại N7AI của chính người gửi, không nạp tin nhóm của người khác lên mô hình.
- Máy chủ quyết định mọi thứ thời gian thực: client không tự vào phòng hay tự khai tác giả.
- Hạn chế tài khoản chặn gửi tin và tạo hội thoại.
- Danh sách hội thoại chỉ hiện thread N7AI mới nhất; lịch sử thread xem trong không gian N7AI. Hội thoại N7AI không tính vào số chưa đọc.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `conversations` | Loại (`direct`, `group`, `ai`), tên, chủ, `direct_key`, tóm tắt AI |
| `conversation_members` | Thành viên, vai trò, tắt tiếng, mốc đã đọc |
| `messages` | Nội dung, `meta`, trạng thái sửa và xóa, ghim |
| `message_reactions` | Phản ứng |
| `message_mentions` | Nhắc tên: tin, người được nhắc, hội thoại |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/conversations` | Danh sách |
| GET | `/conversations/unread-count` | Tổng chưa đọc |
| POST | `/conversations/direct`, `/conversations`, `/conversations/ai`, `/conversations/study-groups/:groupId` | Tạo hội thoại |
| GET, PATCH | `/conversations/:id`, `/conversations/:id/settings` | Chi tiết, đổi tên, tắt tiếng |
| GET, POST, DELETE | `/conversations/:id/members`, `.../members/:userId` | Thành viên |
| POST | `/conversations/:id/owner`, `/read`, `/leave` | Đổi chủ, đã đọc, rời |
| GET | `/conversations/:id/messages`, `/messages/search`, `/pinned`, `/attachments`, `/mentions` | Đọc dữ liệu |
| POST | `/conversations/:id/messages` | Gửi tin |
| PATCH, DELETE | `/messages/:id` | Sửa, xóa |
| POST, GET | `/messages/:id/reactions` | Phản ứng |
| POST | `/messages/:id/pin` | Ghim |
| GET | `/chat/refs` | Gợi ý ngữ cảnh để gắn |
| GET, PUT, DELETE | `/blocks`, `/blocks/:userId` | Chặn người dùng (bảng `user_blocks`) |

Hội thoại N7AI và các thread riêng xem [Chat và thư mục](../n7ai/chat-workspace).
