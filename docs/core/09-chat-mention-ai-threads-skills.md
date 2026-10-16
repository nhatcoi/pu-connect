# 💬 Đặc Tả: Mention Chat · PU AI Nhiều Hội Thoại · Slash Skills · Menu `+`

> Trạng thái: **Đã triển khai (2026-10-16)**. Bổ sung cho [`06-messaging-and-ai.md`](./06-messaging-and-ai.md).
> Mục tiêu: soạn tin kiểu Slack / Claude — `@` nhắc người & gắn ngữ cảnh, `/` gọi chế độ học & skill tự tạo, `+` đính kèm tệp / skill / connector / Research; PU AI có nhiều cuộc trò chuyện, lịch sử tải theo trang.

---

## 1. Quyết định thiết kế

| Vấn đề | Quyết định | Lý do |
|---|---|---|
| Lưu mention | `content` giữ chữ thường đọc được (`@username`), thực thể có cấu trúc nằm ở `messages.meta` (`mentions`, `refs`, `skill`) | Push, tìm kiếm, lịch sử gửi LLM, xem trước tin cuối dùng thẳng `content`, không cần bước render token; client tô sáng `@username` có trong `meta.mentions` |
| Bảng mention chat | Bảng riêng `message_mentions (message_id BIGINT FK, user_id, conversation_id)` thay vì `mentions.source_id TEXT` | FK + cascade theo tin, index `(user_id, conversation_id, message_id DESC)` ⇒ đếm "nhắc bạn chưa đọc" bằng index-only scan |
| `@all` | Chỉ trưởng nhóm; ghi 1 dòng / thành viên (nhóm ≤ 50) | Chống spam; đếm chưa đọc dùng chung 1 đường |
| Tắt tiếng | Bị nhắc ⇒ vẫn push (giống Slack/Messenger) | Mention là tín hiệu ưu tiên cao |
| Ngữ cảnh (`refs`) | Chip phía trên ô soạn (như Claude/Cursor), không chèn token vào chữ | Không làm bẩn nội dung; tối đa 5 / tin; server kiểm quyền rồi mới lưu `meta.refs` |
| Ngữ cảnh "chat khác" | Chỉ **hội thoại PU AI của chính mình** | Nạp tin nhóm của người khác lên LLM = lộ dữ liệu không có đồng ý |
| PU AI nhiều thread | Mỗi thread = 1 `conversations` `type='ai'`, `direct_key = NULL` (thread cũ giữ key) | Dùng lại toàn bộ hạ tầng tin nhắn, realtime, push, đính kèm |
| Danh sách chính | Chỉ hiện **thread AI mới nhất** (InitPlan 1 lần / truy vấn); lịch sử thread ở thanh PU AI | Không làm loãng danh sách DM/nhóm |
| "Chat mới" | `POST /ai/threads` dùng lại thread rỗng sẵn có | Bấm nhiều lần không sinh rác |
| Tiêu đề thread | Tự đặt từ câu hỏi đầu (cắt 60 ký tự, trong transaction gửi tin), sửa được | Không tốn lượt/độ trễ LLM; model suy nghĩ ăn hết `max_tokens` nhỏ |
| Trí nhớ dài | Tóm tắt cuộn `conversations.ai_summary` + `ai_summary_upto`; gửi LLM = tóm tắt + ≤ 20 tin sau mốc | Thread dài không quên phần đầu, prompt không phình |
| Skill | Bảng `ai_skills` của từng người (≤ 30), chỉ chủ skill gọi được; list trả payload nhẹ, chi tiết mới có `instructions` | Prompt riêng tư; cache list lâu ở client |
| Chế độ học | Giữ 6 `AiMode` (thanh chip + `/explain`…) — skill là lớp chỉ dẫn **cộng thêm** | Không phá quiz/flashcard đang render theo `aiMode` |
| Connector | Registry nội bộ: Thư viện PU (mặc định), Tài liệu của tôi (gồm riêng tư, đọc `document_chunks`), Nhóm học của tôi; Google Drive "Sắp có" | Drive cần OAuth scope `drive.readonly` + Google verification — ghi backlog |
| Research | Cờ theo tin: truy xuất sâu hơn (8 bài + 4 tài liệu, thân dài hơn) + prompt báo cáo; **tốn 2 lượt** (`ai_runs.task='research'`) | Chi phí token cao hơn |
| Tùy chọn composer | Connector / Research nhớ ở `localStorage` (try/catch), gửi kèm từng tin, lưu `meta` | Không cần thêm bảng / endpoint cài đặt |

## 2. Dữ liệu (migration `chat-mention-ai-upgrade.sql`)

```sql
message_mentions(message_id BIGINT → messages, user_id → users, conversation_id → conversations, PK(message_id, user_id))
idx_message_mentions_user (user_id, conversation_id, message_id DESC)
conversations + ai_summary TEXT, ai_summary_upto BIGINT
idx_conversations_ai_threads (created_by, COALESCE(last_message_at, created_at) DESC, id DESC) WHERE type = 'ai'
idx_conversations_ai_title_trgm GIN (immutable_unaccent(lower(title))) WHERE type = 'ai'
ai_skills(id, owner_id, slug, name, description, instructions, input_hint, use_count, last_used_at, created_at, updated_at, UNIQUE(owner_id, slug))
backfill: thread AI cũ chưa có title ⇒ dòng đầu câu hỏi đầu tiên
```

