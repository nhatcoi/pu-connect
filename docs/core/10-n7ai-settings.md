# ⚙️ Đặc Tả: Cài Đặt N7AI (Kỹ năng · Tác vụ · Kết nối · Web · Bộ nhớ · Hỗ trợ · Quyền riêng tư)

> Trạng thái: **Đã triển khai (2026-10-16)**. Nối tiếp [`09-chat-mention-ai-threads-skills.md`](./09-chat-mention-ai-threads-skills.md).
> Mục **N7AI** trong `/settings` (danh sách giống app di động) → `/n7ai/settings/[item]` (từ 2026-10-17 nằm trong không gian [`/n7ai`](./11-n7ai-space.md); `/settings/n7ai*` redirect).

## 1. Quyết định

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Lưu cài đặt N7AI | Bảng `ai_settings (user_id PK, memory_enabled, retention_days, default_connectors[])` | `users.preferences` chỉ chứa cờ boolean hiển thị; cài đặt AI có kiểu khác + đọc ở nhiều luồng server |
| Bộ nhớ dài hạn | Bảng `ai_memories`; N7AI ghi dòng `[nhớ] …` **trong cùng lượt trả lời** (sau dấu mốc gợi ý) | Không tốn thêm 1 lượt gọi LLM; tách khỏi tóm tắt cuộn của từng thread |
| Đọc bộ nhớ | ≤ 8 mục: tương đồng trigram với câu hỏi + mới nhất, tổng ≤ 2 000 ký tự | Prompt gọn, đúng ngữ cảnh |
| Nhóm chat | Không đọc / ghi bộ nhớ, không connector riêng | Không lộ dữ liệu cá nhân cho cả nhóm |
| Tác vụ tự động | Lịch dạng **hằng ngày / hằng tuần lúc HH:MM** (giờ VN), ≤ 5 / người; worker BullMQ quét mỗi 5 phút `FOR UPDATE SKIP LOCKED` | Không cần cron tùy ý; an toàn khi chạy nhiều tiến trình |
| Kết quả tác vụ | Mỗi tác vụ 1 thread N7AI riêng; tin hỏi do hệ thống đăng thay người dùng; câu trả lời đẩy Web Push | Dùng lại toàn bộ luồng chat + push |
| Lỗi tác vụ | 3 lần lỗi liên tiếp ⇒ tự tạm dừng | Không đốt quota vô ích |
| Trình duyệt đám mây | Bậc 1 **Đọc trang web** (URL trong câu hỏi) + bậc 2 **Tìm kiếm web** (Tavily, cần `TAVILY_API_KEY`); trình duyệt headless **không làm** trên VPS 2 GB | Chi phí / rủi ro; ghi rõ ở mục Duyệt web |
| SSRF | Chỉ http(s) cổng 80/443, phân giải DNS rồi chặn IP nội bộ / loopback / link-local, tự theo redirect (≤ 3, kiểm lại mỗi bước), ≤ 1 MB, timeout 8 s | Đọc URL do người dùng đưa vào |
| Phản hồi | `ai_feedback (message_id, user_id, rating ±1, reason, comment)`; chỉ người trong hội thoại chấm | Liên kết `ai_runs` để thống kê |
| Lưu lịch sử | `retention_days` 30 / 365 / vô hạn; job hằng ngày xóa thread hết hạn (kèm tệp R2) | Người dùng kiểm soát dữ liệu |
| Xóa / xuất dữ liệu | `DELETE /ai/data` (thread, bộ nhớ, skill, tác vụ, phản hồi, kết nối + revoke Google); `GET /ai/data/export` JSON | Quyền được xóa / mang dữ liệu đi |

## 2. API

| Method | Endpoint | Ghi chú |
|---|---|---|
| GET / PATCH | `/ai/settings` | `{ memoryEnabled, retentionDays, defaultConnectors, profile: { goal, about, style } }` (hồ sơ học, 2026-10-18) |
| GET / POST | `/ai/memories` | danh sách / thêm tay |
| PATCH / DELETE | `/ai/memories/:id` | sửa / xóa; `DELETE /ai/memories` xóa tất cả |
| PATCH | `/ai/memories/:id/pin` | `{ pinned }` — mục ghim luôn được nhớ, không bị dọn (2026-10-18) |
| GET / POST | `/ai/tasks` | danh sách / tạo (≤ 5) |
| PATCH / DELETE | `/ai/tasks/:id` | sửa, bật/tắt / xóa; `POST /ai/tasks/:id/run` chạy ngay |
| PATCH | `/ai/skills/:id/state` | `{ enabled?, pinned? }` |
| POST | `/ai/messages/:id/feedback` | `{ rating: 1 \| -1, reason?, comment? }` |
| POST | `/ai/support` | báo lỗi / góp ý (kèm hội thoại nếu đồng ý) |
| GET | `/ai/usage` | quota hôm nay + 7 ngày |
| GET / DELETE | `/ai/data/export` · `/ai/data` | xuất / xóa toàn bộ dữ liệu N7AI |
| GET | `/admin/ai-feedback` | thống kê 👍/👎 + ticket gần nhất (admin) |

Connector mới: `web` (Đọc trang web, mặc định bật), `web_search` (khả dụng khi có `TAVILY_API_KEY`). `GET /ai/connectors` thêm `lastUsedAt`, `lastError`.

## 3. Web

- `/settings` thêm mục **N7AI** → `components/settings/n7ai/*`: Hồ sơ học (2026-10-18, [`core/16`](./16-n7ai-agent-tools.md)) · Kỹ năng · Tác vụ tự động · Trình kết nối · Duyệt web · Bộ nhớ · Cộng đồng · Phản hồi & Hỗ trợ · Điều khoản · Quyền riêng tư N7AI.
- Bong bóng câu trả lời N7AI: 👍/👎 (+ lý do khi 👎), nhãn "Đã cập nhật bộ nhớ".
- Connector mặc định đọc từ `ai_settings` (đồng bộ mọi thiết bị) thay localStorage.
- `/ai-terms`: điều khoản N7AI (trong nhóm route `(legal)`).
- Admin `/admin` thêm tab **N7AI**: tỉ lệ 👍/👎 30 ngày, lý do 👎, yêu cầu hỗ trợ mới nhất.

## 4. Kiểm thử

`apps/api/test/n7ai-settings.e2e-spec.ts`: cài đặt (mặc định, cập nhật từng phần, kiểm hợp lệ), bộ nhớ (tách dòng `[nhớ]`, bỏ trùng, nhớ lại, CRUD), tác vụ (lịch giờ VN, chạy ngay ghi thread riêng, 3 lỗi ⇒ tạm dừng), skill bật/tắt/ghim, 👍/👎 + hỗ trợ + lượt dùng + thống kê admin, xuất / dọn quá hạn / xóa toàn bộ dữ liệu, chặn SSRF + trích chữ HTML.
