# N7AI: thư mục lịch sử và panel tài liệu · công cụ

Implemented: 2026-10-21.

## Thư mục

Gom cuộc trò chuyện N7AI theo môn, dự án. Đây là nền để sau này N7AI dùng chung ngữ cảnh trong một thư mục (tài liệu, chỉ dẫn riêng).

- Dữ liệu: bảng `ai_folders` (`user_id`, `name` ≤ 60 ký tự, tối đa 50 thư mục/người) và cột `conversations.ai_folder_id` (`ON DELETE SET NULL`). Migration `ai-folders-upgrade.sql`.
- Xóa thư mục không xóa cuộc trò chuyện: chúng về lại Lịch sử.

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/ai/folders` | `AiFolder[]` (`threadCount` = số thread đã có tin) |
| POST | `/ai/folders` | `{ name }` |
| PATCH | `/ai/folders/:id` | `{ name }` |
| DELETE | `/ai/folders/:id` | Thread về Lịch sử |
| PATCH | `/ai/threads/:id/folder` | `{ folderId: uuid \| null }`; thư mục phải của mình, sai ⇒ 404 |
| GET | `/ai/threads?folder=all\|root\|<id>` | `root` = chưa vào thư mục; mặc định `all` (tìm kiếm) |

`AiThread.folderId` đi kèm sự kiện `ai.thread.updated` ⇒ tab khác tự chuyển thread sang đúng danh sách.

UI (`components/chat/ai/ai-thread-list.tsx`): mục **Thư mục** nằm trên **Lịch sử** ở thanh bên N7AI.

- Nút tạo thư mục, bấm thư mục để mở / đóng (chỉ tải thread khi mở).
- Kéo cuộc trò chuyện thả vào thư mục; thả vào Lịch sử ⇒ bỏ khỏi thư mục.
- Menu "Chuyển vào thư mục" dùng cho mobile (cảm ứng không kéo thả HTML5).
- Gõ tìm kiếm ⇒ kết quả phẳng từ mọi thư mục.

Test: `apps/api/test/n7ai-folders.e2e-spec.ts`.

## Bố cục: thanh bên · nội dung · panel phải

Không gian N7AI dùng hết chiều ngang, gồm 3 vùng (`components/n7ai/n7ai-shell.tsx`, `components/n7ai/layout/`):

| Vùng | Thu gọn | Kéo giãn | Mặc định |
|---|---|---|---|
| Thanh bên trái | Nút ở đầu thanh bên hoặc Ctrl/⌘ B ⇒ dải icon 56px | 220–380px (md+) | 272px |
| Nội dung | — | Co giãn, nội dung tối đa 820px căn giữa, không hẹp hơn 420px khi kéo panel | — |
| Panel phải | Nút thu gọn ở đầu panel; đóng ⇒ nút mũi tên giữa mép phải để mở | ≥ 340px (lg+) | Chia đôi phần bên phải thanh bên |

Tay kéo nằm trên đường viền: kéo chuột / cảm ứng, phím ← → (16px), nhấp đúp ⇒ mặc định. Khi kéo, iframe tài liệu tạm không nhận chuột để kéo không bị giật. Trạng thái và độ rộng lưu theo thiết bị (`localStorage` `pu:n7ai-layout`, nạp sau khi mount; bị chặn ⇒ dùng mặc định). Header hội thoại là `@container` nên cột hẹp chỉ hiện icon. Bấm thẻ tệp ở bất kỳ đâu trong N7AI ⇒ panel mở ở tab Tài liệu.

### Panel phải: Tài liệu · Công cụ

- **Tài liệu**: tệp đã gửi trong cuộc trò chuyện đang mở (ở trang khác: mọi tệp đã gửi cho N7AI), bấm để xem trước; X ⇒ về danh sách. Dữ liệu: `GET /ai/library?kind=file&threadId=`.
- **Công cụ**: chọn nguồn (cả cuộc trò chuyện hoặc 1 tài liệu) rồi bấm công cụ. Mỗi công cụ gửi một yêu cầu ngắn vào cuộc trò chuyện theo chế độ học tương ứng; chọn tài liệu thì tệp được gửi kèm để N7AI đọc lại.

| Công cụ | Chế độ | Kết quả |
|---|---|---|
| Tóm tắt | `summarize` | Ý chính, thuật ngữ, câu ôn |
| Quiz | `quiz` | 5 câu trắc nghiệm có chấm điểm |
| Flashcard | `flashcards` | Thẻ lật |
| Đề thi thử | `quiz` | 10 trắc nghiệm + 2 tự luận ngắn có đáp án gợi ý |
| Sơ đồ tư duy | `ask` | Khối Mermaid `mindmap` |
| Lộ trình ôn | `plan` | Kế hoạch theo ngày; đưa vào Google Lịch / Tasks nếu đã kết nối |

Mục **Đã tạo** liệt kê quiz / flashcard trong cuộc trò chuyện (`GET /ai/library?kind=study&threadId=`), mở ra ôn ngay trong panel.

Khác NotebookLM: học liệu nằm ngay trong cuộc trò chuyện (hỏi tiếp, sửa được), gắn với dữ liệu PU (thư viện, nhóm học) và connector Google để đưa lộ trình vào lịch.

Màn nhỏ và trang ngoài N7AI (Tin nhắn): bấm thẻ tệp ⇒ panel nổi trượt từ phải (`components/viewer/file-preview-panel.tsx`), mobile toàn màn hình.

### Trình xem tài liệu

`components/viewer/`: `file-kind.ts` chọn loại theo đuôi tệp, `preview-body.tsx` nạp trình xem tương ứng (mỗi loại một chunk, chỉ tải khi mở), `views/` chứa từng trình xem. Giao diện chung: nền "bàn học", trang giấy, thanh công cụ nổi ở đáy.

| Loại | Cách hiển thị |
|---|---|
| PDF | pdf.js: cuộn liên tục, vừa chiều rộng, phóng to 50–300%, chọn / sao chép chữ, chuyển trang. Chỉ vẽ trang gần màn hình, trang đã cuộn xa được giải phóng |
| Word `.docx` | docx-preview, trang giấy tự co vừa khung, phóng to |
| PowerPoint `.pptx` | pptx-preview (slide xếp dọc); lỗi ⇒ Office Online |
| Excel `.xlsx` | read-excel-file: bảng kiểu bảng tính (cột A, B…, số dòng), mỗi sheet một tab, tối đa 500 dòng × 40 cột |
| CSV / TSV | Bảng như trên; tự nhận dấu `,` hoặc `;` |
| Markdown | Render đầy đủ (bảng, công thức, mã) |
| Văn bản, mã nguồn | Tô màu cú pháp (highlight.js), nền tối; tệp > 200 KB hiển thị thô; chỉ đọc 1 MB đầu |
| Ảnh | Phóng to, xoay 90° |
| Video, âm thanh | Thẻ gốc của trình duyệt |
| Word / PowerPoint / Excel cũ (`.doc .ppt .xls .odt .rtf`…) | Office Online (`view.officeapps.live.com`): URL tệp (R2 công khai) được gửi cho Microsoft; Word/PPT ≤ 10 MB, Excel ≤ 5 MB |
| Khác | Gợi ý tải về |

R2 công khai không bật CORS nên trình duyệt không tự tải byte tệp được. Tệp của app đọc qua `GET /upload/read?key=` (đăng nhập; chỉ thư mục `chat/` và `documents/`; luôn trả `application/octet-stream` + `nosniff`). Byte được cache theo URL trong phiên (`useFileBytes`). Ảnh, video, âm thanh vẫn tải trực tiếp từ R2.

Tệp mã nguồn / dữ liệu (`.py .java .c .cpp .js .ts .json .yml .tex` …) tải lên được nhờ nhận theo đuôi; lưu trên R2 với MIME `text/plain` (không bao giờ được host như HTML/JS).

### Kéo thả tệp

Xem [`24-n7ai-sources.md`](./24-n7ai-sources.md): kéo thả theo vùng (ô chat · panel Tài liệu · thư viện) và tài liệu của cuộc trò chuyện.

Thư viện N7AI mở tab **Tài liệu** đầu tiên.
