# Chat và thư mục

## Mục đích

Không gian `/n7ai` là nơi trò chuyện dài với N7AI: nhiều thread, lịch sử có thư mục, thư viện tệp và học liệu, bố cục ba vùng.

## Route

| Route | Nội dung |
|---|---|
| `/n7ai` | Chat mới: màn chào, gợi ý, ô soạn |
| `/n7ai/[id]` | Một thread; tham số `?m=<messageId>` cuộn tới tin |
| `/n7ai/library` | Tab Tài liệu, Ảnh, Học liệu (cuộn vô hạn; quiz và flashcard ôn tại chỗ) |
| `/n7ai/settings`, `/n7ai/settings/[mục]` | Cài đặt: kỹ năng, kết nối, bộ nhớ, tác vụ, hỗ trợ, quyền riêng tư |

Liên kết cũ dưới `/settings/n7ai*` chuyển hướng 308 sang `/n7ai/settings*`.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Thread | Mỗi thread là một hội thoại loại `ai`; "Chat mới" dùng lại thread rỗng nên bấm nhiều lần không sinh thread rác |
| Tên thread | Tự đặt từ câu hỏi đầu (cắt 60 ký tự), sửa được |
| Lịch sử | Tải theo trang, tìm kiếm trên mọi thư mục |
| Thư mục | Gom thread theo môn, dự án: tối đa 50 thư mục, tên tối đa 60 ký tự; kéo thả thread vào thư mục, menu "Chuyển vào thư mục" cho điện thoại; xóa thư mục thì thread về Lịch sử |
| Ô soạn | Đính kèm bằng `+`, chọn mức model, micro, gửi; khay chọn chế độ học, kết nối, chip hạn mức ngày |
| Phím gạch chéo | `/` gọi chế độ học hoặc skill tự tạo; `@` nhắc người hoặc gắn ngữ cảnh |
| Tác vụ trên câu trả lời | Sao chép, đọc to (tự nhận tiếng Việt hoặc Anh), thử lại, xóa tin, thêm vào ghi chú |
| Thống kê token | Tổng, đầu vào, cache, đầu ra, suy luận, tỉ lệ cache, TTFT, tốc độ; theo lượt hoặc cả phiên |
| Chia sẻ | Tạo liên kết công khai `/share/[token]` cho cả thread; thu hồi bất kỳ lúc nào |
| Tin gửi thêm | Gửi thêm khi N7AI đang trả lời thì được gộp vào lượt đang chạy |
| Thư viện | Gom ảnh, tệp, học liệu từ mọi thread của mình |
| Skill | Tối đa 30 skill riêng (chỉ dẫn do người dùng viết); chia sẻ công khai thì người khác cài bằng cách sao chép. Skill chính thức (tài khoản `@n7ai`) dùng được ngay, không cần cài |
| Kỹ năng ở chế độ Tự động | Khi không chọn skill nào, N7AI nhận danh sách skill đang bật (tối đa 40, mỗi skill một dòng: lệnh và mô tả) và tool `skill__read`; nếu câu hỏi khớp mô tả, N7AI tự đọc chỉ dẫn đầy đủ rồi làm theo (tối đa 2 skill mỗi lượt). Chọn một skill trong menu Kỹ năng hoặc gõ `/lệnh` thì chỉ dẫn được nạp thẳng vào lượt đó. Công tắc "Mỗi lượt" giữ lựa chọn sang các lượt sau |

## Bố cục

| Vùng | Hành vi |
|---|---|
| Thanh bên trái | Thu gọn bằng Ctrl hoặc Cmd cộng B thành dải biểu tượng 56 px; kéo giãn 220 đến 380 px; mặc định 272 px |
| Nội dung | Tối đa 820 px, căn giữa |
| Panel phải | Tab Tài liệu (xem trước tệp, nguồn của thread), Công cụ (tạo học liệu), Ghi chú; kéo giãn từ 340 px |

Trên điện thoại, thanh bên thành ngăn kéo trái.

## Quy tắc nghiệp vụ

- Dữ liệu dùng chung hạ tầng tin nhắn (`conversations.type = 'ai'`), nên thông báo, realtime, đính kèm không phải làm lại.
- Trí nhớ trong thread dài: tóm tắt cuộn (`ai_summary`) cộng tối đa 20 tin sau mốc tóm tắt.
- Thời gian lưu lịch sử đặt ở Cài đặt (30 ngày, 365 ngày hoặc vô hạn); tác vụ hằng ngày xóa thread hết hạn kèm tệp.
- Xóa thư mục không xóa thread.

## Dữ liệu

| Bảng, cột | Nội dung |
|---|---|
| `conversations` (`type = 'ai'`), `messages` | Thread và tin nhắn; `meta` giữ suy luận, bước công cụ, trích dẫn, bộ học |
| `ai_folders`, `conversations.ai_folder_id` | Thư mục |
| `ai_skills` | Skill |
| `ai_runs` | Mỗi lượt gọi mô hình: mô hình, token, thời gian |
| `ai_feedback` | Đánh giá tích cực hoặc tiêu cực cho từng câu trả lời |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET, POST | `/ai/threads` | Danh sách (lọc `folder=all|root|<id>`), tạo |
| PATCH, DELETE | `/ai/threads/:id` | Đổi tên, xóa |
| PATCH | `/ai/threads/:id/folder` | Chuyển thư mục |
| GET, POST, DELETE | `/ai/threads/:id/share` | Chia sẻ công khai |
| GET | `/ai/shared/:token` | Xem thread được chia sẻ |
| GET, POST, PATCH, DELETE | `/ai/folders...` | Thư mục |
| GET | `/ai/library` | Thư viện (`kind=image|file|study`) |
| GET, POST, PATCH, DELETE | `/ai/skills...` | Skill, thư viện skill, cài đặt skill |
| POST | `/ai/messages/:id/feedback` | Đánh giá câu trả lời |
