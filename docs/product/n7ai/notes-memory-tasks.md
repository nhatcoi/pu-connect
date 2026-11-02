# Bộ nhớ, ghi chú và tác vụ

## Bộ nhớ dài hạn

N7AI ghi nhớ những điều bền vững về người dùng (mục tiêu, sở thích học) để cá nhân hóa các lần sau.

| Quy tắc | Giá trị |
|---|---|
| Cách ghi | N7AI ghi dòng `[nhớ] ...` ngay trong lượt trả lời, không tốn thêm lượt gọi mô hình |
| Cách đọc | Tối đa 8 mục: độ tương đồng với câu hỏi cộng mục mới nhất, tổng tối đa 2.000 ký tự |
| Ghim | Mục ghim luôn được nhớ và không bị dọn |
| Hợp nhất | Tác vụ hằng ngày gộp các mục trùng hoặc cũ |
| Quản lý | Xem, thêm tay, sửa, ghim, xóa từng mục hoặc xóa tất cả |
| Bật tắt | Tắt bộ nhớ trong Cài đặt thì N7AI không đọc và không ghi |
| Nhóm chat | Không đọc, không ghi bộ nhớ |

Hồ sơ học (mục tiêu, giới thiệu bản thân, phong cách) lưu cùng cài đặt và luôn đưa vào prompt.

## Ghi chú Markdown

Tab Ghi chú ở panel phải của không gian N7AI.

| Tính năng | Mô tả |
|---|---|
| Cây trang | Trang và trang con |
| Soạn thảo | Trình soạn Markdown, tự lưu và hiện "Đã lưu" |
| Thêm từ chat | Nút "Thêm vào ghi chú" trên câu trả lời của N7AI |
| Menu trang | Ghim, chuyển tới, xuất Markdown, xuất Word, xóa |

API: `GET, POST /ai/notes`, `GET, PATCH, DELETE /ai/notes/:id`, `POST /ai/notes/:id/append`, `GET /ai/notes/:id/export?format=md|docx`. Dữ liệu ở bảng `ai_notes`.

## Tác vụ tự động

Cho N7AI chạy một câu hỏi định kỳ và gửi kết quả cho người dùng.

| Quy tắc | Giá trị |
|---|---|
| Lịch | Hằng ngày hoặc hằng tuần lúc HH:MM (giờ Việt Nam) |
| Số lượng | Tối đa 5 tác vụ mỗi người |
| Chạy | Tác vụ nền quét mỗi 5 phút, khóa dòng `SKIP LOCKED` nên an toàn khi chạy nhiều tiến trình |
| Kết quả | Mỗi tác vụ một thread riêng; câu hỏi do hệ thống đăng thay người dùng; câu trả lời đẩy Web Push |
| Lỗi | 3 lần lỗi liên tiếp thì tự tạm dừng |
| Chạy ngay | Nút chạy thử `POST /ai/tasks/:id/run` |

## Quyền riêng tư và dữ liệu

| Cài đặt | Mô tả |
|---|---|
| Thời gian lưu lịch sử | 30 ngày, 365 ngày hoặc vô hạn |
| Xuất dữ liệu | `GET /ai/data/export` trả JSON |
| Xóa dữ liệu | `DELETE /ai/data`: thread, bộ nhớ, skill, tác vụ, phản hồi, kết nối (thu hồi cấp quyền Google và PU Connect) |
| Phản hồi | Chấm tích cực, tiêu cực kèm lý do cho từng câu trả lời |
| Hỗ trợ | Gửi ticket tới admin (`POST /ai/support`) |

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `ai_settings` | Bộ nhớ bật tắt, thời gian lưu, kết nối mặc định, mức model, hồ sơ học |
| `ai_memories` | Mục nhớ |
| `ai_tasks` | Tác vụ tự động |
| `ai_notes` | Ghi chú |
| `ai_feedback` | Phản hồi câu trả lời |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET, PATCH | `/ai/settings` | Cài đặt |
| GET, POST, PATCH, DELETE | `/ai/memories...` | Bộ nhớ; `PATCH /ai/memories/:id/pin` để ghim |
| GET, POST, PATCH, DELETE | `/ai/tasks...` | Tác vụ |
| GET | `/ai/usage`, `/ai/quota` | Thống kê dùng, hạn mức |
| POST | `/ai/support` | Gửi hỗ trợ |
| GET, DELETE | `/ai/data/export`, `/ai/data` | Xuất, xóa dữ liệu |
