# Bảng tin và bài viết

## Mục đích

Bảng tin (`/home`) là nơi người dùng đọc, đăng và tương tác với bài viết. Module gồm bảng tin xếp hạng, trình soạn bài đa định dạng, tương tác (thích, lưu, chia sẻ), khảo sát và đăng ẩn danh.

## Tính năng

### Các tab bảng tin

| Tab | Mã | Nội dung | Thứ tự |
|---|---|---|---|
| Dành cho bạn | `for_you` | Bài phù hợp với người xem | Theo điểm xếp hạng |
| Đang theo dõi | `following` | Bài của người mình theo dõi | Mới nhất trước |
| Hỏi đáp | `qa` | Các câu hỏi học thuật | Theo điểm xếp hạng |
| Đã lưu | `bookmarks` | Bài đã đánh dấu | Mới nhất trước |

### Hai chế độ hiển thị

Danh sách (mặc định) và Tập trung: mỗi lần một bài, cuộn theo trang, phù hợp đọc trên điện thoại. Hai chế độ dùng chung dữ liệu và bộ lọc, đổi chế độ không đổi thứ hạng. Mặc định lưu ở Cài đặt, Giao diện; chuyển nhanh ngay trên trang chủ chỉ có hiệu lực trong phiên. Chế độ Tập trung ẩn thanh đầu trang và cột bên, video chỉ tự phát ở bài đang xem, mặc định tắt tiếng.

### Loại bài viết

| Loại | Mã | Dùng cho |
|---|---|---|
| Thảo luận chung | `general` | Chia sẻ, kinh nghiệm học tập |
| Hỏi đáp | `qa` | Câu hỏi học thuật, có thể chọn lời giải |
| Chia sẻ tài liệu | `document` | Đề thi, slide, tài liệu tham khảo |
| Tuyển nhóm | `group_recruit` | Tìm đồng đội, kèm số chỗ |
| Thông báo | `announcement` | Giảng viên, ban chủ nhiệm, admin |

### Trình soạn bài

- Văn bản Markdown, công thức LaTeX (`$E=mc^2$` và khối `$$ ... $$`), khối mã có tô màu cú pháp, sơ đồ Mermaid.
- Ảnh và video: ảnh đơn giữ tỉ lệ gốc; từ 2 ảnh hiển thị lưới, quá 4 ảnh ô cuối hiện `+N`; xem toàn màn hình bằng lightbox, chuyển ảnh bằng phím mũi tên.
- Tệp đính kèm đi vào Kho tài liệu (xem [Kho tài liệu](documents)).
- Khảo sát nhiều phương án, có thời hạn bình chọn.
- Gắn thẻ `#hashtag`, nhắc người `@username`, gắn môn học và cộng đồng.
- N7AI viết giúp phần giới thiệu tài liệu và tóm tắt bài.

### Tương tác

Thích, lưu, chia sẻ (liên kết, gửi vào tin nhắn), ghim bài của mình, đánh dấu đã giải (bài hỏi đáp), lưu trữ, báo cáo. Mọi thay đổi hiển thị ngay (cập nhật lạc quan) ở bảng tin, hồ sơ, cộng đồng và kết quả tìm kiếm, và hoàn tác nếu máy chủ từ chối.

### Đăng ẩn danh

Dùng cho câu hỏi nhạy cảm. Nguyên tắc: lưu thật, hiển thị ẩn. Máy chủ vẫn lưu tác giả (để chủ bài sửa xóa, admin truy vết khi có báo cáo), nhưng mọi phản hồi công khai thay tác giả bằng "Ẩn danh".

| Quy tắc | Giá trị |
|---|---|
| Loại bài cho phép | Hỏi đáp, công khai, ngoài cộng đồng |
| Bình luận ẩn danh | Mọi bài |
| Hạn mức trượt 24 giờ | 3 bài ẩn danh và 20 bình luận ẩn danh; vượt thì HTTP 429 |
| Che ở đâu | Bảng tin, chi tiết, tìm kiếm, GraphQL, thông báo, chia sẻ vào chat, tóm tắt AI, gợi ý `@mention` |
| Không báo | Người theo dõi không nhận thông báo; bài không vào tab Đang theo dõi |

## Thuật toán xếp hạng (Dành cho bạn, Hỏi đáp)

Điểm tính một lần mỗi lần tải theo công thức hot rank:

`điểm = (10 + độ hợp + 10 x đã giải + 12 x ln(1 + 2 x thích + 5 x bình luận)) / (tuổi_giờ + 2)^1,2 x 0,7^(đã xem, tối đa 5) x 0,5^(thứ hạng cùng tác giả - 2, tối thiểu 0)`

| Thành phần | Cách tính |
|---|---|
| Độ hợp | Cùng người theo dõi +35, thẻ trùng sở thích +35, thẻ trùng kỹ năng +25, hồ sơ quan tâm 0 đến 40 |
| Tương tác | Dùng logarit nên bài nhiều thích không đè mãi bài mới |
| Tuổi bài | Chia theo tuổi với lũy thừa 1,2; bài cũ tự tụt sau 1 đến 2 ngày. Tính theo mốc `snapshotAt` để phân trang ổn định |
| Đã xem | Mỗi lần đã lướt qua nhân 0,7 để bảng tin đổi giữa các lần vào |
| Đa dạng tác giả | Bài thứ 3 trở đi của cùng tác giả giảm dần, một người hoặc bot đăng dồn không chiếm cả trang |

## Quy tắc nghiệp vụ

- Bài ngoài cộng đồng đã duyệt, hoặc bài bị ẩn, không xuất hiện ở bảng tin chung.
- Hạn chế tài khoản chặn đăng, sửa bài.
- Bài chứa từ cấm nặng bị chặn lúc đăng khi kiểm duyệt tự động bật (xem [An toàn nội dung](moderation)).
- Số bài trong cộng đồng do trigger tính lại khi bài vào, rời, bị ẩn hoặc lưu trữ.

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `posts` | Nội dung, loại, thẻ, môn, cộng đồng, cờ ẩn danh, ghim, đã giải, ẩn, lưu trữ |
| `post_reactions` | Thích |
| `saved_posts` | Lưu |
| `post_documents` | Liên kết bài với tài liệu |
| `user_events` | Sự kiện xem bài, dùng cho xếp hạng |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/posts` | Danh sách theo tab, bộ lọc, phân trang |
| GET | `/posts/new-since` | Số bài mới kể từ mốc, cho biểu ngữ "bài mới" |
| GET | `/posts/:id` | Chi tiết |
| POST | `/posts` | Tạo bài (có `documentIds`, `isAnonymous`, khảo sát) |
| PATCH, DELETE | `/posts/:id` | Sửa, xóa |
| POST, DELETE | `/posts/:id/archive` | Lưu trữ, bỏ lưu trữ |
| POST | `/posts/:id/like` | Thích hoặc bỏ thích |
| POST | `/posts/:id/bookmark` | Lưu hoặc bỏ lưu |
| POST | `/posts/:id/vote-poll` | Bình chọn |
| POST | `/posts/:id/pin` | Ghim |
| POST | `/posts/:id/resolve` | Đánh dấu đã giải |
| POST | `/posts/:id/summary` | N7AI tóm tắt |
| POST | `/posts/:id/report` | Báo cáo |

Ngoài REST còn có truy vấn GraphQL `feed`, `post` dùng cùng bộ xếp hạng.

## Giới hạn đã biết

- Chủ bài chưa có trang riêng liệt kê các bài ẩn danh của mình; tìm trong bảng tin, bài có nhãn "bạn".
- Admin luôn thấy tác giả thật của bài ẩn danh.
