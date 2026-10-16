# 03 · API Components (C4 Level 3 — `apps/api`)

> Module NestJS, phụ thuộc giữa chúng và endpoint. Cập nhật lần cuối: **2026-10-16**.

## Module & phụ thuộc

```mermaid
flowchart TB
  mw["<b>main.ts middleware</b><br/>trust proxy → CORS (isAllowedOrigin)<br/>→ session (PgStore) → passport<br/>+ AllExceptionsFilter · TransformInterceptor"]

  subgraph Feature["Feature modules (REST controllers + GraphQL resolvers)"]
    direction LR
    auth["<b>Auth</b><br/>Local + Google strategy<br/>MailService · rate limit"]
    users["<b>Users</b><br/>hồ sơ · privacy"]
    presence["<b>Presence</b><br/>ai thấy ai online · last_seen_at<br/>chờ 15s trước khi offline"]
    blocks["<b>Blocks</b><br/>chặn 2 chiều · blocks.sql<br/>(feed, bình luận, chat, TB lọc bằng SQL)"]
    posts["<b>Posts</b><br/>feed ranking · comments Q&A"]
    gql["<b>SocialGraphQL</b><br/>user · feed · comment<br/>document · study-group"]
    others["<b>Communities · Documents<br/>Courses · StudyGroups<br/>Campus · Search</b>"]
    storage["<b>Storage</b><br/>R2 upload"]
    admin["<b>Admin</b><br/>AdminGuard (role=admin)<br/>báo cáo · khóa TK · audit log"]
    chat["<b>Chat</b><br/>ChatCore · Conversations · Messages · ChatMentions · ChatRefs<br/>Puai (stream · vision) · AiThreads · AiLibrary · AiSkills · AiSummary<br/>AiSettings · AiMemories · AiTasks · AiFeedback · AiData · worker ai-maintenance"]
    ai["<b>Ai</b><br/>LlmService (client · quota · ai_runs)<br/>AiRetrieval · prompts"]
    perso["<b>Personalization</b><br/>user_events → user_interests<br/>gợi ý PU AI · worker BullMQ"]
  end

  subgraph Platform["Platform modules"]
    direction LR
    mentions["<b>Mentions</b><br/>@username → bảng mentions<br/>GET mentions/suggest"]
    notif["<b>Notifications</b><br/>lọc · gộp group_key · cài đặt<br/>lưu + đẩy realtime"]
    rt["<b>Realtime</b><br/>Gateway /api/socket.io<br/>room user:{id} · presence"]
    push["<b>Push</b><br/>PushService · PushProcessor (BullMQ)<br/>web-push VAPID"]
    queue["<b>Queue</b> (global)<br/>BullModule → Redis"]
  end

  db[("<b>DatabaseModule</b> (global)<br/>pg.Pool · transaction()")]
  ext["Google OAuth · Gmail SMTP · Cloudflare R2"]

  mw --> Feature
  posts -->|record mentions| mentions
  Feature -->|dispatch sau commit| notif -->|emitToUser| rt
  notif -->|enqueue| push --> queue
  push -. isUserActive .-> rt
  rt -. session + passport ở handshake .-> mw
  Feature -->|SQL| db
  Platform -->|SQL| db
  auth & storage --> ext
  admin -->|disconnectUser| rt
  chat -->|emitToUser message.*| rt
  chat -->|chat-push: sendToUser| push
  chat --> ai
  posts -->|PostAiService: @puai trong bình luận · tóm tắt bài| ai
  ai -->|chat/completions| llm["LLM gateway"]
  ai -->|AiConnectorsController · GoogleOAuth → Drive / Calendar| gdrive["Google Drive / Calendar"]
  chat -->|publicUrlFor · isOwnedKey chat/ avatars/| storage
  others -->|StudyGroupChatService: đồng bộ thành viên| chat
  blocks -->|block.changed| rt
  rt -->|onPresenceChange: tab đầu mở / tab cuối đóng| presence
  presence -->|presence.update tới liên hệ| rt
  users -->|tắt cá nhân hóa: forget| perso
  perso -->|refresh-profiles mỗi giờ · purge-events mỗi ngày| queue
  posts -. interestBoostSql: điểm khớp hồ sơ .-> perso

  classDef mod fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef plat fill:#334155,stroke:#334155,color:#fff
  classDef store fill:#ffedd5,stroke:#f97316,color:#7c2d12
  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
  class auth,users,blocks,presence,ai,posts,communities,others,storage,gql,admin,chat mod
  class mentions,notif,rt,push,queue plat
  class db store
  class ext,mw,llm external
```

