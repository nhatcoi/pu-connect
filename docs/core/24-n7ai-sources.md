# N7AI: tài liệu của cuộc trò chuyện và kéo thả

Implemented: 2026-10-21.

Một cuộc trò chuyện N7AI (hoặc thư viện) có **tài liệu** để N7AI đọc ở mọi lượt trả lời: tóm tắt, quiz, flashcard… không cần gửi lại tệp.

## Loại tài liệu

| Loại | Cách thêm | Lưu |
|---|---|---|
| `file` | Tải lên, kéo thả, từ thư viện | Tệp trên R2 (`chat/<user>/…`), dòng `ai_sources` giữ `file_key` |
| `text` | Dán văn bản (≤ 100.000 ký tự) | `content` |
| `url` | Link trang web công khai | Chữ đã trích (≤ 100.000 ký tự) |
| `youtube` | Link video có phụ đề | Phụ đề, gom đoạn ~30 giây kèm mốc `[mm:ss]` |

`ai_sources` (`ai-sources-upgrade.sql`): `thread_id` NULL = thư viện riêng. Xóa thread ⇒ xóa tài liệu (`ON DELETE CASCADE`). Giới hạn: 30 tài liệu / cuộc trò chuyện, 100 / thư viện.

## API

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/ai/sources?threadId=` | Bỏ `threadId` ⇒ thư viện; thread không phải của mình ⇒ 404 |
| GET | `/ai/sources/:id/content` | Chữ của `text` / `url` / `youtube` |
| POST | `/ai/sources` | `{type:'file', file:{key,name,size,mime}}` · `{type:'text', title?, content}` · `{type:'link', url}` · `{type:'copy', threadId, sourceId}`; thêm `threadId` ⇒ vào thread, không có ⇒ thư viện |
| DELETE | `/ai/sources/:id` | Chỉ xóa dòng tài liệu, không xóa tệp trên R2 |

Kiểm tra phía máy chủ:

- Tệp phải của chính mình (`isOwnedKey`, chặn `..`) và N7AI đọc được: PDF, Word, PowerPoint, Excel, văn bản / mã nguồn hoặc ảnh. ZIP, video, âm thanh bị từ chối.
- Thêm lại cùng tệp / cùng link vào cùng nơi ⇒ trả dòng cũ, không trùng.
- Link: chỉ http(s), cổng 80/443, từng chặng redirect đều kiểm tra địa chỉ (chặn mạng nội bộ, SSRF), tối đa 1 MB, 8 giây; chỉ HTML / văn bản. Trang gần như không có chữ ⇒ báo lỗi.
- YouTube: đọc track phụ đề (ưu tiên tiếng Việt, rồi tiếng Anh; phụ đề người làm trước phụ đề tự động); `baseUrl` phải thuộc `*.youtube.com`. Video không có phụ đề ⇒ 422 kèm hướng dẫn. YouTube có thể chặn IP máy chủ ⇒ 502 "thử lại hoặc dán nội dung".

## N7AI đọc tài liệu

`n7ai.service.ts` (cuộc trò chuyện riêng, không phải nhóm): sau tệp gửi kèm tin và tài liệu gần nhất, thêm tài liệu của thread: tệp qua `attachmentParts` (cache theo key), chữ qua `source-context.ts` (≤ 30.000 ký tự / tài liệu, ≤ 60.000 tổng, mới nhất trước). Tệp trùng key với tệp đã gửi kèm không đọc lại.

Đọc được nội dung (`doc-text.ts`): PDF, Word, **PowerPoint** (chữ từng slide), **Excel** (từng sheet, ≤ 500 dòng), TXT, Markdown, CSV, mã nguồn.

## Giao diện

- Panel phải, tab **Tài liệu**: danh sách = tài liệu đã thêm + tệp đã gửi trong tin nhắn; nút **Thêm tài liệu** (tải tệp · từ thư viện · dán văn bản · link web / YouTube); tài liệu đã thêm có nút bỏ. Bấm tệp ⇒ trình xem tệp; bấm tài liệu chữ ⇒ trình xem chữ (YouTube có mốc thời gian, mở trang gốc).
- Tab **Công cụ**: chọn nguồn là cả cuộc trò chuyện hoặc một tài liệu bất kỳ.
- Thư viện (`/n7ai/library`): nút **Thêm tài liệu** (không có "từ thư viện"), mục "Đã thêm vào thư viện".

## Kéo thả

| Thả ở đâu | Kết quả |
|---|---|
| Bất kỳ đâu trên trang có ô chat | Đính kèm vào tin nhắn đang soạn (gợi ý "Thả để đính kèm vào tin nhắn", ô chat có viền) |
| Panel Tài liệu | Thêm vào tài liệu của cuộc trò chuyện |
| Trang Thư viện | Thêm vào thư viện |

- Khi kéo tệp vào trang, các vùng thả hiện viền nét đứt; vùng đang rê lên đậm hơn. Thả trong vùng riêng thì ô chat không nhận.
- Kéo tệp đã gửi (thẻ tệp trong chat, hàng ở panel) vào ô chat hoặc panel ⇒ dùng lại, không tải lên nữa (`application/x-n7ai-attachment`, kiểm bằng schema).
- Kiểm tra trước khi tải: dung lượng ≤ 25 MB, đuôi tệp được hỗ trợ (`attachment-files.ts`); tài liệu học còn phải là loại N7AI đọc được.
- Mã: `components/chat/composer/{use-file-drop,drop-zone,drop-hint,attachment-files}`, `components/n7ai/sources/`.

Test: `n7ai-sources.e2e-spec.ts`, `doc-text.e2e-spec.ts`.
