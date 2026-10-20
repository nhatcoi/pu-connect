# N7AI: chat tạm (không lưu)

Implemented: 2026-10-19. Route web `/n7ai/temporary` (mục "Chat tạm" ở thanh bên N7AI). API `POST /api/ai/temporary/stream`.

## Quyết định

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Lưu trữ | **Không** tạo `conversations` / `messages` / `ai_summaries`, không ghi bộ nhớ, học liệu, thư viện, chia sẻ | "Chat tạm" phải thật sự không để lại nội dung |
| Lịch sử | Nằm trong state client (`useTemporaryChat`); mỗi lượt gửi lại ≤ 30 tin (mỗi tin ≤ 8.000 ký tự) | Server stateless; tải lại / đóng tab / bấm "Xóa" là mất |
| Quota | Vẫn ghi 1 dòng `ai_runs` **không nội dung** (trigger `dm`, không `source_ref` / `reply_ref`) ⇒ tính lượt/ngày, Research = 2 lượt | Chống lạm dụng; không lộ nội dung |
| Cá nhân hóa | Không đọc bộ nhớ, hồ sơ học, tóm tắt, skill; prompt có `TEMPORARY_PROMPT` cấm dòng `[nhớ]` / nút hành động | Cuộc trò chuyện độc lập |
| Công cụ | Chỉ tool **đọc**: `puc__*` (Thư viện PU, app), `my_documents` / `my_groups` / `web` / `web_search` và connector Google theo cài đặt connector mặc định; **không** tool tạo Flashcard/Quiz, my_study, my_chats | Không ghi dữ liệu nào vào tài khoản |
| Tệp đính kèm | Chưa hỗ trợ (tệp phải lưu R2) | Tránh để lại tệp |
| Truyền tải | SSE qua `fetch` POST (`X-Accel-Buffering: no`): sự kiện `progress` (bước tìm nguồn/tool) · `delta` · `done` (text, gợi ý, nguồn, steps, thời gian) · `error` | Dùng lại `AiProgress`, `AiSteps`, `AiMessageBody` |

## Code

- API: `chat/n7ai/ai-temporary.service.ts` (không inject `DatabaseService`: không có đường ghi DB nào ngoài `LlmService` quota/run), `chat/dto/ai-temporary.dto.ts`, endpoint trong `n7ai.controller.ts`; kiểu `AiTemporaryInput/Event` ở `packages/schemas/src/chat.schema.ts`.
- Web: `lib/n7ai-temporary.ts` (đọc SSE), `hooks/use-temporary-chat.ts`, `components/n7ai/temporary-chat.tsx`, `app/(app)/n7ai/temporary/page.tsx`.
- Test: `apps/api/test/n7ai-temporary.e2e-spec.ts` (luồng stream, hết lượt, 401/400, số `messages`/`conversations` không đổi).

## Giới hạn đã biết

- Đóng kết nối giữa chừng chỉ dừng việc ghi sự kiện; model vẫn chạy đến hết lượt (tính 1 lượt).
- `ai_runs` còn giữ thời điểm, token, model (không có nội dung). Log hệ thống `agent.timings` không chứa câu hỏi.