> Quy tắc phụ thuộc: feature module → platform module → `DatabaseModule`. Platform module **không** import feature module (tránh vòng lặp). Token dùng chung đặt trong `*.constants.ts`.

## Endpoint

### REST (`/api`)

| Module | Endpoint |
|---|---|
| Auth | `GET auth/providers` · `POST auth/check-email` · `POST auth/register` · `POST auth/login` · `GET auth/me` · `POST auth/logout` · `GET auth/google` · `GET auth/google/callback` · `POST auth/verify-email` · `POST auth/forgot-password` · `POST auth/reset-password` · `POST auth/resend-verification` · `POST auth/onboarding` |
| Users | `GET users/suggestions` · `GET users/:username` · `PATCH users/profile` · `PATCH users/privacy` · `PATCH users/preferences` (feature plugs) · `POST users/verify-university` |
| Posts | `GET posts` (feedType `for_you`/`following`/`qa`/`courses`/`bookmarks`, `course=<mã>`, `before`/`after` = cửa sổ snapshot; mỗi bài kèm `featuredComment`) · `GET posts/new-since?since=` (pill "bài mới") · `GET/PATCH/DELETE posts/:id` · `POST posts` · `POST posts/:id/{like,bookmark,vote-poll,pin,resolve,report}` · `POST posts/:id/summary` (PU AI, có cache) |
| Comments | `GET/POST posts/:postId/comments` · `POST comments/:id/like` · `POST comments/:id/accept-solution` · `PATCH comments/:id` · `DELETE comments/:id` |
| Mentions | `GET mentions/suggest` |
| Communities | `GET communities` · `GET communities/:slug` · `POST communities/:slug/join` · `GET communities/:slug/posts` |
| Documents | `GET documents` (`type`, `search`, `course`) · `GET documents/:id` · `POST documents` · `POST documents/:id/download` |
| Courses | `GET courses` · `GET courses/:id` · `GET courses/:id/overview` (số liệu + người đóng góp) · `POST courses` |
| Study groups | `GET study-groups` · `GET study-groups/:id` · `POST study-groups` · `POST study-groups/:id/join` |
| Campus | `GET campus-events` · `POST campus-events` |
| Search | `GET search` |
| Notifications | `GET notifications` (cursor `before`, `unread`, `type`) · `GET notifications/unread-count` · `PATCH notifications/:id/read` · `PATCH notifications/read-all` · `GET/PATCH notifications/settings` |
| Storage | `POST upload/file` · `POST upload/multiple` |
| Push | `GET push/config` · `POST/DELETE push/subscriptions` · `POST push/test` |
| Admin (role `admin`) | `GET admin/stats` · `GET admin/reports?status=pending\|resolved` · `POST admin/posts/:id/{hide,unhide,dismiss-reports}` · `GET admin/users?q=&status=` · `POST admin/users/:id/{suspend,unsuspend}` · `GET admin/users/:id/insight` (→ `UserInsightService`, ghi audit) · `GET admin/audit-logs` · `GET admin/search/zero-results?days=` |
| Personalization | `POST events` (lô ≤ 50 sự kiện hành vi, 204) · `GET ai/suggestions?mode=` (`{ personalized, items[] }`) |
| Presence | `GET presence` (`{ [userId]: { online, lastSeenAt } }` của người cùng hội thoại) |
| Blocks | `GET blocks` (mình đã chặn ai) · `PUT blocks/:userId` (chặn, idempotent, hủy theo dõi 2 chiều) · `DELETE blocks/:userId` |
| Chat | `GET conversations` (`filter`, `cursor`, `limit` → `{ data, nextCursor }`) · `GET conversations/unread-count` · `POST conversations/direct` · `POST conversations/ai` · `POST conversations` (nhóm) · `POST conversations/study-groups/:groupId` · `GET/PATCH conversations/:id` · `PATCH conversations/:id/settings` (tắt TB, ghim) · `GET/POST conversations/:id/members` · `DELETE conversations/:id/members/:userId` · `POST conversations/:id/owner` · `POST conversations/:id/read` · `POST conversations/:id/leave` · `GET/POST conversations/:id/messages` (keyset `before`, `clientMsgId` idempotent, `attachments`, `replyToId`, `aiMode`) · `GET conversations/:id/messages/search` · `GET conversations/:id/pinned` · `GET conversations/:id/attachments` · `PATCH/DELETE messages/:id` · `GET/POST messages/:id/reactions` · `POST messages/:id/pin` · `GET ai/quota` · `POST ai/conversations/:id/reset` · `GET conversations/:id/mentions?after=` · `GET chat/refs?q=&types=` · `GET/POST ai/threads` (keyset `q`, `cursor`) · `PATCH/DELETE ai/threads/:id` · `GET ai/library?kind=image|file|study` (keyset `cursor`) · `GET/POST ai/skills` · `GET/PATCH/DELETE ai/skills/:id` · `GET ai/connectors` (kèm `connected`, `account`) · `GET ai/connectors/:provider/connect` (google-drive · google-calendar, 302 → Google) · `GET ai/connectors/google/callback` (state + provider trong session) · `DELETE ai/connectors/:provider` · `GET ai/skills/library?q=` · `POST ai/skills/:id/install`. Body gửi tin thêm `refs[]`, `skillId`, `research`, `connectors[]` |

