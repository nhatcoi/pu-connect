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
MAIL_FROM="PU Connector <no-reply@puc.vnhat.dev>"
```
Không đặt `SMTP_HOST`: API chỉ ghi link xác thực vào log (`[MailService] [DEV] Link xác thực…`), không gửi mail thật.
