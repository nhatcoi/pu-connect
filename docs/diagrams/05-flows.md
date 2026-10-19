# 05 · Luồng Nghiệp Vụ Chính (Sequence)

> Thứ tự gọi giữa các thành phần cho các luồng quan trọng. Cập nhật lần cuối: **2026-10-16**.

## 5.1. Đăng ký / đăng nhập bằng email (email-first)

```mermaid
sequenceDiagram
  autonumber
  actor U as Người dùng
  participant W as Web (auth-form)
  participant A as API AuthController
  participant S as AuthService
  participant DB as Postgres
  participant M as Gmail SMTP

  U->>W: Nhập email
  W->>A: POST /api/auth/check-email
  A->>S: checkEmail()
  S->>DB: SELECT password_hash FROM users WHERE email
  A-->>W: { exists, hasPassword }
  alt Đã có tài khoản có mật khẩu
    U->>W: Nhập mật khẩu
    W->>A: POST /api/auth/login
    A->>S: validateUser() (bcrypt, chỉ account_type = human)
    A-->>W: Set-Cookie pu_session (lưu user_sessions)
  else Chưa có tài khoản
    U->>W: Họ tên + mật khẩu
    W->>A: POST /api/auth/register (zod)
    A->>S: register() → username tự sinh (tránh tên dành riêng)
    S->>DB: INSERT users (email_verified = FALSE)
    S->>DB: lưu SHA-256(token), hết hạn 24h
    S->>M: Gửi link /verify-email?token=…
    A-->>W: Set-Cookie pu_session
    U->>W: Bấm link trong email
    W->>A: POST /api/auth/verify-email
    A->>DB: email_verified = TRUE (+ tích xanh nếu email trường)
  else Tài khoản chỉ có Google
    W-->>U: Gợi ý "Tiếp tục với Google"
  end
```

### 5.1b. Quên mật khẩu

```mermaid
sequenceDiagram
  autonumber
  actor U as Người dùng
  participant W as Web (/forgot-password · /reset-password)
  participant A as API AuthController
  participant S as AuthService
  participant DB as Postgres
  participant M as Gmail SMTP

  U->>W: Nhập email
  W->>A: POST /api/auth/forgot-password
  Note over A: giới hạn 5/15 phút/IP, 3/giờ/email
  A->>S: requestPasswordReset()
  opt email có tài khoản (human), cách lần trước > 60s
    S->>DB: lưu SHA-256(token), hết hạn 30 phút
    S-)M: gửi link /reset-password?token=… (nền)
  end
  A-->>W: { sent: true } (luôn giống nhau)
  U->>W: Bấm link, nhập mật khẩu mới
  W->>A: POST /api/auth/reset-password
  A->>S: resetPassword()
  S->>DB: UPDATE … WHERE token_hash khớp AND chưa hết hạn (nguyên tử, dùng một lần)
  S->>DB: DELETE user_sessions của tài khoản (đăng xuất mọi nơi)
  S-)M: email cảnh báo "mật khẩu đã đổi"
  A-->>W: { success: true } → về đăng nhập
```

## 5.2. Đăng nhập Google OAuth

```mermaid
sequenceDiagram
  autonumber
  actor U as Người dùng
  participant B as Trình duyệt
  participant A as API (GoogleAuthGuard)
  participant G as Google
  participant S as AuthService
  participant DB as Postgres

  U->>B: Bấm "Tiếp tục với Google"
  B->>A: GET /api/auth/google
  A-->>B: 302 → Google (state chống CSRF)
  B->>G: Đồng ý quyền openid email profile
  G-->>B: 302 → /api/auth/google/callback?code&state
  B->>A: callback
  A->>G: Đổi code lấy profile
  A->>S: findOrCreateGoogleUser()
  alt Đã liên kết google_id
    S->>DB: SELECT theo google_id
  else Email đã có tài khoản & Google xác minh email
    S->>DB: Gắn google_id (xóa mật khẩu nếu email chưa xác thực)
  else Mới
    S->>DB: INSERT users (email_verified = TRUE)
  end
  A->>A: super.logIn(req) → session
  A-->>B: 302 / (lỗi → /?auth_error=google)
```

## 5.3. Bình luận → thông báo (reply · mention · post_comment) realtime

