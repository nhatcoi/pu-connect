# N7AI: ngữ cảnh theo nơi được gọi

Implemented: 2026-10-20. Mặc định model nền là `n7ai-fast` (`AI_MODEL`, mã `llm.service.ts`). Mỗi nơi gọi N7AI có một "bộ dựng ngữ cảnh" riêng: AI đọc đúng thứ cần để hiểu, và chỉ đọc khi có người gọi `@n7ai`.

| Nơi gọi | AI đọc sẵn | Tool (chỉ đọc) | Quyền riêng tư |
|---|---|---|---|
| Bình luận (`@n7ai`) | Bài (≤ 6000 ký tự) kèm loại, môn học, cộng đồng, thẻ, trạng thái đã giải; nhánh bình luận đang hỏi (12); bình luận nổi bật ngoài nhánh (lời giải / nhiều thích, ≤ 6) | `post__comments` (đọc bình luận của đúng bài theo từ khóa), `puc__search` / `puc__read` công khai (tài liệu, bài viết) | Tác giả ẩn danh luôn là "Ẩn danh"; bình luận của người chặn nhau với người hỏi bị loại; câu trả lời công khai nên không dùng connector riêng |
| Nhóm chat · chat cá nhân (`@n7ai`) | Khối `<conversation>` (loại, tên nhóm, môn của nhóm học, mô tả, ≤ 30 thành viên) + 30 tin gần nhất có tên người gửi | `chat__earlier` (tin cũ của đúng hội thoại, theo từ khóa / số giờ gần đây, chỉ trước tin gọi), `puc__*` công khai | Chỉ đọc khi có người gọi; người hỏi phải là thành viên còn ở trong; không lưu tóm tắt nội dung nhóm; không dữ liệu riêng của người hỏi |
| Thread N7AI riêng | Giữ nguyên: lịch sử 20 tin + tóm tắt, bộ nhớ, hồ sơ học, connector | Theo connector | Giữ nguyên |
| Tóm tắt bài | Chỉ bài | — | — |

## Cách hoạt động

- `ai/context/context-budget.ts`: `clip`, `fitLines` (ngân sách ký tự theo thứ tự ưu tiên), `dataText` (vô hiệu thẻ `</post>`, `</conversation>`… giả trong nội dung người dùng để dữ liệu không đóng khối bao quanh).
- Bình luận: `posts/post-context.service.ts` (`PostContextService.load`, `postBlock`), `posts/post-thread-tools.service.ts`; `PostAiService.replyToComment` chạy `McpAgentService.stream` thay vì một lượt `llm.complete` (không connector Google, tối đa 4 vòng / 8 lệnh như mặc định).
- Chat: `chat/n7ai/context/conversation-context.service.ts` (khối `<conversation>`, ghép vào system prompt cạnh `GROUP_PROMPT`), `conversation-tools.service.ts` (`chat__earlier`). `GROUP_HISTORY_LIMIT` 12 → 30, mỗi tin cắt 1200 ký tự.
- `PostsModule` import `ChatModule` (xuất `PucToolsService`) để bình luận dùng chung tool tìm kiếm công khai.
- Prompt: `COMMENT_PROMPT` (`ai/ai.prompts.ts`) và `GROUP_PROMPT` (`chat/n7ai/n7ai.prompts.ts`) hướng dẫn thứ tự hiểu: xác định yêu cầu chính → suy bối cảnh học thuật → chỉ tra tool khi thiếu → dựa lời giải sẵn có → không đoán danh tính ẩn danh.

## Giới hạn

- Chưa có tóm tắt cuộn cho nhóm: tin cũ hơn 30 tin chỉ đọc được qua `chat__earlier` khi người gọi hỏi tới.
- Chưa có test gọi model thật cho luồng agent (không có gateway trong CI); test e2e `test/ai-context.e2e-spec.ts` kiểm bộ dựng ngữ cảnh, quyền và tool.
