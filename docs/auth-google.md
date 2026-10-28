# Xác thực: Email + Mật khẩu, xác thực email & Google OAuth

## Kiến trúc
- Session cookie (`pu_session`, httpOnly, lax) qua `express-session` + Passport; user lưu trong PostgreSQL.
- **Email + mật khẩu:** `POST /api/auth/register` (email, họ tên, mật khẩu ≥ 8 ký tự; username tự sinh nếu bỏ trống), `POST /api/auth/login` (email hoặc username). Mật khẩu hash `bcrypt` (cost 12). Body register được validate bằng zod (`dto/register.dto.ts`).
- **Google OAuth 2.0 (redirect flow):** `GET /api/auth/google` → Google → `GET /api/auth/google/callback` → tạo session → redirect `/home`. Dùng `passport-google-oauth20` với `state` chống CSRF.
- Tài khoản Google: tìm theo `google_id` → nếu chưa có thì liên kết với tài khoản cùng email **chỉ khi Google xác nhận email** → nếu chưa có thì tạo mới (email `@phenikaa-uni.edu.vn` / `@st.phenikaa-uni.edu.vn` được cấp tích xanh). Không có mật khẩu (`password_hash` NULL).
- `GET /api/auth/providers` cho frontend biết Google đã bật chưa: **không cấu hình thì nút Google tự ẩn**.
- Migration: `apps/api/src/database/auth-upgrade.sql` (cột `google_id`, `auth_provider`, `password_hash` nullable) — `scripts/deploy.sh` tự chạy.

