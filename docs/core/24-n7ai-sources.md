# N7AI: tài liệu của cuộc trò chuyện và kéo thả

Implemented: 2026-10-21.

Một cuộc trò chuyện N7AI (hoặc thư viện) có **tài liệu** để N7AI đọc ở mọi lượt trả lời: tóm tắt, quiz, flashcard… không cần gửi lại tệp.

## Loại tài liệu

| Loại | Cách thêm | Lưu |
|---|---|---|
| `file` | Tải lên, kéo thả, từ thư viện, từ kho tài liệu | Tệp trên R2 (`chat/<user>/…`), dòng `ai_sources` giữ `file_key`. Tệp từ kho (`documents/…`) không sao chép: `meta.documentId` trỏ về tài liệu gốc |
| `text` | Dán văn bản (≤ 100.000 ký tự) | `content` |
| `url` | Link trang web công khai | Chữ đã trích (≤ 100.000 ký tự) |
| `youtube` | Link video có phụ đề | Phụ đề, gom đoạn ~30 giây kèm mốc `[mm:ss]` |

`ai_sources` (`ai-sources-upgrade.sql`): `thread_id` NULL = thư viện riêng. Xóa thread ⇒ xóa tài liệu (`ON DELETE CASCADE`). Giới hạn: 30 tài liệu / cuộc trò chuyện, 100 / thư viện.