```mermaid
sequenceDiagram
  autonumber
  actor C as Người bình luận
  participant CS as CommentsService
  participant MS as MentionsService
  participant DB as Postgres
  participant NS as NotificationsService
  participant RT as RealtimeGateway
  actor R as Người nhận (đang mở web)

  Note over R,RT: Web đã kết nối /api/socket.io bằng cookie → room user:{R}
  C->>CS: POST /api/posts/:id/comments
  rect rgb(240, 245, 255)
    Note over CS,DB: Một transaction
    CS->>DB: SELECT post.author_id, parent.author_id
    CS->>DB: INSERT comments · comments_count + 1
    CS->>MS: record() → INSERT mentions (chỉ người mới)
  end
  CS-->>C: 201
  CS->>NS: dispatch([reply, ...mentions, post_comment]) — sau commit
  loop mỗi người nhận (bỏ trùng theo thứ tự ưu tiên)
    NS->>DB: bỏ qua nếu tự báo · bot · đã tắt loại
    alt có group_key (post_comment, post_like, user_follow)
      NS->>DB: INSERT … ON CONFLICT (recipient, group_key) WHERE unread<br/>DO UPDATE actors_count+1 (bỏ qua nếu actor đã có)
    else
      NS->>DB: INSERT notifications
    end
    NS->>RT: emitToUser(R, "notification", {notification, unreadCount})
    RT-->>R: badge + toast "Xem" → /post/:id?comment=
  end
```

## 5.4. Bảng tin "Dành cho bạn"

```mermaid
sequenceDiagram
  autonumber
  participant W as Web (usePosts)
  participant P as PostsService.findAll
  participant DB as Postgres

  W->>P: GET /api/posts?feedType=for_you&limit&offset
  P->>DB: Một query: JOIN users/courses/communities<br/>+ LEFT JOIN seen (post_view) + LATERAL rk.score
  Note right of DB: hot rank (feed-ranking.sql.ts):<br/>(10 + độ hợp + 10 đã giải + 12·ln(1+2L+5C)) / (giờ tuổi+2)^1.2<br/>độ hợp: khoa 30 · khóa 15 · follow 35 · interests 35 · skills 25 · hồ sơ 0..40<br/>× 0.7^lần đã xem × 0.5^(thứ hạng cùng tác giả − 2)
  DB-->>P: ORDER BY score DESC, created_at DESC LIMIT/OFFSET<br/>(chỉ bài created_at ≤ before = snapshotAt; tuổi tính theo snapshotAt)
  par Batch theo trang
    P->>DB: poll của các bài
  and
    P->>DB: featured comment (solution > top > relevance > latest > earliest)
  end
  P-->>W: { data, total, hasMore, nextOffset, snapshotAt }
  Note over W: trang sau gửi before = snapshotAt trang đầu ⇒ offset không lệch<br/>following: lọc theo user_follows, sort thời gian · qa: post_type = question
```

### 5.4b. Pill "bài mới" (kiểu X)

```mermaid
sequenceDiagram
  autonumber
  participant A as Tác giả
  participant P as PostsService
  participant G as RealtimeGateway
  participant W as Web (useNewPosts)
  participant DB as Postgres

  A->>P: POST /api/posts (commit)
  P->>DB: SELECT follower_id FROM user_follows
  P-)G: emitToUsers(followers, feed:new_post)
  G-)W: feed:new_post (tín hiệu, debounce 3s)
  loop mỗi 60s · khi quay lại tab · khi có tín hiệu
    W->>P: GET /api/posts/new-since?feedType&since=latestAt|snapshotAt
    P->>DB: cùng bộ lọc feed + created_at > since, bỏ bài của mình (≤ 50)
    P-->>W: { count, authors[≤3, ưu tiên người đang follow] }
  end
  W->>P: Bấm pill ⇒ GET /api/posts?after=since&limit=50
  P-->>W: bài mới + snapshotAt
  Note over W: chèn lên đầu trang 0 (bỏ trùng), latestAt = snapshotAt, cuộn lên đầu
```

## 5.5. Web Push (BullMQ)

