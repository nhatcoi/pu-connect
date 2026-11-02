# Vai trò và phân quyền

## Vai trò hệ thống

Mỗi tài khoản có đúng một vai trò trong `users.role`.

| Vai trò | Mã | Mô tả |
|---|---|---|
| Sinh viên | `student` | Vai trò mặc định khi đăng ký |
| Giảng viên | `lecturer` | Có thể được gán làm giảng viên của môn học; nhãn nhận diện trên bài viết |
| Trợ giảng | `ta` | Hỗ trợ môn học |
| Chủ nhiệm CLB | `club_lead` | Đại diện câu lạc bộ |
| Quản trị viên | `admin` | Toàn quyền trên Admin Console |

Chỉ `admin` được đổi vai trò người khác. Vai trò khác `student` không tự cấp quyền vào Admin Console.

## Tích xanh (xác minh)

Cờ `users.is_verified` do admin cấp. Tích xanh hiển thị trên hồ sơ và bài viết, đồng thời là một trong hai điều kiện để tạo cộng đồng (xem [Cộng đồng](web/communities)).

## Quyền trên Admin Console

Admin có mọi quyền. Người không phải admin chỉ vào được Admin Console khi thuộc một nhóm quyền (`admin_groups`). Quyền hiệu lực là hợp của quyền vai trò và quyền các nhóm, được lưu đệm 30 giây.

| Quyền | Cho phép |
|---|---|
| `dashboard:view` | Xem tổng quan |
| `moderation:read` | Xem báo cáo, bài viết, bình luận |
| `moderation:write` | Ẩn hoặc ghim bài, xóa bình luận |
| `academic:read` | Xem môn học, tài liệu, cộng đồng |
| `academic:manage` | Tạo và sửa môn học, duyệt cộng đồng, xóa tài liệu, quản lý đơn vị |
| `search:read` | Phân tích tìm kiếm |
| `ai:read` | Xem telemetry, phản hồi, danh mục model |
| `ai:manage` | Xử lý ticket, kiểm duyệt skill, quản lý model và provider |
| `users:read` | Xem người dùng |
| `users:suspend` | Hạn chế, khóa, đăng xuất mọi thiết bị |
| `users:role` | Đổi vai trò |
| `users:verify` | Cấp tích xanh |
| `users:insight` | Xem dữ liệu cá nhân hóa (có ghi nhật ký) |
| `system:broadcast` | Gửi thông báo hệ thống |
| `audit:read` | Xem nhật ký kiểm toán |

## Vai trò trong cộng đồng

| Vai trò | Quyền |
|---|---|
| `owner` | Mọi quyền điều hành viên, đặt và gỡ điều hành viên, xóa thành viên bất kỳ trừ chính mình. Mỗi cộng đồng đúng một chủ |
| `moderator` | Sửa giới thiệu, nội quy, ảnh; xem thành viên; xóa thành viên thường; ẩn và khôi phục bài |
| `member` | Đăng bài, rời cộng đồng |

## Trạng thái tài khoản

| Trạng thái | Hiệu lực |
|---|---|
| Bình thường | Dùng đầy đủ |
| Hạn chế | Chỉ xem: không đăng hoặc sửa bài, bình luận, nhắn tin, tạo hội thoại, tải tài liệu, tạo nhóm học. Vẫn thả cảm xúc, theo dõi, báo cáo, hỏi N7AI. Web hiện biểu ngữ vàng |
| Khóa | Không đăng nhập được, bị đăng xuất mọi thiết bị. Hết hạn khóa thì đăng nhập lại ngay |

Không thể hạn chế hoặc khóa tài khoản admin, hoặc chính mình. Thang xử phạt xem [Admin: Người dùng và bảo mật](admin/users-security).

## Quyền xem nội dung

| Đối tượng | Quy tắc |
|---|---|
| Bài viết | Công khai; bài trong cộng đồng chưa duyệt hoặc đã ẩn không hiển thị rộng rãi |
| Bài đăng ẩn danh | Tác giả hiển thị là "Ẩn danh"; admin vẫn truy vết được |
| Tài liệu | Công khai khi bài chứa nó công khai; bản nháp và tệp riêng chỉ chủ sở hữu thấy |
| Cuộc trò chuyện N7AI | Chỉ chủ sở hữu, trừ khi chủ chia sẻ liên kết công khai |
| Người bị chặn | Hai chiều không tương tác được (xem [Tài khoản và quyền riêng tư](web/account-settings)) |