### GraphQL (`/graphql`)

| Loại | Field |
|---|---|
| Query | `me` · `userProfile` · `suggestedUsers` · `userFollowers` · `userFollowing` · `feed` · `post` · `comments` · `documents` · `studyGroups` |
| Mutation | `toggleFollow` |

### WebSocket (`/api/socket.io`)

| Hướng | Event | Ghi chú |
|---|---|---|
| Server → client | `notification` | `{ notification, unreadCount }` vào room `user:{recipientId}` (NotificationsService.notify) |
| Server → client | `notification.read` | `{ ids?, all?, unreadCount }` — đồng bộ đã đọc giữa các tab |
| Client → server | `presence` | `{ visible }` — tab hiện/ẩn, quyết định có cần Web Push |
| Server → client | `message.new` · `message.updated` | `ChatMessage` tới room `user:{id}` của mọi thành viên |
| Server → client | `message.delta` | `{ conversationId, messageId, delta }` — PU AI trả lời dần |
| Server → client | `conv.read` · `conv.updated` · `conv.removed` | đã đọc `{conversationId, userId, lastReadMessageId}` (mọi thành viên) · đổi tên/thành viên · bị xóa khỏi nhóm |
| Server → client | `conv.read` · `conv.updated` | đồng bộ đã đọc / hội thoại mới giữa các tab |
| Server → client | `ai.thread.updated` | `AiThread` tới chủ thread khi tự đặt / đổi tên (vá cache lịch sử PU AI) |
| Server → client | `presence.update` | `{ userId, online, lastSeenAt }` tới người cùng hội thoại (không chặn nhau, cả hai bật `showActivityStatus`) |
| Server → client | `comments.changed` | `{ postId }` tới người gọi @puai khi PU AI đã trả lời bình luận |
| Server → client | `block.changed` | `{ userId }` tới cả 2 phía khi chặn / bỏ chặn ⇒ web làm mới hồ sơ, feed, hội thoại |
| Server → client | `feed:new_post` | `{ postId, authorId }` tới follower khi có bài mới — chỉ là tín hiệu, web gọi `GET posts/new-since` để lấy số thật |
| Client ↔ server | `typing` | `{ conversationId, isTyping }` — server kiểm tra membership rồi chuyển cho thành viên khác |

