# 🧭 N7AI Agent: Hội thoại cũ · Tool PU Connector · Nút dẫn đường · Hồ sơ học

> Trạng thái: **Đã triển khai (2026-10-18)**. Nối tiếp [`14-google-mcp-connectors.md`](./14-google-mcp-connectors.md) (vòng tool, `AgentToolSession`) và [`15-study-tools.md`](./15-study-tools.md) (`my_study`).

## 1. Nguyên tắc: dữ liệu đặt ở đâu

Ngữ cảnh nhỏ, cần thiết được nạp sẵn; tìm dữ liệu theo yêu cầu là tool do model chọn. Một lượt model có thể yêu cầu nhiều tool độc lập, harness chạy song song có giới hạn. Chi tiết tối ưu: [18-agent-harness-performance.md](./18-agent-harness-performance.md).

| Loại dữ liệu | Đặt ở | Ví dụ |
|---|---|---|
| Nhỏ, lượt nào cũng cần | System prompt | Hồ sơ học, mục nhớ ghim, giờ hiện tại |
| Truy xuất thư viện / nguồn được bật | Tool khi cần | `puc__search` dùng full-text + vector; không tìm trước mọi câu hỏi |
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
- `puc__search(query, queries?, type?)` tìm tối đa 3 biến thể từ khóa cùng lúc: bài/tài liệu qua `RagSearchService`, học phần/người/nhóm qua `SearchService`, cộng đồng qua SQL có giới hạn. Bài/tài liệu theo connector `library`. Kết quả ngắn, loại trùng, tối đa 5 mỗi loại.
- `puc__read(type, id)` đọc sâu bài/tài liệu đã tìm thấy; kiểm quyền lại, không dùng khi chỉ cần liệt kê tài liệu.
- Mỗi kết quả có `href` trong app. Nhóm học kèm `id`, sĩ số, `status`.
- `puc__app_help(topic?)` đọc danh mục tính năng `agent/puc-app-guide.ts` (tên, trang, cách dùng). Khớp từ khóa bỏ dấu; không khớp thì trả cả danh mục rút gọn.
- Nhóm chat chỉ có search/read bài và tài liệu công khai; không có nguồn riêng hay app_help.

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

## 6. Bộ nhớ tự ghi tiến độ học

`study-tools/study-progress-memory.service.ts`: sau mỗi lần ôn flashcard (`StudyToolsService.review`) hoặc làm quiz (`.attempt`), khi transaction đã xong, N7AI ghi **1 mục bộ nhớ cho mỗi bộ**. Ví dụ:

> Đang ôn Flashcard "Vũ trụ" (29 thẻ): đã thuộc 5, đến hạn ôn 3, hay quên: Wormhole, Contract (cập nhật 18/10)

> Đã làm Quiz "Giải tích" (10 câu) 3 lần, điểm cao nhất 80% (cập nhật 18/10)

- **Ghi đè, không trùng.** `ai_memories.study_set_id` có unique `(user_id, study_set_id)`, nên mỗi lần ôn cập nhật nội dung và đưa mục lên mới nhất. Cờ ghim được giữ. Chỉ giữ mục tiến độ của 10 bộ học gần nhất (trừ mục ghim).
- **Theo công tắc ghi nhớ.** Tắt "Cho phép N7AI ghi nhớ" thì không ghi. Bộ bị xóa thì mục bị xóa theo (FK `ON DELETE CASCADE`). Người dùng xóa mục thì lần ôn sau ghi lại.
- **Chạy nền.** Lỗi khi ghi chỉ ghi log, không làm hỏng lượt ôn.
- **Cách N7AI đọc.** N7AI đọc như mọi mục nhớ khác (trigram + mới nhất), nên nhắc ôn / từ hay quên mà không cần gọi tool. Muốn chi tiết từng thẻ thì dùng tool `my_study__*`.
- Trạng thái thẻ dùng chung định nghĩa với tool `my_study` (`study-progress.sql.ts`).

## 7. Dữ liệu & vận hành

- Migration `ai-agent-upgrade.sql`: 3 cột hồ sơ, `ai_memories.pinned`, `ai_memories.study_set_id` (+ unique theo người dùng). Bật `my_chats` **đúng 1 lần** cho người đã có cài đặt, với mốc là DEFAULT của cột ⇒ người tự tắt không bị bật lại.
- Bước tiến trình: provider `my_chats` (icon hội thoại), `puc` (logo PU). `AiStep.provider: AiStepSource = AiConnectorId | 'puc' | 'refs' | 'files' | 'memory'`.

## 8. Tiến trình trả lời & khung tin N7AI (2026-10-19)

Gateway (`v9`) không stream phần suy nghĩ của model (delta chỉ có `content`, và gửi theo vài cục lớn) ⇒ không hiện được "suy nghĩ thô". UI hiện **tiến trình thật** mà server biết, không có dữ liệu nguồn (chỉ nhãn + số lượng):