```mermaid
sequenceDiagram
  autonumber
  participant NS as NotificationsService
  participant Q as Redis (BullMQ)
  participant W as PushProcessor
  participant DB as Postgres
  participant RT as RealtimeGateway
  participant PS as Push service (FCM/Mozilla/Apple)
  participant SW as sw.js (trình duyệt)

  NS->>Q: add("send", {notificationId}, jobId=push-{id}, delay 30s)
  Note over Q: thông báo gộp trong 30s ⇒ cùng jobId ⇒ 1 push
  Q->>W: job tới hạn
  W->>DB: đọc notification + settings người nhận
  alt đã đọc / tắt push loại này
    W-->>Q: skip
  else tab đang hiển thị
    W->>RT: isUserActive() = true
    W-->>Q: skip:active
  else giờ yên tĩnh
    W->>Q: moveToDelayed(hết khung giờ)
  else gửi
    W->>DB: SELECT push_subscriptions
    W->>PS: POST endpoint (payload mã hóa, JWT VAPID)
    alt 201
      PS-->>SW: push
      SW->>SW: showNotification(title, body, tag)
      W->>DB: push_sent_at = NOW()
    else 404 / 410
      W->>DB: DELETE subscription
    else lỗi khác
      W-->>Q: throw ⇒ retry (backoff)
    end
  end
```

## 5.6. Tìm kiếm

```mermaid
sequenceDiagram
  autonumber
  actor U as Người dùng
  participant W as Web (search bar / /search)
  participant A as SearchController
  participant S as SearchService
  participant DB as Postgres

  U->>W: Gõ "giai tich" (không dấu)
  W->>A: GET /api/search?q=…&limit=3 (typeahead) hoặc limit=30 (trang kết quả)
  A->>S: search()
  S->>S: parseQuery(): bỏ dấu, lọc từ nối, tsquery "giai:* & tich:*"
  par 5 loại song song (học phần, tài liệu, bài, người, nhóm)
    S->>DB: Pha 1: search_tsv @@ tsquery (GIN) + lọc quyền xem
  end
  opt Thiếu kết quả ở trang đầu
    S->>DB: Pha 2 (transaction): word_similarity ≥ 0.35 (trigram)
  end
  S-)DB: INSERT search_logs (chỉ trang kết quả, không user)
  A-->>W: courses · documents · posts · users · groups
```

## 5.7. Nhắn tin & N7AI

```mermaid
sequenceDiagram
  autonumber
  actor U as Người dùng
  participant W as Web (/messages/[id] · /n7ai/[id])
  participant A as MessagesController
  participant S as MessagesService
  participant DB as Postgres
  participant RT as RealtimeGateway
  participant P as N7AiService
  participant L as LLM gateway

  W->>W: hiện tin lạc quan (clientMsgId)
  W->>A: POST /api/conversations/:id/messages
  A->>S: send() (zod · 20 tin/10s · thành viên · tệp phải thuộc chat/{senderId}/)
  S->>DB: TX: INSERT messages ON CONFLICT(sender, clientMsgId) · UPDATE conversations.last_* · read cursor
  S->>DB: (cùng TX) refs kiểm quyền · skill use_count · nhóm: message_mentions (thành viên, @all = trưởng nhóm) ⇒ meta · thread AI: title nếu NULL
  A-->>W: 201 ChatMessage (thay tin lạc quan)
  S->>RT: message.new → user:{memberId} mỗi thành viên · ai.thread.updated (tiêu đề tự đặt)
  S-)S: ChatPushService.onNewMessage(mentionedIds) — người bị nhắc vượt tắt tiếng
  alt type = 'ai' hoặc (type = 'group' và có @n7ai / chế độ / skill / Research)
    S-)P: reply(triggerId) chạy nền
    P->>DB: quota ai_runs hôm nay (Research = 2 lượt) · INSERT tin @n7ai (status=streaming)
    P->>RT: message.new (placeholder)
    P->>DB: refs ghim (môn/tài liệu+chunks/bài/thread) ∥ connector: Thư viện PU · Tài liệu của tôi · Nhóm học (nhóm chat: chỉ Thư viện)
    P->>L: chat.completions stream (system + chế độ + Research + skill + tóm tắt cuộn, lịch sử sau mốc reset/tóm tắt, <context>, ảnh base64)
    loop text delta
      L-->>P: delta
      P->>RT: message.delta
    end
    P->>DB: UPDATE tin (content, blocks=citations, status=done) · ai_runs tokens
    P->>RT: message.updated
    opt thread AI > 24 tin sau mốc
      P-)L: AiMemoryService: tóm tắt phần cũ (giữ 12 tin) ⇒ conversations.ai_summary
    end
  end
```

## 5.8. Khóa tài khoản (admin)

