# Môn học

## Mục đích

Danh mục môn học là trục tổ chức tri thức: bài viết, tài liệu, nhóm học đều có thể gắn với một môn. Mỗi môn có trang tổng quan gom tài liệu, lộ trình ôn và thảo luận.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Danh sách và tìm môn | Theo mã, tên, lĩnh vực |
| Trang môn `/courses/[code]` | Tổng quan, kho tài liệu của môn, bài viết gắn môn, giảng viên |
| Theo dõi môn | Theo dõi để nhận nội dung môn trong bảng tin (`PUT, DELETE /courses/:id/follow`) |
| Môn đang theo dõi | `GET /courses/followed` |
| Lộ trình ôn | Các bước ôn theo thứ tự, mỗi bước có tài liệu nổi bật; đề giữa kỳ và cuối kỳ gom theo năm học |
| Đề xuất môn mới | Chọn "Khác" khi gắn môn, gửi yêu cầu chờ admin duyệt |

## Quy tắc nghiệp vụ

- Môn học gắn theo lĩnh vực quan tâm (`courses.interest_field_id`).
- Người dùng không tự tạo môn: gửi đề xuất, admin duyệt (tạo môn thật) hoặc từ chối kèm lý do. Đề xuất bị từ chối không gửi lại cùng tên.
- Admin gán giảng viên cho môn, gộp môn trùng (chuyển bài và tài liệu sang môn đích), xóa môn trống, nhập hàng loạt từ Excel, CSV, JSON.
- Môn không còn gắn với khoa cũ; lọc theo khoa đã bị gỡ khi đơn giản hóa danh mục.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `courses` | Mã, tên, mô tả, lĩnh vực |
| `course_follows` | Người theo dõi môn |
| `course_lecturers` | Giảng viên của môn |
| `course_suggestions` | Đề xuất môn chờ duyệt hoặc đã từ chối |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/courses`, `/courses/:id`, `/courses/:id/overview` | Danh sách, chi tiết, tổng quan |
| GET | `/courses/followed` | Môn đang theo dõi |
| PUT, DELETE | `/courses/:id/follow` | Theo dõi, bỏ theo dõi |
| POST, GET | `/courses/suggestions`, `/courses/suggestions/mine` | Gửi và xem đề xuất của mình |
| GET | `/documents/course-path?course=` | Lộ trình ôn |
| GET, POST, PUT, DELETE | `/admin/courses...` | Quản trị, xem [Admin: Danh mục học thuật](../admin/academic-catalog) |
