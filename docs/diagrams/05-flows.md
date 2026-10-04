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

## 5.3. Đăng bài / bình luận có @mention → thông báo realtime

```mermaid
sequenceDiagram
  autonumber
  actor A as Tác giả
  participant API as PostsService / CommentsService
  participant MS as MentionsService
  participant DB as Postgres
  participant NS as NotificationsService
  participant RT as RealtimeGateway
  actor B as Người được nhắc (đang mở web)

  Note over B,RT: Web đã kết nối /api/socket.io bằng cookie,<br/>server cho vào room user:{B}
  A->>API: POST /api/posts (hoặc /posts/:id/comments)
  rect rgb(240, 245, 255)
    Note over API,DB: Một transaction
    API->>DB: INSERT posts / comments
    API->>MS: record(client, source, content)
    MS->>DB: INSERT mentions … ON CONFLICT DO NOTHING RETURNING (chỉ người mới)
  end
  API-->>A: 201
  API->>MS: notify(mentioned) — sau commit, bỏ qua bot
  MS->>NS: createNotification(user_mention)
  NS->>DB: INSERT notifications
  NS->>RT: emitToUser(B, "notification")
  RT-->>B: event notification
  B->>B: Chuông tải lại GET /api/notifications
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

**Changelog:**
- 2026-10-04 — tạo mới: auth email-first, Google OAuth, mention → realtime, feed ranking.
