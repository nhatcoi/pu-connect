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
| `title` ≤ 200, `content` ≤ 200.000 ký tự | Nội dung là Markdown |
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

## Web

- `components/n7ai/side-panel/panel-notes.tsx`: tab Ghi chú, tự lưu sau 700 ms ("Đã lưu" / "Đang lưu…"), lưu nốt khi rời ghi chú; menu ⋯ (Ghim, Chuyển tới, Xuất Markdown, Xuất Word, Xóa).
- `note-editor.tsx` (tiptap + `@tiptap/markdown`), `note-tree.tsx` (cây trang, thêm trang con).
- `hooks/chat/use-ai-notes.ts`: TanStack Query (`aiNotes`, `aiNote`), `useAddToNote`.
- Nút **Thêm vào ghi chú** ở thanh tác vụ câu trả lời N7AI: chèn vào ghi chú đang mở (tại chỗ, tự lưu như gõ tay), hoặc nối vào ghi chú gần nhất, chưa có thì tạo mới.

## Chưa làm (giai đoạn sau)

Nút "Hỏi N7AI" ngay trong ghi chú, "Chèn mục yêu thích", outline theo tiêu đề, kéo thả đổi thứ tự trang.

Test: `apps/api/test/n7ai-notes.e2e-spec.ts`.
