# Hồ sơ và theo dõi

## Mục đích

Hồ sơ học thuật (`/[username]`) thể hiện danh tính và năng lực của người dùng. Hệ thống theo dõi kết nối mọi người với nhau và ảnh hưởng tới bảng tin.

## Hồ sơ

### Thông tin

| Nhóm | Trường |
|---|---|
| Định danh | Họ tên hiển thị, `username`, ảnh đại diện, giới thiệu |
| Học thuật | Mã sinh viên, trường đại học, lĩnh vực quan tâm (chọn nhiều, tối đa 3) |
| Năng lực | Kỹ năng và sở thích dạng thẻ |
| Trạng thái | Vai trò, tích xanh, số người theo dõi và đang theo dõi |

Hồ sơ không còn khoa, ngành, khóa, lớp vì thông tin quá chi tiết khiến người dùng ngại điền.

### Tab trên trang hồ sơ

Các tab hoạt động (bài viết, bình luận và các loại khác) lấy từ `GET /users/:username/activity/:type`, tải theo phân trang. Tab nội dung riêng như bài đã lưu chỉ chủ hồ sơ thấy.

### Xác minh email trường

Người dùng có thể xác minh email trường (`POST /users/verify-university`). Email đã xác thực là điều kiện để tạo cộng đồng.

### Dữ liệu có đề xuất

Áp dụng cho trường đại học, lĩnh vực quan tâm và môn học.

1. Hộp chọn chung có ô tìm bỏ dấu, danh sách A đến Z nhóm theo chữ cái, dòng "Khác, đề xuất" ghim đầu.
2. Chọn "Khác" và nhập tên thì tạo yêu cầu chờ duyệt; hồ sơ tạm hiện "Khác".
3. Admin duyệt (tạo mục mới hoặc gộp vào mục có sẵn): hồ sơ của mọi người gửi cùng tên được cập nhật và họ nhận thông báo.
4. Admin từ chối kèm lý do: hồ sơ vẫn hiện "Khác" cho tới khi người dùng chọn lại. Mỗi người chỉ có một yêu cầu chưa duyệt cho mỗi loại.

## Theo dõi

| Quy tắc | Mô tả |
|---|---|
| Một chiều | Theo dõi không cần người kia đồng ý |
| Không tự theo dõi | Có ràng buộc ở cơ sở dữ liệu |
| Ảnh hưởng bảng tin | Bài của người đang theo dõi có tab riêng và cộng +35 điểm ở tab Dành cho bạn |
| Thông báo | Người được theo dõi nhận thông báo `user_follow` |
| Số đếm | `followers_count` và `following_count` tính tức thời từ bảng quan hệ |

## Nhắc tên (`@username`)

- Gõ `@` trong bài hoặc bình luận để mở gợi ý người dùng (API `GET /mentions/suggest`).
- Lưu bài hoặc bình luận xong, máy chủ trích `@username` hợp lệ và gửi thông báo `user_mention`.
- Người ẩn danh không xuất hiện trong gợi ý.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `users` | Hồ sơ, vai trò, tùy chọn, cờ xác minh |
| `user_follows` | Quan hệ theo dõi (khóa chính cặp follower, following) |
| `user_interest_fields` | Lĩnh vực quan tâm của người dùng, có thứ tự |
| `universities`, `interest_fields` | Danh mục do admin quản lý |
| `unit_requests` | Đề xuất trường, lĩnh vực chờ duyệt |
| `mentions` | Nhắc tên trong bài và bình luận |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/users/:username` | Hồ sơ công khai |
| GET | `/users/:username/activity/:type` | Hoạt động theo tab |
| GET | `/users/suggestions` | Gợi ý người nên theo dõi |
| PATCH | `/users/profile` | Sửa hồ sơ |
| PATCH | `/users/privacy` | Quyền riêng tư |
| PATCH | `/users/preferences` | Tùy chọn giao diện và tính năng |
| POST | `/users/:id/report` | Báo cáo người dùng |
| POST | `/users/verify-university` | Xác minh email trường |
| GET | `/units` | Danh mục trường và lĩnh vực |
| GET | `/mentions/suggest` | Gợi ý nhắc tên |