`messages.meta` thêm: `mentions: {id, username}[]`, `mentionAll`, `refs: ChatRef[]`, `skill: {id, slug, name}`, `research`, `connectors`.

## 3. API

| Method | Endpoint | Ghi chú |
|---|---|---|
| POST | `/conversations/:id/messages` | body thêm `refs[] (≤5)`, `skillId`, `research`, `connectors[]`. Nhóm: có `aiMode`/`skillId`/`research` ⇒ gọi PU AI như `@puai` |
| GET | `/conversations/:id/mentions?after=` | id tin nhắc mình sau mốc `after` (mốc đã đọc lúc mở — web tự đánh dấu đã đọc ngay khi mở), ≤ 50 ⇒ nút "nhảy tới @" |
| GET | `/chat/refs?q=&types=` | gợi ý ngữ cảnh: course / document / post / thread, 1 truy vấn `UNION ALL`, ≤ 4 mỗi loại; `q` rỗng ⇒ gần đây của mình |
| GET | `/ai/threads?q=&cursor=&limit=` | keyset `(sort_at, id)`, payload `{id, title, lastMessageAt}` |
| POST | `/ai/threads` | tạo / dùng lại thread rỗng |
| PATCH / DELETE | `/ai/threads/:id` | đổi tên / xóa (cascade tin) |
| GET / POST | `/ai/skills` | list nhẹ / tạo |
| GET / PATCH / DELETE | `/ai/skills/:id` | chi tiết có `instructions` / sửa / xóa |
| GET | `/ai/connectors` | registry + trạng thái khả dụng |

`ConversationSummary.unreadMentions` (badge `@`).

## 4. Luồng gửi tin (nhóm)

1. Transaction: lưu tin → `ChatMentionsService.record` (khớp `@username` với **thành viên đang ở trong nhóm**, `@all` nếu là trưởng nhóm) → `ChatRefsService.resolve` (kiểm quyền từng ref) → ghi `meta`.
2. Sau commit: broadcast `message.new`; `ChatPushService.onNewMessage(conv, sender, mentionedIds)` — người bị nhắc được xếp job dù đang tắt tiếng; worker đổi tiêu đề "X đã nhắc đến bạn".
3. PU AI: `PuaiService.reply` — system = gốc + nhóm + chế độ + Research + skill; ngữ cảnh = `refs` (ghim, ưu tiên) + connector đã bật; lịch sử = tóm tắt cuộn + tin sau mốc.
4. Thread AI vượt 24 tin sau mốc ⇒ nền: tóm tắt phần cũ (giữ 12 tin cuối), không tính quota.

## 5. Web

- `components/chat/composer/`: `use-composer-picker.ts` (phát hiện `@` / `/` tại con trỏ, gom nguồn, điều hướng phím), `picker-popover.tsx` (listbox chia nhóm), `plus-menu.tsx` (Tải tệp · Gắn ngữ cảnh · Skills › · Connectors › · Research), `context-chips.tsx`, `skills-dialog.tsx`; `components/chat/refs.ts` (biểu tượng + link ref dùng chung).
- `@` trong nhóm: thành viên lọc **tại client** từ `useMembers` (≤ 50, đã cache) + `@puai` + `@all` (trưởng nhóm); mọi loại chat: ngữ cảnh lấy server (debounce 150ms, `keepPreviousData` + lọc lại tại client, `staleTime` 60s).
- `/`: 6 chế độ + `/new`, `/reset` (thread AI) + skill của mình (`staleTime` 10 phút).
- Thanh **lịch sử PU AI** (`ai/ai-thread-list.tsx`, `hooks/chat/use-ai-threads.ts`): cột phải desktop, hộp thoại mobile; `useInfiniteQuery` + tìm kiếm debounce; tin mới vá cache (đẩy lên đầu, đặt tiêu đề) không refetch.
- Bong bóng tin: `@username` thành link (mình được nhắc ⇒ nền vàng), chip ngữ cảnh, nhãn skill / Research.
- Danh sách hội thoại: badge `@`; vào hội thoại có nhắc chưa đọc ⇒ nút nổi "@ N" (`thread/mention-jump.tsx`) nhảy lần lượt tới tin.
- Bong bóng: `thread/message-text.tsx` — `@tên` có trong `meta.mentions` thành link (mình ⇒ nền vàng), chip ngữ cảnh, nhãn `/skill` · Research.

## 6. Backlog

- Connector Google Drive / Calendar (OAuth scope riêng + màn đồng ý Google).
- Chia sẻ skill công khai (thư viện skill trường).
- Tìm thread theo nội dung tin (hiện: theo tiêu đề).
- Xóa tệp R2 khi xóa thread AI.
