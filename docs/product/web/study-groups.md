# Nhóm học

## Mục đích

Giúp sinh viên lập nhóm nhỏ theo môn học để làm bài tập lớn, ôn thi hoặc học chung, có sĩ số tối đa và kênh chat riêng.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Danh sách nhóm | Nhóm đang tuyển hiển thị trước, sau đó theo thời gian tạo |
| Tạo nhóm | Tên, môn học, chủ đề, mô tả, công nghệ sử dụng, sĩ số tối đa |
| Tham gia | Nhấn tham gia khi nhóm còn chỗ |
| Chat nhóm | Mỗi nhóm có hội thoại riêng, tạo từ trang nhóm |
| Tuyển nhóm từ bài viết | Loại bài `group_recruit` kèm số chỗ |
| Tìm kiếm | Nhóm là một loại kết quả trong tìm kiếm |
| N7AI gợi ý | N7AI tìm nhóm qua công cụ tìm kiếm và đề xuất nút tham gia có xác nhận |

## Trạng thái hiển thị

| Trạng thái | Điều kiện |
|---|---|
| Đang tuyển (`recruiting`) | Còn chỗ |
| Đã đủ (`full`) | Sĩ số đạt tối đa hoặc nhóm đang hoạt động |
| Hoàn thành (`completed`) | Nhóm kết thúc |

Nhóm đã giải thể không hiển thị.

## Quy tắc nghiệp vụ

- Tham gia chạy trong một giao dịch có khóa dòng (`SELECT ... FOR UPDATE`) để hai người cùng vào chỗ cuối không vượt sĩ số.
- Khi số thành viên chạm mức tối đa, nhóm tự chuyển sang hoạt động.
- Chỉ nhóm còn ở trạng thái tuyển và còn chỗ mới nhận thành viên mới.
- Tài khoản bị hạn chế không tạo được nhóm.
- N7AI không tự tham gia thay người dùng: chỉ đề xuất, người dùng bấm xác nhận.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `study_groups` | Chủ nhóm, môn, tên, chủ đề, mô tả, công nghệ, `max_members`, `current_members`, trạng thái |
| `study_group_members` | Thành viên nhóm |
| `conversations` | Hội thoại gắn nhóm |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/study-groups` | Danh sách (lọc theo môn, từ khóa) |
| GET | `/study-groups/:id` | Chi tiết |
| POST | `/study-groups` | Tạo nhóm |
| POST | `/study-groups/:id/join` | Tham gia |
| POST | `/conversations/study-groups/:groupId` | Tạo hoặc mở chat nhóm |
| GET, POST, PUT | `/admin/groups` và con | Nhóm quyền của admin (khác khái niệm), xem [Admin](../admin/announcements-groups) |

## Giới hạn đã biết

Chưa có luồng duyệt yêu cầu tham gia riêng và đổi vai trò phó nhóm; tham gia là tức thời khi còn chỗ.
