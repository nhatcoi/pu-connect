# 05 · Luồng Nghiệp Vụ Chính (Sequence)

> Thứ tự gọi giữa các thành phần cho các luồng quan trọng. Cập nhật lần cuối: **2026-10-04**.

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
  A-->>B: 302 /home (lỗi → /?auth_error=google)
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
  P->>DB: Một query: JOIN users/courses/communities<br/>+ recommendation_score
  Note right of DB: +30 cùng khoa · +15 cùng khóa · +35 đang theo dõi<br/>+35 tag ∩ interests · +25 tag ∩ skills · +10 đã giải<br/>+ likes×2 + comments×5 − 2/ngày tuổi
  DB-->>P: ORDER BY score DESC, created_at DESC LIMIT/OFFSET
  P->>DB: Batch lấy poll cho các bài
  P-->>W: { data, total, hasMore, nextOffset }
  Note over W: following: lọc theo user_follows, sort thời gian<br/>qa: post_type = question
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

**Changelog:**
- 2026-10-04 — thêm 5.1b Quên mật khẩu.
- 2026-10-04 — thêm 5.5 Web Push qua BullMQ.
- 2026-10-04 — 5.3 cập nhật theo Notification v1 (dispatch, ưu tiên, gộp).
- 2026-10-04 — tạo mới: auth email-first, Google OAuth, mention → realtime, feed ranking.