| Bước | Nguồn (`provider`) | Ví dụ |
|---|---|---|
| Mục gắn @ | `refs` | Đọc mục bạn gắn kèm · 2 mục |
| Bộ nhớ dài hạn | `memory` | Nhớ lại điều đã biết về bạn · 3 mục |
| Tệp đính kèm / tài liệu đang thảo luận | `files` | Đọc tệp đính kèm · bai-giang.pdf → 1 tệp |
| Tìm nguồn lấy sẵn | `library`, `my_documents`, `my_groups`, `web_search`, `web` (chỉ khi đọc được trang) | Tìm trong Thư viện PU · <câu hỏi> → 4 nguồn |
| Tool của agent | connector / `puc` | Tìm học phần · giải tích |

- `AiProgress` (`chat/n7ai/agent/ai-progress.ts`) gộp bước chuẩn bị + bước tool, mỗi lần đổi phát lại cả danh sách qua `message.progress`. `AiRetrieval.retrieve(..., { onStage })` báo từng connector (chạy / xong + số nguồn / lỗi).
- Tin xong lưu `meta.steps` + `meta.durationMs` ⇒ thu gọn "Đã xử lý 6.2s · 4 nguồn · 2 công cụ", bấm mở lại timeline.
- Web `AiSteps`: đang trả lời ⇒ timeline (icon theo nguồn, spinner / ✓ / lỗi) + dòng trạng thái "Đang suy nghĩ / Đang xử lý / Đang viết câu trả lời · 3.4s" (đồng hồ tính từ lúc tạo tin).
- Khung tin N7AI rộng hơn tin chat thường: cột tối đa `min(94%, 52rem)` (mobile 100%), bong bóng co theo nội dung (câu ngắn gọn gàng, dài thì giãn hết cột).
- Gateway cắt luồng trước khi có chữ / tool call (`terminated`, socket reset — lỗi "N7AI gặp lỗi" 15:00 ngày 2026-10-19) ⇒ `McpAgentService` thử lại vòng đó 1 lần; đã có chữ thì không thử lại (tránh lặp nội dung).

## 9. Kiểm thử

`apps/api/test/n7ai-agent-tools.e2e-spec.ts` gồm 4 nhóm:
- **Hội thoại cũ:** tìm bỏ dấu, đọc lại, chặn thread hiện tại / thread của người khác.
- **Tool PUC:** tìm nhóm học / cộng đồng, hướng dẫn app, nhóm tham gia được.
- **Nút:** chặn link ngoài / sai định dạng, nhóm không hợp lệ bị bỏ, không lẫn vào câu gợi ý.
- **Hồ sơ học & ghim:** lưu / xóa từng trường, giới hạn độ dài, mục ghim luôn được nhớ.
- **Bộ nhớ tiến độ:** 2 lượt ôn vẫn 1 mục; nội dung có thẻ hay quên; quiz ghi điểm; tắt ghi nhớ ⇒ không ghi; xóa bộ ⇒ xóa mục.
- **Tiến trình:** gộp bước chuẩn bị / tìm nguồn / tool, `web` chỉ hiện khi đọc được trang, `onStage` của retrieval.
- **Luồng bị cắt:** cắt trước khi có chữ ⇒ thử lại 1 lần và trả lời bình thường; đã có chữ ⇒ báo lỗi.

**Model thật (2026-10-18):** script chạy trên VPS với model đang dùng, prompt và tool thật, kết quả tool giả (không chạm dữ liệu người dùng).
- "nhóm học Giải tích đang tuyển" ⇒ `puc__search`, kèm nút tham gia + mở học phần.
- "làm flashcard ở đâu" ⇒ `puc__app_help`, kèm nút `/tools`.
- "lần trước hỏi gì về đạo hàm riêng" ⇒ `search_threads` → `get_thread`, trích đúng thread.
- Câu hỏi gợi ý không lẫn dòng nút.

## Changelog

- 2026-10-19 — Tiến trình trả lời (tệp, bộ nhớ, tìm nguồn kèm số nguồn, tool, thời gian xử lý), khung tin N7AI rộng hơn, tự thử lại khi gateway cắt luồng sớm.

- 2026-10-18 — Bộ nhớ tự ghi tiến độ: 1 mục / bộ sau mỗi lần ôn / làm quiz (thay bản tóm tắt `<study_progress>` tính lúc hỏi, đã gỡ); kiểm hành vi model thật.
- 2026-10-18 — Bản đầu: `my_chats`, `puc__search` / `puc__app_help`, `meta.actions` (link + tham gia nhóm có xác nhận), hồ sơ học, ghim bộ nhớ.

- 2026-10-19 — Chat bỏ prefetch bắt buộc; tìm nội bộ theo model, batch từ khóa, search/read riêng; harness cache/scheduling/timing và MCP lazy ([18](./18-agent-harness-performance.md)).

## 10. Tìm chủ động, ít bước (2026-10-20)

Nguyên nhân một câu như "tìm cho mình với idea mình đang có trên Semantic Scholar" tốn 5 bước mà không ra kết quả:

