# N7AI: mức model (n7ai-fast · n7ai-perfect · n7ai-deep)

Implemented: 2026-10-19. Mức model là tên model trên gateway chính (tunnel); người dùng chọn mức, không chọn tên model thô.

| Mức | Model gateway | Hiển thị | Quota/câu hỏi | Ghi chú |
|---|---|---|---|---|
| Nhanh | `n7ai-fast` | ✅ (mặc định) | 1 | Chào hỏi, hỏi đáp ngắn, tìm tài liệu |
| Cân bằng | `n7ai-perfect` | ✅ | 1 | Bài giải, tổng hợp, giải thích |
| Sâu | `n7ai-deep` | ❌ (ghi sẵn, UI chưa hiện) | 2 | Server nhận được; **gateway đang trả 400 "Invalid model format"** (đo lại 2026-10-20) ⇒ chưa dùng được cho tới khi gateway cấu hình |

**Đổi tên (2026-10-20)**: gateway bỏ `puc-*`, chỉ còn `n7ai-*` (`puc-fast` trả "No active credentials"). `ai-models-upgrade.sql` đổi `id` các dòng cũ (giữ nhãn/cờ admin) và chuyển `ai_settings.ai_model`; env VPS `AI_MODEL=n7ai-fast`. Mọi lượt gọi `LlmService.chat` nối một câu vào system prompt đầu tiên: model đang chạy tên gì (`n7ai-fast`, hoặc `n7ai-fast (dự phòng)` khi sang gateway dự phòng), để N7AI trả lời đúng khi được hỏi "bạn là model gì".

Đo trên tunnel từ VPS (1 mẫu, nhiễu): `n7ai-fast` chữ đầu 2.2 s, câu khó xong 5.0 s; `n7ai-perfect` chữ đầu 5.0 s, câu khó xong 5.9 s; cả hai gọi tool được.

## Cách hoạt động

- Lưu theo người dùng: `ai_settings.ai_model` (migration `ai-model-upgrade.sql`, mặc định `n7ai-fast`); `GET/PATCH /api/ai/settings` có trường `aiModel` (tên lạ ⇒ 400). Đồng bộ mọi thiết bị.
- Dùng cho thread riêng, chat tạm và tác vụ tự động. Nhóm chat (không có cài đặt riêng) luôn `n7ai-fast`.
- `McpAgentService.stream(..., { model })` → `LlmService.chat(params, { model })`; `ai_runs.model` ghi mức đã dùng.
- Quota: `max(Research ? 2 : 1, chi phí mức)` (`ai/ai-models.ts`).
- Fallback: gateway chính lỗi ⇒ gateway dự phòng dùng **một** model chung `AI_FALLBACK_MODEL` (chưa theo mức; xem [`18`](./18-agent-harness-performance.md)).
- **Danh mục do admin quản lý (2026-10-20)**: bảng `ai_models` (migration `ai-models-upgrade.sql`; `id` = tên model trên gateway, `label`, `hint`, `cost`, `visible`, `enabled`, `is_default`, `sort_order`; đúng 1 mặc định) thay hằng số trong code. Ba mức trên được seed (`ON CONFLICT DO NOTHING`). `AiModelCatalogService` (`ai/ai-model-catalog.service.ts`) cache 30 giây, admin ghi xong thì làm mới ngay.
  - Người dùng: `GET /api/ai/models` (model bật + hiển thị) cho menu chọn. `PATCH /api/ai/settings` chỉ nhận model đang bật (còn lại ⇒ 400). Model đã chọn bị tắt / xóa ⇒ `AiSettingsService.get` trả model mặc định, quota tính theo model đó.
  - Admin: **N7AI › Model** (`GET/POST admin/ai/models`, `PATCH/DELETE admin/ai/models/:id`; quyền `ai:read` / `ai:manage`; audit `ai_model.create|update|delete`). Không tắt / xóa được model mặc định; xóa model thì người đang chọn chuyển về mặc định, `ai_runs` giữ nguyên tên cũ. Muốn hiện mức Sâu: bật *Hiện trong menu* sau khi gateway chạy được.
  - **Không lưu key**: API key và base URL vẫn là `AI_API_KEY` / `AI_BASE_URL` của server; thêm model ở gateway khác cần thêm cấu hình env trước (chưa hỗ trợ nhiều gateway trong danh mục).
- UI: `components/chat/ai/ai-model-picker.tsx` — nút thả xuống ngay trong ô soạn tin, cạnh nút gửi (thread N7AI trong `composer.tsx` và chat tạm), như "Instant" của ChatGPT; chọn xong lưu ngay vào cài đặt.
- Các việc nền (bình luận, tóm tắt, soạn skill/bộ thẻ) vẫn dùng `AI_MODEL` (mặc định `n7ai-fast` từ 2026-10-20; ngữ cảnh từng nơi: [`22`](./22-n7ai-context.md)).
