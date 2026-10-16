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
| Skill | Bảng `ai_skills` của từng người (≤ 30), chỉ chủ skill gọi được; list trả payload nhẹ, chi tiết mới có `instructions`. Chia sẻ công khai ⇒ người khác **cài = sao chép** (§8) | Prompt riêng tư mặc định; bản cài độc lập, chủ sửa/xóa không ảnh hưởng người đã cài |
| Chế độ học | Giữ 6 `AiMode` (thanh chip + `/explain`…) — skill là lớp chỉ dẫn **cộng thêm** | Không phá quiz/flashcard đang render theo `aiMode` |
| Connector | Thư viện PU (mặc định), Tài liệu của tôi (gồm riêng tư, đọc `document_chunks`), Nhóm học của tôi, **Google Drive**, **Google Calendar** (OAuth riêng, scope chỉ đọc, xem §7) | Nguồn nội bộ không cần quyền thêm; Google chỉ khi người dùng tự kết nối, token mã hóa |
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
| GET | `/ai/threads?q=&cursor=&limit=` | keyset `(sort_at, id)`, payload `{id, title, lastMessageAt}`; `q` khớp tiêu đề **hoặc nội dung tin** (chỉ quét thread của mình) |
| POST | `/ai/threads` | tạo / dùng lại thread rỗng |
| PATCH / DELETE | `/ai/threads/:id` | đổi tên / xóa (cascade tin; tệp đính kèm trên R2 `chat/{userId}/` bị xóa theo, best-effort) |
| GET / POST | `/ai/skills` | list nhẹ / tạo |
| GET / PATCH / DELETE | `/ai/skills/:id` | chi tiết có `instructions` / sửa / xóa |
| GET | `/ai/connectors` | registry + `available` / `connected` / `account` của người xem |
| GET | `/ai/connectors/{google-drive\|google-calendar}/connect` · `/ai/connectors/google/callback` | OAuth redirect flow (state + provider trong session, 1 callback URI) ⇒ `/messages?connector=…&result=…` |
| DELETE | `/ai/connectors/{google-drive\|google-calendar}` | xóa token + revoke phía Google |
| GET / POST | `/ai/skills/library?q=` · `/ai/skills/:id/install` | thư viện skill công khai (cờ `installed`) · cài = sao chép |

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

- Đã làm hết phần đề xuất ban đầu. Ý tưởng tiếp: index trigram cho `messages.content` nếu số tin AI mỗi người lớn; xác minh Google để mở connector cho mọi người.

## 7. Connector Google (Drive · Calendar)

- Migration `ai-connectors-upgrade.sql`: `user_connectors(user_id, provider, refresh_token_enc, account_email, scope, …, PK(user_id, provider))`.
- `ai/connectors/`: `GoogleOAuthService` (dùng chung: authorize URL, đổi code, kiểm scope, làm mới access token có cache, revoke, `invalid_grant` ⇒ xóa), `GoogleDriveService` (tìm `fullText contains`, export Docs/Sheets/Slides, tải PDF/DOCX/txt ≤ 10 MB ⇒ `ai/doc-text.ts`), `GoogleCalendarService` (sự kiện lịch chính N ngày tới), `TokenCipher` (AES-256-GCM), `AiConnectorsService` (registry + trạng thái), `AiConnectorsController` (`:provider/connect`, `google/callback`, `DELETE :provider`).
- Thêm provider Google mới = 1 dòng `GOOGLE_PROVIDERS` + 1 service đọc dữ liệu + 1 nhánh trong `AiRetrieval`.
- Token bị thu hồi (`invalid_grant`) ⇒ tự xóa kết nối; mọi lỗi Drive ⇒ PU AI bỏ qua nguồn này (`AiRetrieval.safe`).
- Web: menu `+` › Connectors hiện "Kết nối" (điều hướng cả trang tới `/api/ai/connectors/<slug>/connect`), đã kết nối ⇒ bật/tắt như nguồn khác + email tài khoản + "Ngắt …"; `/messages?connector=&result=` báo kết quả bằng toast.
- Cấu hình Google Console: [`docs/auth-google.md`](../auth-google.md#connector-google-drive-cho-pu-ai-tùy-chọn).

## 8. Thư viện skill công khai

- Migration `ai-skills-share-upgrade.sql`: `ai_skills.is_public`, `install_count`, `source_skill_id` (FK `ON DELETE SET NULL`), index một phần `WHERE is_public` theo lượt cài, unique `(owner_id, source_skill_id)` ⇒ mỗi người cài 1 skill gốc tối đa 1 lần.
- `GET /ai/skills/library?q=`: skill công khai của người khác (tài khoản active), tìm không dấu theo tên/mô tả/lệnh, nhiều lượt cài trước, ≤ 30, kèm `installed`. Không trả `instructions`.
- `POST /ai/skills/:id/install` (transaction): kiểm giới hạn 30, lệnh trùng ⇒ hậu tố `-2`, `-3`…; bản cài mặc định riêng tư; tăng `install_count` bản gốc.
- Web: hộp thoại Skill có tab **Của bạn / Thư viện**, form có công tắc **Chia sẻ lên thư viện**.

## 9. Chất lượng mã

- ESLint flat config: `apps/web/eslint.config.mjs` (`next/core-web-vitals` + `next/typescript`), `apps/api/eslint.config.mjs` (`typescript-eslint` recommended). `pnpm lint`: API 0 cảnh báo; web 0 lỗi (cảnh báo còn lại ở code cũ: biến thừa, `any`, `<img>`).
- `.prettierrc.json` khớp style repo; file của tính năng này đã format, code cũ không format lại hàng loạt (tránh diff lớn).
