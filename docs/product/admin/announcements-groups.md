# Thông báo và nhóm quyền

## Thông báo hệ thống

### Mục đích

Gửi thông báo từ quản trị tới đúng nhóm người dùng, hiển thị dưới dạng thông báo trong ứng dụng và biểu ngữ đầu trang web.

### Tính năng

| Tính năng | Mô tả |
|---|---|
| Nhắm đối tượng | Theo vai trò, trường (`universityIds`), lĩnh vực quan tâm (`fieldIds`) |
| Xem trước | Số người nhận trước khi gửi (`POST /admin/announcements/preview`) |
| Hẹn giờ | Gửi ngay hoặc đặt thời điểm |
| Biểu ngữ | Hiển thị đầu trang web trong thời gian hiệu lực (`GET /announcements/active`) |
| Lịch sử, hủy | Xem đã gửi, hủy thông báo chưa hết hiệu lực |

Cần quyền `system:broadcast`. API: `GET, POST /admin/announcements`, `DELETE /admin/announcements/:id`.

## Nhóm quyền

### Mục đích

Cho người không phải admin (kiểm duyệt viên, biên tập học thuật) vào Admin Console với đúng phạm vi cần thiết, mà không cấp vai trò admin.

### Tính năng

| Tính năng | Mô tả |
|---|---|
| Tạo nhóm | Đặt tên, gộp các quyền chi tiết (xem bảng quyền ở [Vai trò và phân quyền](../roles-permissions)) |
| Thành viên | Thêm xóa thành viên; danh sách ứng viên (`GET /admin/groups/member-candidates`) |
| Hiệu lực | Quyền hiệu lực của người dùng bằng quyền vai trò cộng quyền mọi nhóm họ thuộc, lưu đệm 30 giây |
| Truy cập cổng | Thuộc một nhóm quyền thì vào được Admin Console |

API: `GET, POST /admin/groups`, `PUT, DELETE /admin/groups/:id`, `GET, POST /admin/groups/:id/members`, `DELETE .../members/:userId`. Cần quyền `users:role`.

Lưu ý: "Nhóm quyền" của admin khác "Nhóm học" của sinh viên ([Nhóm học](../web/study-groups)).
