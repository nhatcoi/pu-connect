# Người dùng và bảo mật

## Mục đích

Xem toàn bộ thông tin một tài khoản, xử lý vi phạm theo thang bậc, kiểm soát phiên đăng nhập và truy vết khi có sự cố.

## Danh sách người dùng

| Tính năng | Mô tả |
|---|---|
| Lọc | Theo vai trò, trạng thái, trường, lĩnh vực, mức rủi ro, từ khóa |
| Sắp xếp | Gồm cột Rủi ro |
| Thao tác hàng loạt | Khóa, hạn chế, đổi vai trò, tích xanh, đăng xuất thiết bị |
| Xuất CSV | `GET /admin/users/export` |
| Tóm tắt | `GET /admin/users/summary` |

## Hồ sơ người dùng (bấm một người, nút phóng to để xem toàn trang)

| Tab | Nội dung |
|---|---|
| Hoạt động | Bài viết, bình luận, cảm xúc, đã lưu, theo dõi, cộng đồng, nhóm học, tài liệu, hội thoại, báo cáo, lượt xem và tìm kiếm |
| Lượt xem hồ sơ | Ai đã xem hồ sơ này, người này đã xem ai (cần `users:insight`, có ghi nhật ký) |
| Phiên và bảo mật | Thiết bị đang đăng nhập, ép đăng xuất từng phiên hoặc tất cả, IP, tài khoản chung IP, nhật ký đăng nhập |
| Xử phạt | Lịch sử, bậc đề xuất, hủy chế tài nhầm |
| Kiểm duyệt | Thao tác admin đã làm trên người này |
| Ghi chú | Ghi chú nội bộ, người dùng không thấy |

## Thang xử phạt

Đếm vi phạm trong 180 ngày, bỏ bản đã hủy. Bậc đề xuất tăng dần:

| Bậc | Hình thức | Hiệu lực |
|---|---|---|
| 1 | Cảnh cáo | Thông báo |
| 2 | Hạn chế 1 ngày | Chỉ xem |
| 3 | Hạn chế 7 ngày | Chỉ xem |
| 4 | Khóa 7 ngày | Không đăng nhập |
| 5 | Khóa 30 ngày | Không đăng nhập |
| 6 | Khóa vĩnh viễn | Không đăng nhập |

- Hạn chế: không đăng, sửa bài, bình luận, nhắn tin, tạo hội thoại, tải tài liệu, tạo nhóm học. Vẫn thả cảm xúc, theo dõi, báo cáo, hỏi N7AI. Web hiện biểu ngữ vàng.
- Khóa: đăng xuất mọi thiết bị, không đăng nhập. Hết hạn thì đăng nhập lại được ngay; tác vụ mỗi phút dọn trạng thái.
- Không khóa hoặc hạn chế được tài khoản admin và chính mình.
- Nút Khóa nhanh ở đầu hồ sơ mở hộp Xử phạt chọn sẵn Khóa và thời hạn.

## Đặt lại mật khẩu

Admin không đặt và không xem mật khẩu.

| Thao tác | Mã | Hiệu lực |
|---|---|---|
| Gửi liên kết đặt lại | `send_reset` | Gửi thư tới email của chính người dùng, liên kết 30 phút dùng một lần; mật khẩu cũ vẫn dùng được tới khi họ đổi |
| Bắt đổi mật khẩu | `force_reset` | Đặt cờ `must_reset_password`, đăng xuất mọi thiết bị, gửi liên kết; đăng nhập mật khẩu bị chặn tới khi đổi, đăng nhập Google không bị chặn |

Bỏ qua tài khoản admin, tài khoản chỉ dùng Google và chính mình. Ghi vào nhật ký quản trị (`user.reset_link`, `user.force_reset`) và nhật ký bảo mật người dùng (hiện "bởi quản trị viên").

## Nhật ký

| Nhật ký | Nội dung | Quyền |
|---|---|---|
| Thao tác quản trị | Admin đã làm gì, không sửa được | `audit:read` |
| Đăng nhập | Thành công, sai mật khẩu, bị chặn của mọi tài khoản; lọc theo IP, `@username` | `audit:read` |
| Sự kiện bảo mật | Từng người dùng và toàn hệ thống | `audit:read` |

## API tiêu biểu

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/admin/users`, `/admin/users/:id`, `/admin/users/:id/activity`, `/security`, `/sessions`, `/insight` | Danh sách và hồ sơ |
| POST | `/admin/users/bulk` | Hàng loạt |
| POST, DELETE | `/admin/users/:id/sanctions`, `.../sanctions/:sanctionId` | Xử phạt, hủy |
| POST | `/admin/users/:id/suspend`, `/unsuspend`, `/revoke-sessions` | Khóa, mở khóa, thu hồi phiên |
| DELETE | `/admin/users/:id/sessions/:sessionId` | Đăng xuất một phiên |
| PATCH | `/admin/users/:id/role`, `/verify` | Đổi vai trò, tích xanh |
| POST, DELETE | `/admin/users/:id/notes`, `.../notes/:noteId` | Ghi chú |
| GET | `/admin/audit-logs`, `/admin/security-events` | Nhật ký |
