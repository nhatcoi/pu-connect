# Vận hành AI

## Mục đích

Quản lý toàn bộ hạ tầng AI từ giao diện thay vì tệp môi trường: provider LLM, danh mục model, dịch vụ embedding (RAG) và OCR, cùng telemetry, ticket hỗ trợ và kiểm duyệt skill. Thay đổi có hiệu lực ngay, không cần khởi động lại máy chủ.

## Tab LLM, RAG, OCR

Đường dẫn `/admin/#/ai?tab=llm`. Bộ chuyển Tất cả, LLM, RAG, OCR; mở trực tiếp qua URL.

### LLM: provider

Mỗi provider là một gateway tương thích OpenAI.

| Trường | Mô tả |
|---|---|
| Tên, địa chỉ cơ sở | Định danh và URL gateway |
| Khóa API | Mã hóa AES-256-GCM; chỉ hiển thị 4 ký tự cuối; để trống khi sửa nghĩa là giữ khóa cũ |
| `model_override` | Dùng cho provider dự phòng có tên model khác |
| Bật tắt, thứ tự | Thứ tự thử: provider đầu tiên bật là chính; lên xuống bằng nút di chuyển |
| Thử kết nối | Kiểm tra độ trễ và phản hồi |
| Dò model | Liệt kê model gateway cung cấp |
| Nhập từ env | Nhập cấu hình đang nằm trong tệp môi trường vào cơ sở dữ liệu |

API: `GET, POST /admin/ai/providers`, `PATCH, DELETE /admin/ai/providers/:id`, `POST .../:id/move|test`, `GET .../:id/models`, `POST /admin/ai/providers/import-env`.

### LLM: model

Ánh xạ ba tên:

| Trường | Ví dụ | Ý nghĩa |
|---|---|---|
| Tên model map | `n7ai-fast` | Mã nội bộ người dùng chọn |
| Tên hiển thị | Nhanh | Hiện trên giao diện |
| Model trên provider | `gpt-oss-120b-medium` | Tên gửi tới gateway |

Thêm theo lô, đặt model mặc định (đúng một), ẩn hoặc tắt. Không tắt hoặc xóa được model mặc định; xóa model thì người đang chọn quay về mặc định. Model có ký tự `/` trong id được cập nhật bằng `PATCH /admin/ai/models` với `currentId` trong thân yêu cầu.

### RAG

Endpoint embedding: địa chỉ cơ sở, model, gợi ý khóa, thời gian cập nhật, bật tắt, thử kết nối.

### OCR

Endpoint nhận diện chữ cho tài liệu scan: địa chỉ, model, khóa, giới hạn trang, bật tắt, thử kết nối.

API dịch vụ: `GET /admin/ai/services`, `PATCH /admin/ai/services/:service`, `POST /admin/ai/services/:service/test`. Khóa mã hóa bằng `TokenCipher`.

## Telemetry, ticket, skill

| Chức năng | Mô tả | API |
|---|---|---|
| Tổng quan | Lượt gọi, token, thời gian, phản hồi | `GET /admin/ai/overview` |
| Ticket hỗ trợ | Yêu cầu hỗ trợ người dùng gửi từ N7AI; cập nhật trạng thái | `PATCH /admin/ai/tickets/:id` |
| Skill | Duyệt skill người dùng chia sẻ công khai | `GET /admin/ai/skills`, `PATCH /admin/ai/skills/:id` |
| Phản hồi | Đánh giá tích cực, tiêu cực của người dùng | `GET /ai/ai-feedback` |

## Quyền

Xem cần `ai:read`; thay đổi cần `ai:manage`. Thao tác ghi nhật ký (`ai_model.create|update|delete` và tương tự).

Quy tắc dự phòng giữa các provider xem [Mức model và hạn mức](../n7ai/models-quota).
