# Mức model và hạn mức

## Mức model

Người dùng chọn mức, không chọn tên model thô. Danh mục do admin quản lý trong bảng `ai_models`.

| Mức | Mã | Hiển thị | Lượt tính | Dùng cho |
|---|---|---|---|---|
| Nhanh | `n7ai-fast` | Có, mặc định | 1 | Chào hỏi, hỏi đáp ngắn, tìm tài liệu |
| Cân bằng | `n7ai-perfect` | Có | 1 | Bài giải, tổng hợp, giải thích |
| Sâu | `n7ai-deep` | Chưa hiển thị | 2 | Dành cho suy luận sâu, phụ thuộc cấu hình gateway |

- Lựa chọn lưu theo người dùng (`ai_settings.ai_model`) và đồng bộ mọi thiết bị.
- Đổi mức ngay trong ô soạn, cạnh nút gửi.
- Thread riêng và tác vụ tự động dùng mức đã chọn. Nhóm chat luôn dùng mức Nhanh.
- Model đã chọn bị admin tắt hoặc xóa thì hệ thống tự dùng model mặc định.
- Việc nền (tóm tắt bài, soạn skill, soạn bộ thẻ) dùng model mặc định.

## Hạn mức ngày

| Quy tắc | Giá trị |
|---|---|
| Hạn mức mặc định | 30 lượt mỗi ngày, cấu hình bằng `AI_DAILY_QUOTA` |
| Lượt tính cho một câu hỏi | Lớn hơn của (2 nếu chế độ Nghiên cứu, ngược lại 1) và chi phí của mức model |
| Hiển thị | Chip "X/30 lượt" trên ô soạn và thanh chế độ, hồ sơ N7AI ở đáy thanh bên |
| Chi tiết | `GET /ai/usage` |

Các thao tác AI phụ (gợi ý phân loại tài liệu, viết giúp bài, soạn nháp bộ học) cũng tốn 1 lượt và ghi `ai_runs` với `trigger` tương ứng. AI không tự lưu kết quả: người dùng xem rồi mới xác nhận.

## Provider và dự phòng

Gateway (địa chỉ cơ sở và khóa API tương thích OpenAI) do Admin quản lý ở bảng `ai_providers`, không còn nằm trong tệp môi trường.

| Quy tắc | Mô tả |
|---|---|
| Thứ tự | `priority` nhỏ gọi trước; provider đầu tiên đang bật là chính |
| Chuyển dự phòng | Khi provider trước lỗi gateway (mất kết nối, hết giờ, 401, 403, 404, 408, 429, 5xx) |
| Tạm bỏ qua | Provider lỗi bị bỏ qua 60 giây |
| `model_override` | Provider dự phòng có tên model khác thì luôn gọi model đó |
| Khóa API | Mã hóa AES-256-GCM, chỉ lưu 4 ký tự cuối để hiển thị |
| Nguồn cấu hình | Có provider bật trong cơ sở dữ liệu thì dùng, ngược lại lùi về biến môi trường |

Thao tác quản trị xem [Admin: Vận hành AI](../admin/ai-operations).

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/ai/models` | Model bật và hiển thị cho menu chọn |
| PATCH | `/ai/settings` | Đổi `aiModel` (model không bật thì 400) |
| GET | `/ai/quota` | Hạn mức còn lại |