## Cấu hình Google (một lần)
1. [Google Cloud Console](https://console.cloud.google.com) → tạo project → **APIs & Services → OAuth consent screen**.
   - User type: **Internal** nếu project thuộc Google Workspace của trường (chỉ tài khoản trong tổ chức đăng nhập được), hoặc **External** (ai có Gmail cũng đăng nhập được).
   - Điền app name, support email, authorized domain (`vnhat.dev`). Scope chỉ cần `openid`, `email`, `profile` (không cần Google verify app).
   - External ở trạng thái *Testing* giới hạn 100 test user; bấm **Publish app** để mở cho mọi người.
2. **Credentials → Create credentials → OAuth client ID → Web application**:
   - Authorized JavaScript origins: `https://puc.vnhat.dev`, `http://localhost:3000`
   - Authorized redirect URIs: `https://puc.vnhat.dev/api/auth/google/callback`, `http://localhost:3000/api/auth/google/callback`
3. Điền biến môi trường (backend):
```bash
GOOGLE_CLIENT_ID=xxxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=xxxx
GOOGLE_CALLBACK_URL=https://puc.vnhat.dev/api/auth/google/callback   # local: http://localhost:3000/api/auth/google/callback
```
4. Restart API. Callback URL phải **khớp tuyệt đối** với redirect URI đã khai báo.

## Vì sao không dùng Firebase Auth / Clerk
Dự án đã có bảng `users` riêng, session cookie và NestJS/Passport. Google OAuth trực tiếp ~100 dòng, miễn phí, giữ nguyên mô hình session. Firebase/Clerk sẽ thêm lớp đồng bộ user + xác thực token + phụ thuộc vendor. Cân nhắc chuyển khi cần OTP SMS, MFA, magic link, nhiều provider hoặc app mobile native.

## Redirect URI
Production dùng `GOOGLE_CALLBACK_URL=https://puc.vnhat.dev/api/auth/google/callback` (khớp "Authorized redirect URIs" trên Google Console). Muốn chạy Google ở local: thêm `http://localhost:3000/api/auth/google/callback` vào Google Console và đặt cùng giá trị trong `.env` local.
File `puc-client-secret.json` chứa secret: đã gitignore và loại khỏi `rsync` của `deploy.sh`; không commit.

## Luồng nhập email trước (UI)
`components/auth/auth-form.tsx`: nhập email → `POST /api/auth/check-email` (giới hạn 20 lượt/phút/IP) → hiện dần ô **mật khẩu** (đã có tài khoản), **họ tên + mật khẩu** (chưa có), hoặc gợi ý dùng Google (tài khoản chỉ có Google). Nhập tên đăng nhập (không có `@`) thì vào thẳng bước mật khẩu. Nút bút chì để đổi email.

## Xác thực email
- Đăng ký email + mật khẩu: tạo tài khoản với `email_verified = FALSE`, gửi email chứa link `APP_URL/verify-email?token=…` (token ngẫu nhiên 32 byte, DB chỉ lưu SHA-256, hết hạn 24 giờ, dùng một lần).
- `POST /api/auth/verify-email {token}` → đặt `email_verified = TRUE`; email `@phenikaa-uni.edu.vn` / `@st.phenikaa-uni.edu.vn` được cấp tích xanh (`is_verified`) **sau khi xác thực**.
- `POST /api/auth/resend-verification` (cần đăng nhập, giới hạn 1 lần/60 giây). Thanh nhắc hiện trên đầu app khi `isEmailVerified === false`.
- Đăng nhập Google: email coi như đã xác thực. Nếu Google liên kết vào tài khoản email chưa xác thực, **mật khẩu cũ bị xóa** (chống đăng ký trước bằng email người khác).
- Tài khoản tạo trước khi có tính năng (kể cả seed) được đặt `email_verified = TRUE` (migration chạy một lần trong `auth-upgrade.sql`).
- Hiện chưa chặn tính năng với tài khoản chưa xác thực (chỉ nhắc).

### Cấu hình gửi mail (SMTP)
```bash
APP_URL=https://puc.vnhat.dev
SMTP_HOST=smtp.example.com
SMTP_PORT=587          # 465 = TLS
SMTP_USER=...
SMTP_PASS=...
MAIL_FROM="PU Connect <no-reply@puc.vnhat.dev>"
```
Không đặt `SMTP_HOST`: API chỉ ghi link xác thực vào log (`[MailService] [DEV] Link xác thực…`), không gửi mail thật.

## Bảo vệ chống lạm dụng
- Đăng nhập: `LoginRateLimitGuard` (trước `LocalAuthGuard`) — 10 lần / 15 phút cho mỗi IP + tài khoản, 50 lần / 15 phút cho mỗi IP ⇒ `429`.
- `check-email`: 20 lần/phút/IP · `register`: 10 lần/giờ/IP · `resend-verification`: 1 lần/60 giây.
- Bộ đếm lưu trong bộ nhớ tiến trình (reset khi restart; đủ cho 1 instance). Nhiều instance ⇒ chuyển sang Redis/Postgres.
- Mọi thao tác ghi yêu cầu session (`requireUserId`), không có fallback sang tài khoản khác.


## Connector Google Drive & Google Calendar cho N7AI (tùy chọn)
N7AI đọc được Drive / lịch của người dùng **sau khi họ tự kết nối** (menu `+` › Connectors). Luồng OAuth riêng, tách khỏi đăng nhập, mỗi connector 1 scope chỉ đọc:

| Connector | Scope | N7AI dùng thế nào |
|---|---|---|
| Google Drive | `https://www.googleapis.com/auth/drive.readonly` | `files.list` với `fullText contains` (≤ 4 từ khóa) ⇒ đọc 2 file (Research: 4): Docs/Slides xuất `text/plain`, Sheets `text/csv`, PDF/DOCX/txt ≤ 10 MB trích chữ; ≤ 2 500 ký tự/file |
| Google Calendar | `https://www.googleapis.com/auth/calendar.readonly` | sự kiện lịch chính 14 ngày tới (Research: 30 ngày), giờ Việt Nam ⇒ lập lộ trình ôn quanh lịch bận |

- `GET /api/ai/connectors/{google-drive|google-calendar}/connect` → Google (`access_type=offline`, `prompt=consent`, `state` + provider lưu session) → Google gọi về **chính redirect URI đăng nhập** `GET /api/auth/google/callback`; `ConnectorCallbackMiddleware` nhận ra `state` của phiên connector và xử lý trước passport (state không khớp ⇒ luồng đăng nhập chạy như cũ) → `/n7ai/settings/connectors?connector=…&result=connected|error`. Đặt `GOOGLE_CONNECTOR_CALLBACK_URL` nếu muốn dùng URI riêng (`/api/ai/connectors/google/callback`).
- Refresh token mã hóa **AES-256-GCM** (khóa = SHA-256 của `CONNECTOR_ENCRYPTION_KEY`, mặc định `SESSION_SECRET`) trong bảng `user_connectors`; access token chỉ giữ trong bộ nhớ. Google trả `invalid_grant` (người dùng thu hồi) ⇒ tự xóa kết nối. Ngắt kết nối gọi `oauth2.googleapis.com/revoke`. Nhóm chat không dùng connector Google.

Cấu hình thêm trên Google Cloud Console (cùng OAuth client):
**Cập nhật 2026-10-17:** Google connectors đã chuyển sang MCP (server tự host `workspace-mcp`) và thêm Gmail. Cấu hình hiện hành, OAuth client dành cho AI agent và quyền chỉ đọc: [Google MCP connectors](./core/14-google-mcp-connectors.md). Các bước REST dưới đây được giữ làm lịch sử triển khai trước MCP.

1. **APIs & Services → Library**: bật **Google Drive API** và **Google Calendar API**.
2. **OAuth consent screen → Scopes**: thêm `.../auth/drive.readonly` (*restricted*) và `.../auth/calendar.readonly` (*sensitive*). Khi app ở chế độ *Testing* chỉ test user dùng được; mở cho mọi người cần Google xác minh app.
3. **Không cần thêm redirect URI** (dùng lại URI đăng nhập đã khai báo). Đã kiểm trên stage 2026-10-16: URI đăng nhập + scope `drive.readonly` được Google chấp nhận (vào màn đăng nhập); URI riêng chưa khai báo thì Google trả `redirect_uri_mismatch`.
4. Env: `CONNECTOR_ENCRYPTION_KEY` (chuỗi ngẫu nhiên dài; đổi khóa ⇒ người dùng phải kết nối lại).

Kiểm thử: `apps/api/test/google-connectors.e2e-spec.ts` chạy toàn bộ luồng (connect → callback qua URI đăng nhập → lưu token mã hóa → N7AI đọc Drive/Calendar → hết hạn + `invalid_grant` ⇒ tự ngắt → ngắt kết nối gọi revoke; sai scope ⇒ không lưu) với Google API giả lập ở tầng `fetch`.