- `my_chats__search_threads` yêu cầu **mọi từ** khớp (AND) ⇒ "NCKH y tế AI" rỗng, model thử lại "y tế", rồi "NCKH" (3 bước). Nay khớp **bất kỳ** từ, xếp theo số từ khớp (tiêu đề / tóm tắt tính gấp đôi) rồi mới nhất; mô tả tool dặn gọi **một lần**, không thử lại với ít từ hơn.
- Model chưa có chỉ dẫn "hành động trước, hỏi sau" nên tra hội thoại cũ / tài liệu rồi quay sang hỏi người dùng. Nay prompt agent dặn: gọi tool phù hợp ngay với từ khóa đoán từ hội thoại / bộ nhớ / hồ sơ, tra nguồn riêng tối đa 1 lần rồi sang nguồn ngoài (bài báo, web) trong cùng lượt; chỉ hỏi lại khi không thể hiểu yêu cầu. `semantic_scholar__search` được dặn gọi thẳng với 1–2 từ khóa tiếng Anh.
- Google lazy MCP cấp tool `*__discover_tools` cho mọi dịch vụ được chọn kể cả **chưa kết nối** ⇒ model gọi Drive rồi báo lỗi. Nay chỉ cấp cho dịch vụ có grant trong `user_connectors`.
- Nhãn bước bộ nhớ trở lại "Nhớ lại điều đã biết về bạn".

Ranh giới của model chỉ là các công tắc connector của người dùng (menu Connectors); ngoài đó model tự chọn tool.

## 11. Bớt lời thừa, bước rõ ràng (2026-10-20)

- Prompt agent: dữ liệu riêng (hội thoại cũ, tài liệu, nhóm, tiến độ học) **chỉ tra khi câu hỏi nhắc tới** ("của mình", "mình đang có", "lần trước", "tài liệu mình đã up"), một lần, rồi sang nguồn ngoài; câu hỏi chung đi thẳng nguồn công khai. Tra không thấy gì ⇒ **không nhắc** ("Chưa có … trong hồ sơ, chat cũ, tài liệu" bị bỏ), chỉ nói "không tìm thấy" khi người dùng hỏi chính dữ liệu đó; giả định thiếu thông tin ghi 1 dòng ở cuối.
- `AiStep.resultCount`: `AgentToolRunner` đếm kết quả của tool đọc thành công (`countResults`: mảng ⇒ độ dài, object ⇒ tổng các mảng con; đọc 1 mục / MCP ⇒ không đếm). Web (`ai-steps.tsx`) hiện "· 3 kết quả" / "· không có kết quả" và làm mờ bước rỗng.
- Tóm tắt khi xong đếm đúng: **công cụ** = mọi bước trừ bước chuẩn bị (tệp, mục gắn @, bộ nhớ) — trước đây bỏ sót "Tài liệu của tôi", "Thư viện PU"…; **nguồn** = tổng `resultCount` (tin cũ vẫn đọc số trong `detail`).
- Test: `apps/api/test/agent-step-results.e2e-spec.ts`.

## 12. Tìm bài báo ổn định, câu trả lời sạch (2026-10-20)

So sánh với Claude cho câu "nghiên cứu train AI cho y tế": N7AI có Scholar mất 41 s, gọi Scholar 4 lần đều rỗng, mở đầu bằng kể quá trình, danh sách mất dấu đầu dòng. Đo trên VPS: Semantic Scholar không key ⇒ **429 mọi lần**; arXiv giới hạn ~1 yêu cầu / 3 s, gọi song song ⇒ hết giờ 8 s; cả hai lỗi bị nuốt thành "rỗng".

- `SemanticScholarService`: lỗi ≠ rỗng — cả S2 và arXiv đều lỗi ⇒ `AcademicSearchUnavailableError`; arXiv xếp hàng tuần tự (cách ≥ 3,1 s, timeout 15 s); cache 10 phút / từ khóa (≤ 200 mục). Có `SEMANTIC_SCHOLAR_API_KEY` thì hết 429.
- `AiRetrieval.retrieve` ghi `failures` thật (trước đây luôn rỗng); `RetrievalToolsService` trả `toolUnavailable` khi nguồn lỗi mà không có kết quả.
- `AgentToolRunner`: tool trả `unavailable: true` ⇒ không gọi lại tool đó trong cùng lượt.
- Prompt: không tường thuật công cụ / quá trình (UI đã hiện bước), nguồn ngoài lỗi ⇒ tối đa 1 dòng ở cuối; chỉ nhắc người dùng / nhóm trong app khi câu hỏi về người; câu hỏi tổng quan / nghiên cứu ⇒ cụ thể như trợ lý nghiên cứu (phương pháp, dataset, benchmark, venue, bước bắt đầu) với tiêu đề + gạch đầu dòng.
- Web: `.markdown-body ul/ol/li` có lại dấu đầu dòng / số thứ tự (Tailwind preflight đã xóa) — ảnh hưởng mọi nơi dùng `MarkdownPreview`.
- Test: `apps/api/test/agent-step-results.e2e-spec.ts` (chặn gọi lại, S2 429 ⇒ arXiv, cache, cả hai lỗi ⇒ ném lỗi).