## API

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/ai/sources?threadId=` | Bỏ `threadId` ⇒ thư viện; thread không phải của mình ⇒ 404 |
| GET | `/ai/sources/:id/content` | Chữ của `text` / `url` / `youtube` |
| POST | `/ai/sources/collection` | `{threadId?, collectionId}`: thêm cả bộ sưu tập (công khai hoặc của mình); trả `{added, skipped}`, bỏ qua tài liệu trùng / chưa đọc được / vượt giới hạn |
| POST | `/ai/sources` | `{type:'file', file:{key,name,size,mime}}` · `{type:'text', title?, content}` · `{type:'link', url}` · `{type:'copy', threadId, sourceId}` · `{type:'document', documentId}` (tài liệu công khai hoặc của mình, đúng định dạng N7AI đọc được); thêm `threadId` ⇒ vào thread, không có ⇒ thư viện |
| PATCH | `/ai/sources/:id` | `{inContext: boolean}`: tắt / bật cho N7AI đọc (không xóa); không phải của mình ⇒ 404 |
| DELETE | `/ai/sources/:id` | Chỉ xóa dòng tài liệu, không xóa tệp trên R2 |

Kiểm tra phía máy chủ:

- Tệp phải của chính mình (`isOwnedKey`, chặn `..`) và N7AI đọc được: PDF, Word, PowerPoint, Excel, văn bản / mã nguồn hoặc ảnh. ZIP, video, âm thanh bị từ chối.
- Thêm lại cùng tệp / cùng link vào cùng nơi ⇒ trả dòng cũ, không trùng.
- Link: chỉ http(s), cổng 80/443, từng chặng redirect đều kiểm tra địa chỉ (chặn mạng nội bộ, SSRF), tối đa 1 MB, 8 giây; chỉ HTML / văn bản. Trang gần như không có chữ ⇒ báo lỗi.
- YouTube (`youtube-transcript.ts`): hỏi Innertube bằng client Android (trang xem video trả phụ đề rỗng nếu thiếu PO token), chọn track (ưu tiên tiếng Việt, rồi tiếng Anh; phụ đề người làm trước phụ đề tự động), `baseUrl` phải thuộc `*.youtube.com`. Video không có phụ đề ⇒ 422 kèm hướng dẫn; video riêng tư / bị chặn / YouTube không trả lời ⇒ 502. Mọi dạng link (watch, youtu.be, shorts, `&t=`) quy về một link chuẩn nên không thêm trùng. `meta` lưu videoId, ngôn ngữ và loại phụ đề, kênh, độ dài.

## N7AI đọc tài liệu

`n7ai.service.ts` (cuộc trò chuyện riêng, không phải nhóm): sau tệp gửi kèm tin và tài liệu gần nhất, thêm tài liệu của thread: tệp qua `attachmentParts` (cache theo key), chữ qua `source-context.ts` (≤ 30.000 ký tự / tài liệu, ≤ 60.000 tổng, mới nhất trước). Tệp trùng key với tệp đã gửi kèm không đọc lại.

Đọc được nội dung (`doc-text.ts`): PDF, Word, **PowerPoint** (chữ từng slide), **Excel** (từng sheet, ≤ 500 dòng), TXT, Markdown, CSV, mã nguồn.

### Bật / tắt tài liệu cho N7AI đọc

Mặc định mọi tài liệu của thread được đọc ở mọi lượt. Cột `ai_sources.in_context` (migration `ai-sources-upgrade.sql`, mặc định `TRUE`) cho phép tắt từng tài liệu mà không xóa: `context()` bỏ các dòng `in_context = FALSE`. Ở panel Tài liệu, mỗi tài liệu đã thêm có nút con mắt (cập nhật ngay, lỗi thì hoàn lại); tài liệu đang tắt mờ đi và ghi "Đã tắt · N7AI không đọc". Tệp gửi kèm trong tin nhắn không có công tắc này (đã được gửi chủ động ở lượt đó).

## Đoạn trích bôi đen: hỏi N7AI về đúng đoạn

Bôi đen chữ trong trình xem tài liệu (PDF, Word, PowerPoint, Excel, văn bản, trang web) hoặc bản chép lời video ⇒ nút nổi **Hỏi N7AI** ngay cạnh vùng chọn. Bấm nút ⇒ đoạn thành chip trong ô soạn (`TextQuote`, rê chuột xem nội dung, ✕ để bỏ) và con trỏ nhảy vào ô soạn. **Chỉ bôi đen thì không tự gắn**: tránh đẩy chữ vào ngữ cảnh khi người dùng chỉ định sao chép hay đánh dấu.

- **Giới hạn**: tối đa 3 đoạn mỗi tin (`CHAT_MAX_QUOTES`), mỗi đoạn tối đa 2.000 ký tự (`CHAT_QUOTE_MAX_CHARS`, dài hơn thì cắt và báo). Đoạn trùng không thêm lần hai.
- **Vị trí**: vùng xem đánh dấu `data-quote-at` (PDF: `trang N`, bản chép lời: mốc `mm:ss` của dòng bắt đầu); mốc giờ trong bản chép lời không bị chọn lẫn vào chữ. Bấm dòng phụ đề để tua vẫn hoạt động, nhưng đang bôi đen thì không tua.
- **Gửi**: `POST /chat/conversations/:id/messages` nhận `quotes: [{title, text, locator?, sourceId?}]`; chỉ lưu khi hội thoại là thread N7AI riêng (chat 1-1 / nhóm bỏ qua). Server chuẩn hóa chữ và chỉ giữ `sourceId` nếu tài liệu thuộc chính người gửi. Lưu ở `messages.meta.quotes`; bong bóng câu hỏi hiện thẻ trích dẫn (tài liệu còn tồn tại ⇒ bấm để mở lại).
- **Prompt** (`n7ai.quotes.ts`): lượt hiện tại có khối `<selected_passages>` đứng trước câu hỏi, mỗi đoạn kèm `source` và `at`, dặn ưu tiên trả lời về các đoạn này và dẫn lại tên tài liệu + vị trí. Đoạn nằm ngoài ngân sách ký tự của tài liệu (30.000 / tài liệu) nên **luôn vào ngữ cảnh**, kể cả khi tài liệu / video dài hơn giới hạn. Lượt cũ trong lịch sử chỉ ghi `[đã chọn đoạn: "…" (tài liệu, vị trí)]` (cắt 300 ký tự) để câu hỏi nối tiếp còn hiểu; đoạn chỉ gắn cho đúng lượt đã chọn.
- **Mã**: `components/chat/quotes/` (`quote-store.ts` cầu nối panel ↔ ô soạn, `read-selection.ts`, `quote-selection.tsx` bọc trình xem bằng `display: contents`), `chat/composer/context-chips.tsx`, `chat/thread/message-quotes.tsx`; API `chat/quotes/chat-quotes.service.ts`.
- **Hiện nút khi nào**: chỉ khi có ô soạn thread N7AI đang mở (thư viện hay chat thường không hiện). Màn cảm ứng đặt nút bên dưới vùng chọn để không đè menu của hệ điều hành. Đổi / rời thread ⇒ bỏ các đoạn đang chờ.
- **Chưa làm**: bấm thẻ trích dẫn mở tài liệu nhưng chưa nhảy đúng chỗ (tua video tới mốc, cuộn tới trang).

## Video YouTube: xem cùng phụ đề, học tiếp tập trung (Focus Mode)

Bấm tài liệu YouTube ở panel ⇒ trình phát nhúng (`youtube-nocookie`) + phụ đề bên dưới (`source-view.tsx`):

- **Tối ưu tập trung học tập & loại bỏ xao nhãng**:
  - `iv_load_policy=3`: vô hiệu hóa hoàn toàn pop-up thẻ annotations, nút đăng ký, thẻ đề xuất do tác giả chèn đè lên bài giảng.
  - `cc_load_policy=0`: tắt phụ đề mặc định đè lên hình ảnh/slide trong video (tránh trùng lặp với panel transcript tương tác bên dưới).
  - `rel=0` & `modestbranding=1`: giới hạn gợi ý chỉ trong kênh của bài giảng và tinh gọn logo.
  - **Chặn đứng lưới video đề xuất khi hết bài (End-screen Mask)**: Bắt sự kiện kết thúc video (`playerState === 0` qua IFrame postMessage) để phủ **Màn hình hoàn thành bài học** (Learning Completion Overlay) thay thế hoàn toàn lưới 12 video đề xuất của YouTube:
    - Chúc mừng đã hoàn thành bài giảng.
    - Nút "Xem lại từ đầu" (`seekTo(0)` và phát lại).
    - Các nút ôn tập nhanh với AI: "Tóm tắt bài học", "Luyện Quiz", "Tạo Flashcard".
- **Thanh điều khiển học tập (Study Controls)**:
  - Tua lùi / tiến 5 giây (`-5s`, `+5s`): giúp học sinh nghe lại nhanh câu giảng khó hiểu của giảng viên.
  - Tốc độ phát bài giảng nhanh: hỗ trợ `0.75x`, `1x`, `1.25x`, `1.5x`, `2x` qua `setPlaybackRate` postMessage API.
- Bấm một dòng phụ đề (mốc `[mm:ss]`) ⇒ video tua tới đó và phát. Trình phát gửi thời điểm hiện tại qua `postMessage` nên dòng đang phát được tô sáng và tự cuộn theo (tắt được bằng "Cuộn theo video").
- Thanh "Học từ video": Tóm tắt, Quiz, Flashcard gửi yêu cầu vào cuộc trò chuyện (dùng chung `study-tools.ts` với tab Công cụ). Chat bình thường cũng hỏi được về video vì N7AI đọc phụ đề ở mọi lượt.
- N7AI được báo nguồn là phụ đề có mốc thời gian và được dặn dẫn mốc `[mm:ss]` khi trả lời dựa vào video.
- Thẻ xem trước link YouTube trong tin nhắn chat (`MessageEmbedCard`): nhận diện video YouTube, gắn biểu tượng YouTube chuyên biệt và nút Play nổi bật.
- Giới hạn: phụ đề lưu tối đa 100.000 ký tự, N7AI đọc tối đa 30.000 ký tự / tài liệu (video rất dài chỉ đọc phần đầu). Video không có phụ đề: dán transcript vào bằng "Dán văn bản". Tệp video tự tải lên (phiên âm giọng nói) chưa hỗ trợ.

## Giao diện

- Panel phải, tab **Tài liệu**: danh sách = tài liệu đã thêm + tệp đã gửi trong tin nhắn; nút **Thêm tài liệu** (tải tệp · từ thư viện · từ kho tài liệu · dán văn bản · link web / YouTube); tài liệu đã thêm có nút bỏ. Bấm tệp ⇒ trình xem tệp; bấm tài liệu chữ ⇒ trình xem chữ (YouTube có mốc thời gian, mở trang gốc).
- Tab **Công cụ**: chọn nguồn là cả cuộc trò chuyện hoặc một tài liệu bất kỳ.
- Thư viện (`/n7ai/library`): nút **Thêm tài liệu** (không có "từ thư viện", có "từ kho tài liệu"), mục "Đã thêm vào thư viện".

## Nối với kho tài liệu và bộ sưu tập

- **Hỏi N7AI** (nút trên trang tài liệu `/documents/[id]` và bộ sưu tập `/collections/[id]`): tạo cuộc trò chuyện mới, thêm tài liệu hoặc cả bộ rồi mở `/n7ai/<id>`. Chưa đăng nhập ⇒ ẩn nút.
- **Từ kho tài liệu** (menu Thêm tài liệu): tab Bộ sưu tập (của mình + công khai, nút "Thêm cả bộ") và tab Tài liệu đã lưu (chọn nhiều).
- **Gợi ý mở đầu từ bộ sưu tập**: bộ của mình mới cập nhật gần nhất và có tài liệu ⇒ gợi ý đầu tiên ("Quiz 5 câu ôn tập từ bộ «…»"). `AiSuggestion.collection` có giá trị ⇒ bấm gợi ý thì thêm bộ vào thread hiện tại trước khi điền / gửi câu hỏi.
- **Kho của tôi và Thư viện N7AI giữ tách** (quyết định 2026-10-28): Kho = tài liệu học tập có môn, chia sẻ được; thư viện N7AI = đồ làm việc tạm (ảnh, ghi chú, link, video). Chỉ nối một chiều: Kho → N7AI (các mục trên, "Từ Kho của tôi" đứng đầu menu và là tab mặc định) và N7AI → Kho bằng nút **Lưu vào Kho** (`POST /ai/sources/:id/to-library`): chỉ tệp; tạo tài liệu riêng tư, **chép** tệp sang `documents/<user>/…` (xóa cuộc trò chuyện dọn `chat/…` không làm mất bản trong Kho; không chép được ⇒ dùng lại URL cũ), ghi `meta.documentId` để lưu lại không trùng. Tệp vốn từ kho chỉ lưu tham chiếu. Văn bản / link / video ở lại N7AI. Trang thư viện có lối tắt **Kho của tôi**.
- Quyền: tài liệu `status = published` và (`public` hoặc của mình); bộ `public` hoặc của mình. Tệp không phải R2 của hệ thống bị từ chối.

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

Test: `n7ai-sources.e2e-spec.ts`, `n7ai-quotes.e2e-spec.ts`, `doc-text.e2e-spec.ts`.
