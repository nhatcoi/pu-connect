# N7AI: ghi chú Markdown

Implemented: 2026-11-02 (giai đoạn 1).

Ghi chú soạn bằng Markdown ngay cạnh cuộc trò chuyện: tab **Ghi chú** trong panel phải của N7AI (cạnh Tài liệu · Công cụ).

## Dữ liệu

Bảng `ai_notes` (migration `ai-notes-upgrade.sql`, có trong `scripts/deploy.sh`, `scripts/deploy-mac-vps.sh` và `test/global-setup.ts`):

| Cột | Ghi chú |
|---|---|
| `user_id` | Chủ ghi chú; mọi truy vấn lọc theo người dùng |
| `parent_id` | Cây trang; xóa trang cha ⇒ xóa trang con (`ON DELETE CASCADE`) |
| `conversation_id` | Cuộc trò chuyện nơi tạo (tùy chọn, `SET NULL`) |
| `title` ≤ 200, `content` ≤ 200.000 ký tự | Nội dung là Markdown. `GET /` trả thêm `preview` (180 ký tự đầu, chưa bỏ cú pháp Markdown) để lưới `/n7ai/notebook` không phải gọi riêng từng ghi chú |
| `pinned`, `position` | Ghim lên đầu danh sách; thứ tự trong cùng cha |

Giới hạn 200 ghi chú / người.

## API (`/api/ai/notes`, cần đăng nhập)

| Method | Path | Ghi chú |
|---|---|---|
| GET | `/` | Danh sách (không kèm `content`), ghim trước |
| POST | `/` | Tạo (`title`, `content`, `parentId`, `conversationId`) |
| GET | `/:id` | Chi tiết |
| PATCH | `/:id` | Sửa `title`, `content`, `pinned`, `parentId` (chặn chuyển vào chính nó / trang con) |
| POST | `/:id/append` | Nối đoạn Markdown vào cuối (nút "Thêm vào ghi chú") |
| DELETE | `/:id` | Xóa (kèm trang con) |
| GET | `/:id/export?format=md\|docx` | Tải tệp; Word dựng bằng `docx` + `marked` (giữ chữ, liên kết, bảng; khối tương tác thành chữ tĩnh) |
| POST | `/:id/ask` | **Ask n7ai**: `selection` (đoạn đang chọn, ≤ 8.000 ký tự), `instruction` tùy chọn (≤ 400 ký tự), `mode` (`rewrite`\|`shorten`\|`expand`\|`none`) ⇒ `{ text }`. Một lượt gọi thẳng (không agent/tool), không tự lưu — client tự thay vào. Tốn 1 lượt N7AI (`ai-note-edit.service.ts`, trigger `note`). |

## Web

Hai nơi sửa ghi chú, dùng chung `NoteView` (xuất từ `panel-notes.tsx`) nên tự lưu / menu ⋯ / Ask n7ai giống hệt nhau — chỉ khác bề rộng và nút "Danh sách trang" đổi nghĩa:

- **Panel cạnh chat** (`components/n7ai/side-panel/panel-notes.tsx`, tab Ghi chú): sửa nhanh không rời cuộc trò chuyện; nút "Danh sách trang" mở/đóng cây trang thu gọn trong panel (`note-tree.tsx`).
- **`/n7ai/notebook`** (xưởng viết rộng, mục **Notebook** ở thanh bên N7AI): `app/(app)/n7ai/notebook/page.tsx` — lưới thẻ mọi trang (tiêu đề, đoạn xem trước từ `preview`, thời điểm sửa, ghim/xóa qua menu ⋯), nút "Trang mới", tìm theo tiêu đề. `app/(app)/n7ai/notebook/[id]/page.tsx` — mở `NoteView` chiếm hết bề rộng trang; nút "Danh sách trang" ở đây quay lại lưới thay vì mở cây. Chưa có: Import Word (xem "Chưa làm" — cố ý bỏ, đã khóa phạm vi giai đoạn này), kéo thả, tìm theo nội dung.
- `note-editor.tsx` (tiptap + `@tiptap/markdown`) + `note-ask-bubble.tsx` (Ask n7ai), `note-tree.tsx` (cây trang, thêm trang con).
- `hooks/chat/use-ai-notes.ts`: TanStack Query (`aiNotes`, `aiNote`), `useAddToNote`, `useAiNoteAsk`.
- Nút **Thêm vào ghi chú** ở thanh tác vụ câu trả lời N7AI: chèn vào ghi chú đang mở (tại chỗ, tự lưu như gõ tay), hoặc nối vào ghi chú gần nhất, chưa có thì tạo mới.
- **Ask n7ai** (`note-ask-bubble.tsx`, tham khảo Co-Writer của DeepTutor — đổi "Ask Dito" thành "Ask n7ai"): bôi đen đoạn trong `note-editor.tsx` ⇒ nút nổi "Ask n7ai" tại vị trí chọn (tính bằng `editor.view.coordsAtPos`, neo tuyệt đối trong khung cuộn của trình soạn). Bấm mở hộp lệnh: 3 nút nhanh (Viết lại / Rút gọn / Mở rộng) hoặc gõ yêu cầu tự do; đang chờ model hiện spinner; xong hiện bản xem trước (chữ thường, chưa render Markdown) với **Dùng** (thay vào đúng vùng đã chọn bằng `insertContentAt({from,to}, text, {contentType:'markdown'})`) hoặc **Bỏ qua**. Vị trí chọn (`range`) chụp một lần lúc mở hộp; không theo dõi nếu tài liệu đổi trong lúc chờ (rủi ro chấp nhận được ở quy mô một ghi chú).
- Khác Co-Writer gốc của DeepTutor: không có chế độ ReAct (RAG/tra web khi sửa), không xem trước dạng diff, không lịch sử thao tác/tool-call, không automark, không suggestion-card ôn tập, không backlink/thread bình luận, không upload asset. Những phần này chưa làm, xem dưới.

## Chưa làm (giai đoạn sau)

**Import Word** (nút có trong giao diện gốc DeepTutor nhưng cố ý bỏ giai đoạn này — xuất Word đã có, nhập chưa), "Chèn mục yêu thích", outline theo tiêu đề, kéo thả đổi thứ tự trang, tìm theo nội dung ở `/n7ai/notebook`. Từ Co-Writer DeepTutor (chưa áp dụng): sửa có RAG/tra web, xem trước dạng diff, lịch sử thao tác, automark, suggestion-card ôn tập kiểu spaced-repetition, backlink giữa trang, thread bình luận neo đoạn text, upload asset vào ghi chú.

Test: `apps/api/test/n7ai-notes.e2e-spec.ts` (gồm Ask n7ai: sửa đúng đoạn chọn, bỏ hàng rào ```markdown model lỡ bọc, không tự lưu, từ chối đoạn rỗng / ghi chú người khác).
