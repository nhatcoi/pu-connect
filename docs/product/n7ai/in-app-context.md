# N7AI trong bình luận và chat

## Mục đích

Gọi `@n7ai` ngay tại nơi đang trao đổi. Mỗi nơi có bộ dựng ngữ cảnh riêng để N7AI đọc đúng thứ cần, và chỉ đọc khi có người gọi.

## Theo nơi gọi

| Nơi gọi | N7AI đọc sẵn | Công cụ thêm (chỉ đọc) | Riêng tư |
|---|---|---|---|
| Bình luận | Bài viết (tối đa 6.000 ký tự) kèm loại, môn, cộng đồng, thẻ, trạng thái đã giải; nhánh bình luận đang hỏi (12); bình luận nổi bật ngoài nhánh (lời giải hoặc nhiều thích, tối đa 6) | `post__comments` đọc thêm bình luận của đúng bài | Chỉ nội dung bài người gọi xem được |
| Chat nhóm, chat cá nhân | Khối hội thoại (loại, tên nhóm, môn của nhóm học, mô tả, tối đa 30 thành viên) và 30 tin gần nhất kèm tên người gửi | `chat__earlier` đọc tin cũ của đúng hội thoại | Không đọc bộ nhớ và kết nối riêng của ai |
| Thread N7AI riêng | Lịch sử 20 tin cộng tóm tắt, bộ nhớ, hồ sơ học, kết nối | Theo kết nối đã bật | Dữ liệu riêng của chủ thread |
| Tóm tắt bài | Chỉ bài viết | Không | Bài ẩn danh thay tên bằng "Ẩn danh" |

## Cách hoạt động

1. Người dùng gõ `@n7ai` kèm câu hỏi.
2. Máy chủ dựng ngữ cảnh theo bảng trên, có ngân sách ký tự theo thứ tự ưu tiên; mỗi tin cắt tối đa 1.200 ký tự.
3. N7AI hiểu theo thứ tự: xác định yêu cầu chính, suy ra bối cảnh học thuật, chỉ tra công cụ khi thiếu, dựa lời giải sẵn có, không đoán danh tính.
4. Câu trả lời đăng dưới dạng bình luận hoặc tin nhắn của tài khoản `@n7ai`, nhưng chạy với quyền của người gọi.
5. Một lượt gọi tính vào hạn mức ngày của người gọi.

## Giới hạn đã biết

- Nhóm chat chưa có tóm tắt cuộn: tin cũ hơn 30 tin chỉ đọc được qua `chat__earlier` khi người gọi hỏi tới.
- Chưa có kiểm thử gọi model thật cho luồng agent trong CI; kiểm thử end-to-end phủ bộ dựng ngữ cảnh, quyền và công cụ.
