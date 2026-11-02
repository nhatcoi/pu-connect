# Tài khoản và quyền riêng tư

## Mục đích

Đăng ký, đăng nhập, bảo vệ tài khoản và kiểm soát hiển thị, giao diện. Trang Cài đặt `/settings` gồm các phần: Tài khoản, Giao diện, Bảng tin, Tính năng, Quyền riêng tư, Bảo mật, Người đã chặn, và N7AI.

## Đăng ký và đăng nhập

| Phương thức | Chi tiết |
|---|---|
| Email và mật khẩu | Đăng ký bằng email, họ tên, mật khẩu tối thiểu 8 ký tự; `username` tự sinh nếu bỏ trống. Đăng nhập bằng email hoặc username. Mật khẩu băm bcrypt |
| Google | Đăng nhập OAuth 2.0 chuyển hướng. Liên kết với tài khoản cùng email chỉ khi Google xác nhận email. Nút Google tự ẩn khi chưa cấu hình |
| Xác minh email | Gửi thư xác minh, gửi lại, trang `/verify-email` |
| Quên và đặt lại mật khẩu | `/forgot-password`, `/reset-password`; liên kết có hạn 30 phút, dùng một lần |
| Hoàn tất hồ sơ | Bước làm quen sau đăng ký: chọn trường, lĩnh vực quan tâm (`POST /auth/onboarding`) |

Phiên đăng nhập dùng cookie `pu_session` (HttpOnly, SameSite Lax, 7 ngày), lưu tập trung trong bảng `user_sessions`.

## Quản lý phiên và bảo mật

- Danh sách thiết bị đang đăng nhập; đăng xuất từng phiên hoặc tất cả phiên khác.
- Nhật ký sự kiện bảo mật của chính mình (đăng nhập, đổi mật khẩu).
- Đăng xuất xóa phiên phía máy chủ, xóa cookie, đặt lại trạng thái trình duyệt và điều hướng về trang chủ sạch.
- Admin có thể gửi liên kết đặt lại hoặc bắt đổi mật khẩu; đăng nhập mật khẩu bị chặn tới khi đổi, đăng nhập Google không bị chặn.

## Quyền riêng tư

| Cài đặt | Tác dụng |
|---|---|
| Quyền riêng tư hồ sơ | Kiểm soát thông tin hiển thị với người khác (`PATCH /users/privacy`) |
| Chặn người dùng | Hai bên không thấy tương tác, không nhắn tin, không thông báo cho nhau |
| Báo cáo người dùng | Gửi vào hàng chờ kiểm duyệt của admin |
| Dữ liệu N7AI | Bộ nhớ, thời gian lưu lịch sử, xuất và xóa toàn bộ (xem [Bộ nhớ, ghi chú và tác vụ](../n7ai/notes-memory-tasks)) |

## Giao diện và tính năng

| Cài đặt | Mô tả |
|---|---|
| Giao diện | Sáng, tối, theo hệ thống |
| Chế độ bảng tin mặc định | Danh sách hoặc Tập trung |
| Tính năng | Bật tắt các cờ hiển thị (`PATCH /users/preferences`, gộp nguyên tử vào JSONB `users.preferences`) |
| Thông báo | Bật tắt theo loại và Web Push (xem [Thông báo](notifications)) |

## Dữ liệu

| Bảng, cột | Nội dung |
|---|---|
| `users` | Tài khoản, vai trò, `password_hash`, `google_id`, `preferences`, `notification_settings`, cờ khóa |
| `user_sessions` | Phiên đăng nhập |
| `user_blocks` | Quan hệ chặn |
| `user_reports` | Báo cáo người dùng |
| `user_security_events` | Sự kiện bảo mật |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/auth/providers` | Phương thức đăng nhập đang bật |
| POST | `/auth/check-email`, `/auth/register`, `/auth/login`, `/auth/logout` | Đăng ký, đăng nhập |
| GET | `/auth/google`, `/auth/google/callback` | Google |
| POST | `/auth/verify-email`, `/auth/resend-verification` | Xác minh email |
| POST | `/auth/forgot-password`, `/auth/reset-password` | Đặt lại mật khẩu |
| GET | `/auth/me` | Người dùng hiện tại |
| POST | `/auth/onboarding` | Hoàn tất hồ sơ |
| GET, DELETE, POST | `/auth/sessions`, `/auth/sessions/:id`, `/auth/sessions/revoke-others` | Phiên |
| GET | `/auth/security-events` | Nhật ký bảo mật |
| GET, PUT, DELETE | `/blocks`, `/blocks/:userId` | Chặn |
