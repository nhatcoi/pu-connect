# 29. API key & MCP server

Người dùng tạo **API key** có phạm vi (scope) trong **Cài đặt → Kết nối AI (MCP)**, rồi gắn vào Claude Code / Claude Desktop / Cursor… để AI thao tác PU Connect thay mình: tìm kiếm, đọc bài, đăng bài, bình luận, quản lý tài liệu, ghi chú N7AI.

## Kiến trúc

```
Client MCP ──POST /api/mcp (Bearer puk_…)──▶ McpController (stateless, JSON)
                                               │ mỗi tool = 1 lời gọi REST nội bộ (loopback 127.0.0.1:PORT)
                                               ▼ cùng Bearer key
              apiKeyMiddleware ─ xác thực key ─ kiểm scope ─ gán req.user = chủ key ─▶ controller thường
```

- Tool **không tự đụng DB**: gọi lại REST bằng chính key ⇒ giữ nguyên guard (`NotRestrictedGuard`, `PostLimitGuard`), kiểm duyệt, chặn user, quyền xem như trên web.
- Key cũng dùng được thẳng cho REST (`Authorization: Bearer puk_…`), cùng bộ scope.
- Mã: `modules/api-keys/` (bảng, service, middleware, scope), `modules/mcp/` (controller, service, `mcp.tools.ts` danh sách tool). Thêm tool = thêm 1 dòng `def(...)` trong `mcp.tools.ts`.

## Key

- Dạng `puk_` + 43 ký tự; DB chỉ lưu SHA-256 + 12 ký tự đầu; hiện đúng **một lần** lúc tạo.
- Tối đa 10 key/người; hết hạn tùy chọn (1–365 ngày); thu hồi tức thì; chủ key bị khóa ⇒ key vô hiệu.
- Header sai/hết hạn ⇒ 401 (không rơi về cookie phiên).

## Scope

| Scope | Cho phép |
| --- | --- |
| `read` | Mọi `GET` (trừ vùng cấm): tìm kiếm, bảng tin, bài, học phần, tài liệu, cộng đồng, thông báo |
| `write` | `POST/PUT/PATCH/DELETE` trên `posts`, `comments`, `communities`, `courses`, `notifications` |
| `documents` | Ghi trên `documents` (tải lên, sửa, chấm sao, xóa) |
| `ai` | `ai/*` (ghi chú N7AI…), hỏi cộng đồng, tóm tắt bài/tài liệu — tính hạn mức AI |

Luôn cấm với key: `auth`, `api-keys`, `admin`, `push`, `storage`, `graphql`, `users/profile|privacy|preferences|verify-university`.

## Tool MCP

`tools/list` chỉ trả tool trong scope của key.

- **read:** `search`, `get_feed`, `get_post`, `list_comments`, `list_courses`, `get_course`, `list_followed_courses`, `browse_documents`, `get_document`, `list_communities`, `get_community`, `list_community_posts`, `get_user`, `list_notifications`, `unread_notification_count`
- **write:** `create_post`, `update_post`, `delete_post`, `toggle_like_post`, `toggle_bookmark_post`, `create_comment`, `update_comment`, `delete_comment`, `toggle_like_comment`, `follow_course`, `unfollow_course`, `toggle_join_community`, `mark_all_notifications_read`
- **documents:** `upload_document` (text hoặc base64, ≤ 10MB, tùy chọn phân loại), `update_document`, `rate_document`, `delete_document`
- **ai:** `summarize_post`, `summarize_document`, `ask_community`, `list_notes`, `get_note`, `create_note`, `update_note`, `append_note`, `delete_note`

Tool xóa gắn `destructiveHint` để client xin xác nhận. Kết quả > 24.000 ký tự bị cắt (dùng `limit`/`offset`).

## API

| Method | Endpoint | Quyền | Mô tả |
| --- | --- | --- | --- |
| `GET` | `/api-keys` | phiên đăng nhập | Key đang dùng (tiền tố, scope, lần dùng cuối) |
| `POST` | `/api-keys` `{ name, scopes[], expiresInDays? }` | phiên | Tạo key ⇒ trả `key` đầy đủ **một lần** |
| `DELETE` | `/api-keys/:id` | phiên | Thu hồi |
| `POST` | `/mcp` | Bearer key | MCP Streamable HTTP (stateless, JSON-RPC) |

Quản lý key chỉ qua phiên đăng nhập; key không gọi được `/api-keys`.

## Cấu hình client

```bash
claude mcp add --transport http puc https://puc.vnhat.dev/api/mcp --header "Authorization: Bearer puk_…"
```

```json
{ "mcpServers": { "puc": { "type": "http", "url": "https://puc.vnhat.dev/api/mcp", "headers": { "Authorization": "Bearer puk_…" } } } }
```

## Bảo mật

- Key = quyền của người dùng trong phạm vi scope: coi như mật khẩu, không dán vào chat/commit.
- Prompt injection: nội dung bài viết/tài liệu AI đọc là dữ liệu không tin cậy; chỉ cấp `write`/`documents` khi cần, ưu tiên key `read` cho việc chỉ đọc.
- Mọi thao tác chịu giới hạn tốc độ, kiểm duyệt từ cấm và hạn mức AI như người dùng thường.

Test: `apps/api/test/api-keys-mcp.e2e-spec.ts`. Migration: `api-keys-upgrade.sql`.
