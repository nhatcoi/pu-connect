# Thông báo

## Mục đích

Báo cho người dùng khi người khác tương tác với họ hoặc khi có thông tin hệ thống, qua ba kênh: trong ứng dụng thời gian thực, Web Push, và biểu ngữ thông báo hệ thống.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Chuông và trang `/notifications` | Danh sách, số chưa đọc, đánh dấu đã đọc từng cái hoặc tất cả |
| Thời gian thực | Thông báo mới đến ngay qua Socket.io, không cần tải lại |
| Gộp thông báo | Nhiều lượt thích hoặc bình luận cùng một bài gộp thành một dòng ("A và 3 người khác đã thích bài viết") |
| Cài đặt theo loại | Bật hoặc tắt từng nhóm thông báo (`GET, PATCH /notifications/settings`) |
| Web Push | Nhận thông báo khi đã đóng tab, đăng ký thiết bị trong Cài đặt |
| Thông báo hệ thống | Admin gửi tới nhóm đối tượng, kèm biểu ngữ đầu trang (xem [Admin: Thông báo và nhóm quyền](../admin/announcements-groups)) |

## Các loại thông báo

| Nhóm | Mã | Ví dụ nội dung | Kênh |
|---|---|---|---|
| Bảng tin | `post_like` | A và 3 người khác đã thích bài viết của bạn | Trong ứng dụng |
| | `post_comment` | B đã bình luận bài viết của bạn | Trong ứng dụng, Push |
| | `comment_reply` | C đã trả lời bình luận của bạn | Trong ứng dụng, Push |
| | `user_mention` | D đã nhắc đến bạn | Trong ứng dụng, Push |
| | `user_follow` | E bắt đầu theo dõi bạn | Trong ứng dụng |
| Hỏi đáp | `accepted_solution` | Câu trả lời của bạn được chọn là lời giải | Trong ứng dụng, Push |
| Nhóm học | `group_join_request`, `group_member_accepted` | Yêu cầu tham gia, được duyệt | Trong ứng dụng, Push |
| Hệ thống | `system_announcement` | Thông báo từ nhà trường hoặc quản trị | Trong ứng dụng, Push |
| Danh mục | Duyệt, từ chối đề xuất | Kết quả đề xuất trường, lĩnh vực, môn học | Trong ứng dụng |
| Kiểm duyệt | Ẩn bài trong cộng đồng | Lý do ẩn gửi tác giả | Trong ứng dụng |

Thông báo liên quan nội dung ẩn danh không nêu người gây ra: tiêu đề dạng "Một người ẩn danh đã bình luận...", không gộp theo người, không phát cho người theo dõi.

## Luồng xử lý

1. Hành động của người dùng được ghi vào cơ sở dữ liệu.
2. Ngay sau khi giao dịch thành công, dịch vụ thông báo ghi bản ghi (không chặn phản hồi cho người thực hiện), gộp bằng upsert nguyên tử theo `groupKey`.
3. Gateway thời gian thực phát sự kiện tới phòng riêng của người nhận.
4. Nếu người nhận bật Push và có đăng ký thiết bị, hàng đợi gửi Web Push.

## Quy tắc nghiệp vụ

- Người dùng không nhận thông báo cho hành động của chính mình.
- Người bị chặn không phát sinh thông báo cho nhau.
- Khi bị nhắc tên trong chat, thông báo Push vẫn gửi dù hội thoại đã tắt tiếng.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `notifications` | Loại, người nhận, người gây ra, đối tượng, `group_key`, trạng thái đọc |
| `users.notification_settings` | Cài đặt theo loại (JSONB) của từng người, gồm nhánh `push` |
| `push_subscriptions` | Đăng ký Web Push theo thiết bị |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/notifications` | Danh sách |
| GET | `/notifications/unread-count` | Số chưa đọc |
| PATCH | `/notifications/read-all`, `/notifications/:id/read` | Đánh dấu đã đọc |
| GET, PATCH | `/notifications/settings` | Cài đặt |
| GET | `/push/config` | Khóa công khai Web Push |
| POST, DELETE | `/push/subscriptions` | Đăng ký, hủy thiết bị |
| POST | `/push/test` | Gửi thử |
| GET | `/announcements/active` | Biểu ngữ thông báo hệ thống đang hiệu lực |

Sự kiện thời gian thực: kênh Socket.io của người dùng (số chưa đọc, thông báo mới), kênh hội thoại (tin nhắn), kênh hiện diện.

## Giới hạn đã biết

Email tóm tắt chưa triển khai. Một số mã trong bảng phân loại gốc (ví dụ nhắc hạn học phí, sự kiện trường) thuộc lộ trình, chưa có luồng phát.
