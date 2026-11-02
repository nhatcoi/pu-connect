# Công cụ học tập

## Mục đích

Mục Công cụ (`/tools`) giúp ôn tập chủ động bằng hai loại bộ học: Flashcard (ôn lặp lại ngắt quãng) và Quiz (trắc nghiệm có lưu điểm cao nhất). Mỗi bộ tạo được theo ba cách: tự soạn, dán danh sách, hoặc để N7AI soạn nháp.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Tổng quan | Số bộ, số mục, số thẻ đến hạn, 6 bộ gần đây |
| Soạn bộ | Thêm, sửa, xóa mục; sửa giữ lịch ôn của mục không đổi |
| Dán danh sách | Nhập nhanh nhiều mục |
| N7AI soạn nháp | Từ chủ đề hoặc nội dung dán vào; chưa lưu cho tới khi người dùng xác nhận (tốn 1 lượt) |
| Học flashcard | Chấm từng thẻ: Quên, Khó, Nhớ, Dễ |
| Làm quiz | Ghi điểm, thời gian, điểm cao nhất, lịch sử các lần làm (tối đa 20 gần nhất) |
| Thống kê | Chuỗi ngày học (hiện tại và kỷ lục), lượt hôm nay, lịch nhiệt 16 tuần, dự báo thẻ đến hạn 7 ngày tới |
| Mẫu từ vựng | Mẫu `vocab` kèm ngôn ngữ, phiên âm, ví dụ |
| Từ N7AI trong chat | N7AI tạo bộ ngay trong hội thoại; bộ tự lưu và hiện thẻ tương tác (xem [Chế độ học](../n7ai/learning-modes)) |

## Lịch ôn lặp lại (SM-2 rút gọn)

| Lần | Quên | Khó | Nhớ | Dễ |
|---|---|---|---|---|
| Lần đầu | Gặp lại sau 10 phút | 12 giờ | 1 ngày | 4 ngày |
| Lần hai | Gặp lại sau 10 phút | 1,5 ngày | 3 ngày | 7 ngày |
| Các lần sau | 10 phút, giảm hệ số dễ 0,2, đếm lại từ đầu | khoảng cách x 1,2 | khoảng cách x hệ số dễ | khoảng cách x hệ số dễ x 1,3 |

Hệ số dễ tối thiểu 1,3; khoảng cách tối đa 365 ngày. Ngày học tính theo giờ Việt Nam.

## Giới hạn

| Mục | Giá trị |
|---|---|
| Mục mỗi bộ | 200 |
| Bộ mỗi người | 300 |
| Thẻ N7AI tạo trong một lần | Tối đa 60 |

## Quy tắc nghiệp vụ

- Chỉ chủ bộ xem và sửa; không đổi được loại bộ sau khi tạo.
- Nội dung mục được kiểm theo loại bộ; mục hỏng bị bỏ và báo lại, phần hợp lệ vẫn lưu.
- Một tin trả lời của N7AI chỉ tạo một bộ (không lưu trùng).
- Nhật ký học giữ lại khi xóa bộ hoặc thẻ để thống kê không mất.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `study_sets` | Bộ: loại, tên, tùy chọn, nguồn (`manual` hoặc `n7ai`), số mục, điểm cao nhất |
| `study_items` | Mục và lịch ôn (`due_at`, `interval_days`, `ease`, `reps`, `lapses`) |
| `study_events` | Nhật ký chấm thẻ và lần làm quiz |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/tools/overview`, `/tools/stats` | Tổng quan, thống kê |
| GET, POST | `/tools/sets` | Danh sách, tạo |
| POST | `/tools/sets/draft` | N7AI soạn nháp |
| GET, PATCH, DELETE | `/tools/sets/:id` | Chi tiết, sửa, xóa |
| POST | `/tools/sets/:id/review` | Chấm một thẻ |
| GET, POST | `/tools/sets/:id/attempts` | Lịch sử, ghi lần làm quiz |
