# 🧭 N7AI Agent: Hội thoại cũ · Tool PU Connector · Nút dẫn đường · Hồ sơ học

> Trạng thái: **Đã triển khai (2026-10-18)**. Nối tiếp [`14-google-mcp-connectors.md`](./14-google-mcp-connectors.md) (vòng tool, `AgentToolSession`) và [`15-study-tools.md`](./15-study-tools.md) (`my_study`).

## 1. Nguyên tắc: dữ liệu đặt ở đâu

Không phải thứ gì cũng nên là tool. Mỗi lần gọi tool tốn thêm 1 lượt LLM (chậm 1–3 s), mô tả tool đi kèm mọi request, và quá nhiều tool làm model chọn sai.

| Loại dữ liệu | Đặt ở | Ví dụ |
|---|---|---|
| Nhỏ, lượt nào cũng cần | System prompt | Hồ sơ học, mục nhớ ghim, giờ hiện tại |
| Truy xuất rẻ, hay dùng | Lấy sẵn trước khi gọi model | Thư viện PU (`AiRetrieval`) |
| Lớn, có điều kiện, dữ liệu riêng | Tool | Hội thoại cũ, tiến độ học, Gmail / Drive, tìm trong PUC |
| Giao diện | Tool hoặc dòng đánh dấu có cấu trúc | Bộ flashcard / quiz, nút dẫn đường |
| Ghi / thay đổi dữ liệu | Đề xuất ⇒ người dùng bấm xác nhận | Tham gia nhóm học |

Tool nội bộ chạy chung vòng `McpAgentService` với Google MCP qua `AgentToolSession` (`ai/agent-tools.ts`). Mỗi lượt chỉ gửi tool của nguồn đang bật. Tham số model đưa vào được kiểm bằng `ai/agent-tool-args.ts` (uuid, enum, giới hạn, escape LIKE), kết quả ≤ 12k ký tự.

## 2. "Hội thoại của tôi" (connector `my_chats`, bật sẵn)

`chat/n7ai/agent/history-tools.service.ts`. Chỉ thread N7AI riêng, chỉ `type = 'ai' AND created_by = người hỏi`, luôn bỏ thread đang mở.

| Tool | Việc |
|---|---|
| `my_chats__search_threads(query?, days?, limit ≤ 8)` | Mọi từ khóa (bỏ dấu) khớp tiêu đề + tóm tắt hoặc một tin; trả tiêu đề, ngày, tóm tắt, đoạn khớp |
| `my_chats__get_thread(thread_id, query?)` | Tóm tắt + ≤ 16 tin (khớp từ khóa, hoặc mới nhất), mỗi tin ≤ 700 ký tự |

Không làm tool cho bộ nhớ: dòng `[nhớ]` ghi trong cùng lượt trả lời đã đủ, không tốn thêm lượt.

## 3. Tool PU Connector (`puc`, luôn có trong thread riêng)

`chat/n7ai/agent/puc-tools.service.ts`:
- `puc__search(query, type?)` dùng lại `SearchService.search`, nên đúng quyền xem như trang Tìm kiếm. Limit ≤ 5 để không ghi `search_logs`. Thêm cộng đồng bằng truy vấn riêng.
- Mỗi kết quả có `href` trong app. Nhóm học kèm `id`, sĩ số, `status`.
- `puc__app_help(topic?)` đọc danh mục tính năng `agent/puc-app-guide.ts` (tên, trang, cách dùng). Khớp từ khóa bỏ dấu; không khớp thì trả cả danh mục rút gọn.
- Nhóm chat không có tool này.

## 4. Nút dẫn đường & hành động cần xác nhận

Model ghi thêm dòng sau dấu mốc `<<<FOLLOWUPS>>>`, cùng lượt trả lời, không tốn request:

```
[mở] Học phần IT101 | /courses/IT101
[tham gia] <id nhóm học>
```

`agent/ai-actions.ts` kiểm từng dòng:
- `safeAppHref`: chỉ đường dẫn tương đối thuộc danh sách route của app. `/search` chỉ giữ `q`, `type`. Chặn host ngoài, `//`, `javascript:`, hash.
- `[tham gia]`: `PucToolsService.joinableGroups` kiểm nhóm đang tuyển, chưa đủ, mình chưa là thành viên.
- Tối đa 3 nút ⇒ `meta.actions: AiAction[]`. Dòng có nhãn `[...]` không bao giờ bị lấy làm câu hỏi gợi ý.

