# 🪐 Đặc Tả: Không Gian N7AI Riêng (`/n7ai`)

> Trạng thái: **Đã triển khai (2026-10-17)**; thêm thread chat nhanh trong Tin nhắn + FAB cùng ngày. Nối tiếp [`09`](./09-chat-mention-ai-threads-skills.md) (nhiều thread) và [`10`](./10-n7ai-settings.md) (cài đặt).
> N7AI tách khỏi **Tin nhắn**: có không gian riêng gồm chat mới, lịch sử, thư viện và cài đặt, giống ChatGPT / Claude.

## 1. Quyết định

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Vị trí | Route `/n7ai` trong route group `(app)`; `AppLayout` thấy `/n7ai*` ⇒ ẩn Sidebar chính + cột phải, `N7AiShell` dựng thanh bên riêng | Header, socket, dialog toàn cục không mount lại khi chuyển qua lại |
| Dữ liệu | **Giữ nguyên** `conversations (type='ai')` / `messages` / `ai/threads`; không migration | Tách giao diện, không tách dữ liệu |
| Tin nhắn | `GET conversations` giữ **1 thread N7AI chat nhanh** = thread gần nhất (`LATEST_AI_ONLY`, rank 2 ⇒ luôn đứng đầu), mở tại `/messages/[id]` như Meta AI trong Threads; `unread-count` loại `c.type = 'ai'` | Hỏi nhanh không rời hộp thư; AI không chiếm badge (dòng AI vẫn có chấm chưa đọc) |
| Lối vào `/n7ai` | Đầu thread chat nhanh: nút ⤢ mở `/n7ai/[id]`; nút nổi (FAB, mobile & desktop) logo N7AI ở góc phải dưới trang Tin nhắn ⇒ `/n7ai`; cột phải thread chat nhanh = `ConversationInfo` bản N7AI (avatar, @n7ai, Mở trong N7AI · Cài đặt N7AI, tìm tin, Ảnh · Tệp · Đã ghim) như DM; chưa có thread ⇒ dòng "N7AI" gọi `POST conversations/ai` | Chat nhanh ở hộp thư, làm việc sâu ở không gian riêng |
| Chat mới | `/n7ai` = thread rỗng (`POST ai/threads` dùng lại thread rỗng ⇒ gọi lặp vô hại); gửi tin đầu ⇒ `router.replace('/n7ai/[id]')` | Không sinh thread rác, URL ổn định |
| Link cũ | `/messages/[id]` của thread AI mở chế độ chat nhanh (không chuyển hướng); Web Push thread AI trỏ `/n7ai/[id]`; `/settings/n7ai*` ⇒ redirect 308 `/n7ai/settings*` | Không gãy thông báo / bookmark cũ |
| Hồ sơ N7AI | Đáy thanh bên: avatar + lượt còn lại ⇒ menu Kỹ năng · Trình kết nối · Bộ nhớ · Tác vụ · Tất cả cài đặt | Cài đặt nằm trong không gian AI, không phải rời đi |
| Thư viện | `GET ai/library?kind=image\|file\|study` keyset theo `messages.id`; học liệu = tin `kind='ai'` có khối ```` ```quiz ```` / ```` ```flashcards ```` | Gom ảnh, tài liệu, quiz/flashcard từ mọi thread; ôn tại chỗ |
| Mobile | Thanh bên thành ngăn kéo trái (`components/ui/sheet.tsx`, Radix Dialog); nút ☰ ở đầu thread / trang con | Không chiếm chỗ màn nhỏ |
| Google connector | Callback OAuth về `/n7ai/settings/connectors?connector=&result=` (trước: `/messages?…`) | Kết quả hiện đúng nơi quản lý kết nối |

## 2. Route (web)

| Route | Nội dung |
|---|---|
| `/n7ai` | Chat mới (màn chào + gợi ý), `useAiDraftThread` |
| `/n7ai/[id]` | 1 thread; `?m=<messageId>` cuộn tới tin |
| `/n7ai/library` | Tab Ảnh · Tài liệu · Học liệu (cuộn vô hạn, quiz/flashcard mở ra ôn ngay) |
| `/n7ai/settings` · `/n7ai/settings/[item]` | Các panel ở [`10`](./10-n7ai-settings.md) |

Component: `components/n7ai/{n7ai-shell,n7ai-sidebar,n7ai-nav,n7ai-profile-menu,n7ai-page-header}.tsx`, `components/n7ai/library/library-items.tsx`; màn hội thoại dùng chung `components/chat/conversation-view.tsx` (DM / nhóm / AI). Đường dẫn tập trung ở `lib/n7ai-routes.ts`.

## 3. API

| Method | Endpoint | Ghi chú |
|---|---|---|
| GET | `/ai/library?kind=&cursor=&limit=` | `{ data: AiLibraryItem[], nextCursor }`; chỉ thread của mình; tab Ảnh/Tài liệu chỉ trả tệp đúng loại |

Truy vấn: `conversations (type='ai', created_by)` (idx_conversations_ai_threads) ⋈ `messages` (idx_messages_conv), lọc `attachments @> '[{"kind":…}]'` hoặc `content ~ '```(quiz|flashcards)'`, `ORDER BY m.id DESC`.

## 4. Realtime (web)

- `applyNewMessage`: thread AI chat nhanh cập nhật xem trước tại chỗ (rank 2 giữ vị trí); tin ở thread AI khác ⇒ tải lại danh sách 1 lần (thread chat nhanh đổi). Badge bỏ thread AI (`countsInBadge`).
- Tin có tệp trong thread AI ⇒ làm mới Thư viện; câu trả lời xong có quiz/flashcard ⇒ làm mới tab Học liệu.

## 5. Kiểm thử

`apps/api/test/n7ai-space.e2e-spec.ts`: Tin nhắn chỉ 1 thread AI chat nhanh (gần nhất, = `POST conversations/ai`), badge không đếm; thư viện theo loại, chỉ của mình, keyset, tham số sai ⇒ 400. Cập nhật `chat-mention-ai` / `google-connectors` (callback mới).