```mermaid
sequenceDiagram
  autonumber
  actor Ad as Admin
  participant A as AdminController (AdminGuard)
  participant DB as Postgres
  participant RT as RealtimeGateway
  actor X as Người bị khóa

  Ad->>A: POST /api/admin/users/:id/suspend { reason }
  A->>DB: TX: status='suspended' · DELETE user_sessions của user · INSERT admin_audit_logs
  A->>RT: disconnectUser(id) ⇒ ngắt socket
  X->>A: request bất kỳ với cookie cũ
  Note over A: deserializeUser trả false ⇒ 401
  X->>A: POST /api/auth/login (đúng mật khẩu)
  A-->>X: 403 "Tài khoản của bạn đã bị khóa" (sai mật khẩu vẫn 401)
```

## N7AI Google MCP (hội thoại riêng)

```mermaid
sequenceDiagram
  actor U as Người hỏi
  participant A as N7AiService
  participant R as AiRetrieval
  participant L as McpAgentService / Model
  participant C as GoogleMcpService
  participant G as workspace-mcp (localhost) → Google APIs
  U->>A: Câu hỏi + connector được bật
  A->>R: Truy xuất nguồn PU (không Google prefetch)
  A->>L: Context + connector riêng của người hỏi
  L->>C: Mở session OAuth theo user
  C->>G: initialize + tools/list
  G-->>C: Schema công cụ
  C-->>L: Chỉ các công cụ đọc trong allowlist
  loop Model cần thêm dữ liệu, trong budget
    L->>C: Công cụ + tham số do model chọn
    L-->>U: message.progress (bước running: "Tìm thư trong Gmail · từ khóa")
    C->>G: tools/call với bearer của người hỏi
    G-->>C: Kết quả
    C-->>L: Tool result (dữ liệu không tin cậy)
  end
  L-->>A: Stream câu trả lời + tổng usage
  A-->>U: message.delta / message.updated
  L->>C: Đóng session trong finally
  Note over A,C: Chat nhóm: không mở Google MCP riêng, chỉ nguồn PU công khai
```

**Changelog:**
- 2026-10-19 — Feed "Dành cho bạn" đổi sang hot rank (log tương tác / tuổi^1.2, giảm bài đã xem, đa dạng tác giả).
- 2026-10-18 — `message.progress` trước/sau mỗi tool call; tin hoàn tất lưu `meta.steps`.
- 2026-10-18 — MCP server = `workspace-mcp` tự host thay MCP chính thức của Google.
- 2026-10-17 — Luồng N7AI: Google MCP discovery → model tool loop → streaming; cách ly dữ liệu theo tài khoản và loại hội thoại.
- 2026-10-17 — 5.7: nguồn đánh số, N7AI ghi `[nguồn] n` ⇒ chỉ trích nguồn đã dùng; tìm thư viện khớp ≥ 2 từ khóa (bỏ hư từ); connector lỗi ⇒ `<connector_error>`.
- 2026-10-17 — 5.7: thread N7AI mở ở `/n7ai/[id]` (Web Push trỏ đúng không gian AI).
- 2026-10-16 — 5.7: mention trong nhóm (`message_mentions`, push vượt tắt tiếng), ngữ cảnh `refs`, skill, Research, connector, tóm tắt cuộn, tiêu đề thread AI.
- 2026-10-14 — 5.4: cộng điểm khớp hồ sơ quan tâm (`interestBoostSql`, chuẩn hóa theo chủ đề mạnh nhất).
- 2026-10-14 — 5.7: N7AI viết câu hỏi tiếp theo sau dấu mốc `<<<FOLLOWUPS>>>` trong cùng luồng stream; server giấu khỏi delta, lưu `meta.followUps`.
- 2026-10-13 — 5.7: `@n7ai` trong nhóm, chế độ học, ảnh đính kèm, kiểm tra tệp.
- 2026-10-16 — 5.4 thêm snapshot `before` + featured comment; thêm 5.4b Pill "bài mới".
- 2026-10-13 — thêm 5.7 Nhắn tin & N7AI, 5.8 Khóa tài khoản.
- 2026-10-04 — thêm 5.6 Tìm kiếm.
- 2026-10-04 — thêm 5.1b Quên mật khẩu.
- 2026-10-04 — thêm 5.5 Web Push qua BullMQ.
- 2026-10-04 — 5.3 cập nhật theo Notification v1 (dispatch, ưu tiên, gộp).
- 2026-10-04 — tạo mới: auth email-first, Google OAuth, mention → realtime, feed ranking.
