# 🪐 Đặc Tả: Không Gian PU AI Riêng (`/puai`)

> Trạng thái: **Đã triển khai (2026-10-17)**; thêm thread chat nhanh trong Tin nhắn + FAB cùng ngày. Nối tiếp [`09`](./09-chat-mention-ai-threads-skills.md) (nhiều thread) và [`10`](./10-puai-settings.md) (cài đặt).
> PU AI tách khỏi **Tin nhắn**: có không gian riêng gồm chat mới, lịch sử, thư viện và cài đặt, giống ChatGPT / Claude.

## 1. Quyết định

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Vị trí | Route `/puai` trong route group `(app)`; `AppLayout` thấy `/puai*` ⇒ ẩn Sidebar chính + cột phải, `PuaiShell` dựng thanh bên riêng | Header, socket, dialog toàn cục không mount lại khi chuyển qua lại |
| Dữ liệu | **Giữ nguyên** `conversations (type='ai')` / `messages` / `ai/threads`; không migration | Tách giao diện, không tách dữ liệu |
| Tin nhắn | `GET conversations` giữ **1 thread PU AI chat nhanh** = thread gần nhất (`LATEST_AI_ONLY`, rank 2 ⇒ luôn đứng đầu), mở tại `/messages/[id]` như Meta AI trong Threads; `unread-count` loại `c.type = 'ai'` | Hỏi nhanh không rời hộp thư; AI không chiếm badge (dòng AI vẫn có chấm chưa đọc) |
| Lối vào `/puai` | Đầu thread chat nhanh: nút ⤢ mở `/puai/[id]`; nút nổi (FAB, chỉ mobile) logo PU AI ở góc phải dưới trang Tin nhắn ⇒ `/puai`; cột phải thread chat nhanh = `ConversationInfo` bản PU AI (avatar, @puai, Mở trong PU AI · Cài đặt PU AI, tìm tin, Ảnh · Tệp · Đã ghim) như DM; chưa có thread ⇒ dòng "PU AI" gọi `POST conversations/ai` | Chat nhanh ở hộp thư, làm việc sâu ở không gian riêng |
| Chat mới | `/puai` = thread rỗng (`POST ai/threads` dùng lại thread rỗng ⇒ gọi lặp vô hại); gửi tin đầu ⇒ `router.replace('/puai/[id]')` | Không sinh thread rác, URL ổn định |
| Link cũ | `/messages/[id]` của thread AI mở chế độ chat nhanh (không chuyển hướng); Web Push thread AI trỏ `/puai/[id]`; `/settings/puai*` ⇒ redirect 308 `/puai/settings*` | Không gãy thông báo / bookmark cũ |
| Hồ sơ PU AI | Đáy thanh bên: avatar + lượt còn lại ⇒ menu Kỹ năng · Trình kết nối · Bộ nhớ · Tác vụ · Tất cả cài đặt | Cài đặt nằm trong không gian AI, không phải rời đi |
| Thư viện | `GET ai/library?kind=image\|file\|study` keyset theo `messages.id`; học liệu = tin `kind='ai'` có khối ```` ```quiz ```` / ```` ```flashcards ```` | Gom ảnh, tài liệu, quiz/flashcard từ mọi thread; ôn tại chỗ |
| Mobile | Thanh bên thành ngăn kéo trái (`components/ui/sheet.tsx`, Radix Dialog); nút ☰ ở đầu thread / trang con | Không chiếm chỗ màn nhỏ |
| Google connector | Callback OAuth về `/puai/settings/connectors?connector=&result=` (trước: `/messages?…`) | Kết quả hiện đúng nơi quản lý kết nối |

## 2. Route (web)

| Route | Nội dung |
|---|---|
| `/puai` | Chat mới (màn chào + gợi ý), `useAiDraftThread` |
| `/puai/[id]` | 1 thread; `?m=<messageId>` cuộn tới tin |
| `/puai/library` | Tab Ảnh · Tài liệu · Học liệu (cuộn vô hạn, quiz/flashcard mở ra ôn ngay) |
| `/puai/settings` · `/puai/settings/[item]` | Các panel ở [`10`](./10-puai-settings.md) |

Component: `components/puai/{puai-shell,puai-sidebar,puai-nav,puai-profile-menu,puai-page-header}.tsx`, `components/puai/library/library-items.tsx`; màn hội thoại dùng chung `components/chat/conversation-view.tsx` (DM / nhóm / AI). Đường dẫn tập trung ở `lib/puai-routes.ts`.

## 3. API

| Method | Endpoint | Ghi chú |
|---|---|---|
| GET | `/ai/library?kind=&cursor=&limit=` | `{ data: AiLibraryItem[], nextCursor }`; chỉ thread của mình; tab Ảnh/Tài liệu chỉ trả tệp đúng loại |

Truy vấn: `conversations (type='ai', created_by)` (idx_conversations_ai_threads) ⋈ `messages` (idx_messages_conv), lọc `attachments @> '[{"kind":…}]'` hoặc `content ~ '```(quiz|flashcards)'`, `ORDER BY m.id DESC`.

## 4. Realtime (web)

- `applyNewMessage`: thread AI chat nhanh cập nhật xem trước tại chỗ (rank 2 giữ vị trí); tin ở thread AI khác ⇒ tải lại danh sách 1 lần (thread chat nhanh đổi). Badge bỏ thread AI (`countsInBadge`).
- Tin có tệp trong thread AI ⇒ làm mới Thư viện; câu trả lời xong có quiz/flashcard ⇒ làm mới tab Học liệu.

## 5. Kiểm thử

`apps/api/test/puai-space.e2e-spec.ts`: Tin nhắn chỉ 1 thread AI chat nhanh (gần nhất, = `POST conversations/ai`), badge không đếm; thư viện theo loại, chỉ của mình, keyset, tham số sai ⇒ 400. Cập nhật `chat-mention-ai` / `google-connectors` (callback mới).
