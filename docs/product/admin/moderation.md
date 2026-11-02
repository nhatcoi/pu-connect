# Kiểm duyệt

## Mục đích

Một hàng chờ chung cho mọi báo cáo vi phạm, kèm công cụ xử lý nội dung và danh sách từ cấm.

## Hàng chờ báo cáo

| Tính năng | Mô tả |
|---|---|
| Báo cáo gộp | Bài viết, bình luận, người dùng trong cùng một giao diện |
| Lọc | Theo lý do, trạng thái, loại đối tượng |
| Xử lý | Ẩn, xóa, bỏ qua (từng cái hoặc hàng loạt) |
| Báo cáo người dùng | Xử lý bằng `POST /admin/user-reports/resolve`, có thể đi tiếp sang xử phạt |

## Quản lý nội dung

| Đối tượng | Thao tác | API |
|---|---|---|
| Bài viết | Danh sách, ẩn, bỏ ẩn, ghim, bỏ qua báo cáo, hàng loạt | `GET /admin/posts`, `POST /admin/posts/:id/hide`, `/unhide`, `/pin`, `/dismiss-reports`, `/admin/posts/bulk` |
| Bình luận | Danh sách, xóa, hàng loạt | `GET /admin/comments`, `DELETE /admin/comments/:id`, `POST /admin/comments/bulk` |
| Báo cáo | Xem hàng chờ | `GET /admin/reports`, `GET /admin/comment-reports` |

Bài ẩn bởi admin hệ thống chỉ admin bỏ ẩn được; điều hành viên cộng đồng không khôi phục được.

## Từ cấm

Tab Từ cấm trong mục Kiểm duyệt.

| Tính năng | Mô tả |
|---|---|
| Mức độ | Nặng (chặn đăng), vừa (gắn cờ), nhẹ |
| Thêm | Một từ hoặc dán nhiều từ cùng lúc |
| Nhập hàng loạt | `POST /admin/moderation-terms/import` |
| Sửa, xóa | `PUT, DELETE /admin/moderation-terms/:id` |

Từ do admin thêm bổ sung vào từ điển có sẵn của kiểm duyệt tự động (xem [An toàn nội dung](../web/moderation)).

## Sự kiện kiểm duyệt tự động

Danh sách các quyết định của kiểm duyệt tự động (chặn, giữ chờ duyệt, gắn cờ) kèm điểm và lý do. Admin xem lại và xác nhận hoặc bác bỏ (`GET /admin/moderation-events`, `POST /admin/moderation-events/review`) để đo độ chính xác trước khi bật chế độ `enforce`.

## Quy trình đề xuất

1. Xử lý báo cáo trong hàng chờ.
2. Nếu người dùng tái phạm, mở hồ sơ, xem lịch sử xử phạt và áp bậc đề xuất.
3. Nếu từ khóa vi phạm lặp lại, thêm vào Từ cấm.