**Changelog:**
- 2026-10-17 — `AiLibraryController` `GET ai/library`; `GET conversations` & `unread-count` bỏ thread AI; push PU AI ⇒ `/puai/:id`; callback Google connector ⇒ `/puai/settings/connectors`.
- 2026-10-16 — Cài đặt PU AI: `AiSettingsController` (`ai/settings`, `ai/memories`, `ai/tasks`, `ai/messages/:id/feedback`, `ai/support`, `ai/usage`, `ai/data`), `AiAdminController` `GET admin/ai-feedback`, `PATCH ai/skills/:id/state`; queue BullMQ `ai-maintenance` (tác vụ tự động 5 phút, dọn lịch sử hằng ngày); `WebReaderService` (connector `web`, `web_search`).
- 2026-10-16 — `ConnectorCallbackMiddleware` trên `GET auth/google/callback`: connector Google dùng chung redirect URI đăng nhập (phân biệt bằng `state` trong session).
- 2026-10-16 — `GoogleOAuthService` dùng chung + `GoogleCalendarService`; thư viện skill công khai (`ai/skills/library`, `install`); `ai/threads?q=` tìm cả nội dung; xóa thread dọn tệp R2 (`StorageService.deleteObjects`).
- 2026-10-16 — AiModule: `AiConnectorsController` + `GoogleDriveService` (OAuth `drive.readonly`, token AES-256-GCM trong `user_connectors`), `AiRetrieval` thêm connector `google_drive`; `ai/doc-text.ts` dùng chung trích chữ PDF/DOCX/txt.
- 2026-10-16 — Chat: `ChatMentionsService` (mention nhóm, `GET conversations/:id/mentions`), `ChatRefsController` `GET chat/refs`, `AiThreadsController` `ai/threads`, `AiSkillsController` `ai/skills`, `GET ai/connectors`, `AiMemoryService` (tóm tắt cuộn); event `ai.thread.updated`; `AiRetrieval` theo connector.
- 2026-10-16 — Users: `GET users/suggestions` (`FollowSuggestionsService`, chấm điểm bạn chung/lớp/khoa/sở thích); cột phải web chuyển từ GraphQL `suggestedUsers` sang endpoint này.
- 2026-10-16 — Mentions: `MentionsController` `GET mentions/suggest` (`MentionSuggestService`); Comments: `PATCH comments/:id` (sửa, ghi mention mới, cột `comments.edited_at`).
- 2026-10-16 — Users: `PATCH users/preferences` (cột `users.preferences`); `GET posts` bỏ query featured comment khi người xem tắt cờ.
- 2026-10-16 — Posts: `featuredComment` trong feed (`featured-comment.sql.ts`), `GET posts/new-since`, cửa sổ `before`/`after` cho `GET posts`; Posts → Realtime: `emitToUsers` event `feed:new_post`.
- 2026-10-14 — Admin → Personalization: `GET admin/users/:id/insight` (dữ liệu cá nhân hóa 1 người, chỉ đọc, ghi `user.insight_view`).
- 2026-10-14 — PersonalizationModule: `POST events`, `GET ai/suggestions`, worker `personalization` (BullMQ job scheduler); feed For You cộng điểm khớp `user_interests`; PU AI trả kèm câu hỏi gợi ý tiếp theo (`meta.followUps`).
- 2026-10-14 — `GET conversations` phân trang keyset + lọc ở server.
- 2026-10-14 — `POST posts/:id/summary` (tóm tắt bài bằng PU AI, lưu `post_summaries`).
- 2026-10-14 — AiModule (LlmService, AiRetrieval) tách khỏi Chat; Posts → Ai: `PostAiService` trả lời @puai trong bình luận, event `comments.changed`.
- 2026-10-14 — PresenceModule: gateway đếm socket theo user (`isOnline`, `onPresenceChange`), `GET presence`, event `presence.update`.
- 2026-10-14 — BlocksModule: `GET/PUT/DELETE blocks`, event `block.changed`; GraphQL `User.blockState`; hội thoại trả `blockState`.
- 2026-10-13 — `POST conversations/:id/owner` (chuyển quyền trưởng nhóm).
- 2026-10-13 — Chat → Push: queue `chat-push` (`ChatPushService` / `ChatPushProcessor`), kênh cài đặt `chat_message`.
- 2026-10-13 — PuaiService dùng SDK `openai` (gateway OpenAI-compatible).
- 2026-10-13 — StudyGroups → Chat (`StudyGroupChatService`): `POST conversations/study-groups/:groupId`, tự thêm thành viên mới vào nhóm chat.
- 2026-10-13 — Chat: `GET messages/:id/reactions` (ai đã thả cảm xúc); `PATCH conversations/:id` nhận `avatarKey`.
- 2026-10-13 — ChatModule tách `chat-core` / `conversations` / `messages` / `puai`; thêm endpoint thành viên, cài đặt, cảm xúc, ghim, sửa, tìm kiếm, kho tệp, reset AI; Storage thêm thư mục `chat`; event `conv.removed`.
- 2026-10-13 — AdminModule, ChatModule (+ PuaiService), `courses/:id/overview`, lọc `course` cho posts/documents; StudyGroups lưu Postgres; event `message.*`, `typing`; khóa tài khoản chặn login/session/socket.
- 2026-10-04 — Search: unaccent + trigram, `search_logs` (xem [07-search](../core/07-search.md)).
- 2026-10-04 — Auth: `forgot-password`, `reset-password`.
- 2026-10-04 — PushModule + QueueModule (BullMQ), endpoint push, event `presence`.
- 2026-10-04 — Notification v1: `dispatch()` từ Posts/Comments/UserResolver/Auth, endpoint settings/unread-count, event `notification.read`; vá mạo danh (requireUserId).
- 2026-10-04 — tạo mới; thêm MentionsModule, RealtimeGateway có xác thực, NotificationsModule đẩy realtime.
