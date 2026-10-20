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

  - **Không lưu key**: danh mục model chỉ chứa *tên* model; API key và base URL do provider quản lý ([Provider AI](#provider-ai-do-admin-quản-lý)) hoặc `AI_*` trong env.
- UI: `components/chat/ai/ai-model-picker.tsx` — nút thả xuống ngay trong ô soạn tin, cạnh nút gửi (thread N7AI trong `composer.tsx` và chat tạm), như "Instant" của ChatGPT; chọn xong lưu ngay vào cài đặt.
- Các việc nền (bình luận, tóm tắt, soạn skill/bộ thẻ) vẫn dùng `AI_MODEL` (mặc định `n7ai-fast` từ 2026-10-20; ngữ cảnh từng nơi: [`22`](./22-n7ai-context.md)).

## Provider AI do admin quản lý

Gateway (base URL + API key, OpenAI-compatible) không còn chỉ nằm trong `.env`: bảng `ai_providers` (migration `ai-providers-upgrade.sql`) do **Admin › N7AI › LLM** quản lý (provider và model chung một tab). Model (mục trên) và provider độc lập nhau: model là *tên* gửi lên gateway, provider là *nơi* gửi.

- **Cột**: `name`, `base_url`, `api_key_enc` (AES-256-GCM qua `TokenCipher`, khóa `CONNECTOR_ENCRYPTION_KEY` hoặc `SESSION_SECRET`), `key_hint` (4 ký tự cuối), `model_override`, `enabled`, `priority`.
- **Thứ tự thử**: `priority` nhỏ trước. Provider đầu tiên đang bật là *chính*, các provider sau chỉ được gọi khi provider phía trước lỗi gateway (mất kết nối, timeout, 401/403/404/408/429, 5xx). Provider lỗi bị bỏ qua 60 giây; tất cả cùng lỗi thì thử lại toàn bộ. 400/422 là lỗi yêu cầu, không chuyển provider.
- **Tên model**: gửi đúng mức model N7AI người dùng chọn; provider có `model_override` thì luôn gọi model đó (dùng cho provider dự phòng có tên model khác). Provider dự phòng được báo cho model là "(dự phòng)" trong câu danh tính.
- **Nguồn cấu hình** (`AiProviderRegistry`, `ai/ai-provider.registry.ts`): có ít nhất một provider bật trong DB ⇒ dùng DB; bảng trống / lỗi đọc DB / không giải mã được key ⇒ dùng env (`AI_BASE_URL` + `AI_API_KEY` là chính, `AI_FALLBACK_*` là dự phòng với model `AI_FALLBACK_MODEL`). Cache 30 giây, admin ghi xong làm mới ngay; `LlmService.client` (đồng bộ) luôn trả provider chính, không bao giờ rỗng trong lúc nạp lại.
- **Admin API** (`admin/ai/providers`): `GET` (danh sách + `source` = `database` | `env` + host cấu hình env, không key), `POST`, `PATCH :id` (`apiKey` bỏ trống = giữ key cũ), `DELETE :id`, `POST :id/move` (`up` | `down`), `POST :id/test` (gọi `GET {baseUrl}/models`, chỉ trả OK / độ trễ / số model / lý do ngắn, không trả nội dung phản hồi), `POST import-env` (chuyển cấu hình env sang DB khi bảng còn trống). `base_url` chỉ http(s), không nhúng tài khoản. Key chỉ đi một chiều admin → server; không endpoint nào trả lại, nhật ký chỉ ghi tên trường đã đổi.
- **Lưu ý khi thêm provider đầu tiên**: danh sách DB thay thế hoàn toàn cấu hình env, nên nhập env trước (nút *Nhập cấu hình từ máy chủ*). Xóa / tắt provider cuối cùng ⇒ hệ thống quay về env.
- **Gắn provider theo model** (`ai-llm-upgrade.sql`): `ai_models` thêm `provider_id` (NULL = chuỗi mặc định), `upstream_model` (tên gửi lên provider, NULL = `id`), `reasoning_effort` (`low|medium|high`), `max_input_tokens`, `max_output_tokens`. `LlmService.chat()` tra danh mục (`AiModelCatalogService.find`), đưa provider của model lên đầu chuỗi (`registry.chain(preferredId)`), lỗi gateway thì rơi về provider khác (dùng `model_override ?? upstream_model`). `reasoning_effort` chỉ gửi khi gọi đúng tên model đã cấu hình; `max_output_tokens` là trần của `max_tokens`; `max_input_tokens` cắt bớt tin cũ nhất (`fitInput`, ước lượng 3 ký tự/token, giữ system + tin mới nhất, không để lại tin `tool` mồ côi).
- **Dò model**: `GET admin/ai/providers/:id/models` gọi `GET {baseUrl}/models` bằng key đã lưu, chỉ trả danh sách tên (+ đã thêm chưa). `POST admin/ai/models/bulk` thêm nhiều model một lần (mã tự tạo từ tên upstream, gắn provider). Luồng UI: Thêm provider → tự dò model → chọn + đặt tên hiển thị → model vào danh mục ở trạng thái ẩn khỏi menu.
- **Chưa làm**: thống kê lượt chạy / lỗi theo provider (`ai_runs` chưa ghi provider), OCR / embedding / bot-import vẫn đọc env riêng. Test: `ai-provider-registry.e2e-spec.ts`, `llm-fallback.e2e-spec.ts`.