Web (`components/chat/ai/ai-actions.tsx`):
- Link mở trang trong app, không tự chuyển.
- "Tham gia nhóm …" chỉ chạy khi người dùng bấm (`useJoinStudyGroup` ⇒ `POST /study-groups/:id/join`; server kiểm sĩ số trong transaction). Xong thì nút đổi thành "Đã tham gia · Xem nhóm".
- Trang chia sẻ công khai không hiện nút.

## 5. Hồ sơ học & ghim bộ nhớ

- `ai_settings.profile_goal / profile_about / profile_style` (≤ 300 / 600 / 300). `PATCH /ai/settings { profile: { goal?, about?, style? } }`: chuỗi rỗng / null ⇒ xóa, trường không gửi ⇒ giữ.
- `learnerPrompt` ghép tên, trường, khoa, ngành, lớp, khóa (bảng `users`) với hồ sơ tự viết vào `<learner>` trong system prompt. Chỉ thread riêng.
- Web: `/n7ai/settings/profile` (`ProfilePanel`).
- `ai_memories.pinned`, `PATCH /ai/memories/:id/pin { pinned }`:
  - Mục ghim luôn được nhớ, xếp trước kết quả trigram.
  - Không bị dọn khi vượt 100 mục.
  - Danh sách xếp ghim trước.
  - Nút ghim ở Cài đặt › Bộ nhớ.

## 6. Tiến độ học tóm tắt (thay "ghi bộ nhớ sau mỗi lần ôn")

`agent/study-digest.service.ts` tính **lúc hỏi** từ lịch ôn, không ghi vào `ai_memories`. Lý do: luôn mới, không sinh mục trùng mỗi lần ôn, không cần sửa luồng ôn (`study-tools`).
- **Phạm vi:** ≤ 3 bộ học gần nhất trong 30 ngày. Flashcard: số thẻ đã thuộc, đến hạn, ≤ 5 thẻ hay quên nhất. Quiz: điểm cao nhất.
- **Dùng chung định nghĩa** trạng thái thẻ với tool `my_study` (`study-progress.sql.ts`).
- **Vào system prompt** thành khối `<study_progress>`, chỉ khi bật connector `my_study`. N7AI chủ động nhắc ôn thẻ đến hạn / từ hay quên mà không cần gọi tool; muốn xem chi tiết thì gọi `my_study__*`.

## 7. Dữ liệu & vận hành

- Migration `ai-agent-upgrade.sql`: 3 cột hồ sơ, `ai_memories.pinned`. Bật `my_chats` **đúng 1 lần** cho người đã có cài đặt, với mốc là DEFAULT của cột ⇒ người tự tắt không bị bật lại.
- Bước tiến trình: provider `my_chats` (icon hội thoại), `puc` (logo PU). `AiStep.provider: AiToolProvider = AiConnectorId | 'puc'`.

## 8. Kiểm thử

`apps/api/test/n7ai-agent-tools.e2e-spec.ts` gồm 4 nhóm:
- **Hội thoại cũ:** tìm bỏ dấu, đọc lại, chặn thread hiện tại / thread của người khác.
- **Tool PUC:** tìm nhóm học / cộng đồng, hướng dẫn app, nhóm tham gia được.
- **Nút:** chặn link ngoài / sai định dạng, nhóm không hợp lệ bị bỏ, không lẫn vào câu gợi ý.
- **Hồ sơ học & ghim:** lưu / xóa từng trường, giới hạn độ dài, mục ghim luôn được nhớ.
- **Tiến độ tóm tắt:** chưa học ⇒ không có khối; ôn "Quên" ⇒ thẻ vào danh sách hay quên.

**Model thật (2026-10-18):** script chạy trên VPS với model đang dùng, prompt và tool thật, kết quả tool giả (không chạm dữ liệu người dùng).
- "nhóm học Giải tích đang tuyển" ⇒ `puc__search`, kèm nút tham gia + mở học phần.
- "làm flashcard ở đâu" ⇒ `puc__app_help`, kèm nút `/tools`.
- "lần trước hỏi gì về đạo hàm riêng" ⇒ `search_threads` → `get_thread`, trích đúng thread.
- Câu hỏi gợi ý không lẫn dòng nút.

## Changelog

- 2026-10-18 — Tiến độ học tóm tắt `<study_progress>` (thay ghi bộ nhớ sau mỗi lần ôn); kiểm hành vi model thật.
- 2026-10-18 — Bản đầu: `my_chats`, `puc__search` / `puc__app_help`, `meta.actions` (link + tham gia nhóm có xác nhận), hồ sơ học, ghim bộ nhớ.
