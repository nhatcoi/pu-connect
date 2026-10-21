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

## Panel phải: Tài liệu · Công cụ

Không gian N7AI có panel phải thu gọn được (`components/n7ai/side-panel/`). Desktop (≥ 1024px): nút mũi tên giữa mép phải để mở; mở ra thì thanh bên giữ cố định (16–18rem), chat và panel chia đều phần còn lại; nút thu gọn ở đầu panel. Không gian N7AI dùng hết chiều ngang màn hình (thanh bên sát trái, panel sát phải); header hội thoại là `@container` nên cột hẹp chỉ hiện icon. Bấm thẻ tệp ở bất kỳ đâu trong N7AI ⇒ panel mở ở tab Tài liệu.

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

| Loại | Cách hiển thị |
|---|---|
| PDF | Trình xem PDF của trình duyệt (iframe) |
| Word, Excel, PowerPoint, ODF, RTF | Office Online (`view.officeapps.live.com`). URL tệp (R2 công khai) được gửi cho Microsoft; giới hạn của Microsoft: Word/PowerPoint ≤ 10 MB, Excel ≤ 5 MB |
| Ảnh, video, âm thanh | Thẻ gốc của trình duyệt |
| Văn bản, Markdown, CSV, mã nguồn | iframe `sandbox` (không chạy script) |
| Khác | Gợi ý tải về |

Thư viện N7AI mở tab **Tài liệu** đầu tiên.
