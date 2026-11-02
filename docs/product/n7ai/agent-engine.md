# Agent engine và công cụ

## Mục đích

Agent engine là vòng lặp duy nhất xử lý mọi lượt trả lời của N7AI: thread riêng, `@n7ai` trong chat, bình luận và tóm tắt bài viết. Mục tiêu: luôn ra được câu trả lời đầy đủ dù đã gọi nhiều công cụ, và không bao giờ báo "bị cắt do quá dài" khi phần suy nghĩ chiếm hết ngân sách.

## Vòng lặp hai pha

| Pha | Việc | Giới hạn |
|---|---|---|
| Thăm dò | Model gọi công cụ tra cứu (tài liệu, bài viết, Google, lịch học...) | 3 vòng; Nghiên cứu 5 vòng |
| Tổng hợp | Đóng công cụ, cấp đủ token đầu ra (tối thiểu 2.048) để viết câu trả lời | Một vòng, có vòng chốt dự phòng |

Hết ngân sách thăm dò, engine chèn chỉ dẫn chốt và đặt `tool_choice = none`. Nếu model vẫn gọi công cụ, lệnh không chạy và model được báo "đã hết lượt tra cứu".

## Tự phục hồi

| Tình huống | Xử lý |
|---|---|
| Câu trả lời cụt giữa chừng | Chèn chỉ dẫn viết tiếp, không lặp lại |
| Model trả rỗng | Thử lại một lần |
| Suy nghĩ ăn hết ngân sách | Vòng tổng hợp vẫn đủ token đầu ra |
| Luồng bị cắt | Thử lại một lần, ước lượng usage khi gateway không trả |
| Lô công cụ bị cắt | Từ chối cả lô, không chạy dở |
| Lệnh trùng | Bỏ lệnh trùng; tối đa 15 lệnh mỗi vòng |
| Gateway chính lỗi | Chuyển sang provider kế tiếp theo ưu tiên (xem [Admin: Vận hành AI](../admin/ai-operations)) |

## Quản lý ngữ cảnh

- Khối suy nghĩ (`<think>` hoặc `reasoning_content`) được tách theo thời gian thực, không lộ thẻ kể cả khi bị xé vụn qua các gói stream.
- Khi vượt cửa sổ ngữ cảnh: lược kết quả công cụ cũ trước, rồi bỏ nguyên nhóm lịch sử cũ nhất, không để lại lệnh công cụ mồ côi.
- Đọc tài liệu dài: bước tóm lược sơ bộ trước khi đưa vào ngữ cảnh.
- Tin gửi thêm khi N7AI đang trả lời được gộp vào lượt đang chạy.

## Công cụ

Mỗi lượt chỉ gửi công cụ của nguồn đang bật. Công cụ đọc có thể chạy song song có giới hạn; công cụ ghi chạy tuần tự.

| Nhóm | Công cụ | Việc |
|---|---|---|
| PU Connect | `puc__search`, `puc__read`, `puc__app_help` | Tìm bài, tài liệu, môn, người, nhóm, cộng đồng; đọc sâu; hướng dẫn dùng ứng dụng |
| Hội thoại của tôi | `my_chats__search_threads`, `my_chats__get_thread` | Tìm lại thread N7AI cũ của chính mình |
| Học tập | `my_study__create_flashcards`, `my_study__create_quiz` | Tạo bộ học |
| Bộ nhớ | `memory__search` | Tìm bộ nhớ dài hạn |
| Tạo tệp | `puc__create_presentation`, `puc__create_document`, `puc__create_pdf_report`, `puc__create_spreadsheet` | Xuất tệp thật (.pptx, .docx, .pdf, .xlsx), đính kèm tin nhắn, xem trước ngay trong app |
| Kỹ năng | `skill__read` | Đọc chỉ dẫn đầy đủ của 1 skill đang bật khi câu hỏi khớp mô tả (xem [Phiên chat](chat-workspace)) |
| Hỏi lại | `ask_user` | Tạm dừng, hỏi lựa chọn |
| Ngữ cảnh nơi gọi | `post__comments`, `chat__earlier` | Đọc thêm bình luận hoặc tin cũ của đúng nơi đang gọi |
| Web | Đọc trang web, tìm kiếm web | URL trong câu hỏi; tìm web cần khóa Tavily |
| Kết nối ngoài | `google_*`, `pu_connector__*`, `semantic_scholar__search` | Xem [Kết nối ngoài](connectors) |

Công cụ danh mục khởi tạo lười: danh mục lạnh chỉ có `__discover_tools`, chọn mới khởi tạo kết nối và mở công cụ thật ở vòng sau, nên chào hỏi không tốn kết nối mạng.

### Phân loại dữ liệu theo nơi đặt

| Loại dữ liệu | Đặt ở |
|---|---|
| Nhỏ, lượt nào cũng cần (hồ sơ học, mục nhớ ghim, giờ hiện tại) | Prompt hệ thống |
| Truy xuất theo yêu cầu (thư viện, nguồn) | Công cụ |
| Lớn, có điều kiện, riêng tư (hội thoại cũ, Gmail, Drive) | Công cụ |
| Ghi hoặc thay đổi dữ liệu | Đề xuất, người dùng bấm xác nhận |

## Bảo mật

- Đọc URL do người dùng đưa: chỉ http(s) cổng 80 hoặc 443, phân giải DNS rồi chặn IP nội bộ, loopback, link-local; theo tối đa 3 lần chuyển hướng (kiểm lại mỗi bước); tối đa 1 MB; hết thời gian sau 8 giây.
- Đối số công cụ do model sinh ra được kiểm schema; đối số bắt đầu bằng `_` bị lọc.
- Nội dung do người dùng nhập được vô hiệu các thẻ giả để không đóng khối bao quanh trong prompt.

## Giao diện liên quan

Khối suy luận gập mở với đồng hồ giây, danh sách bước công cụ, thẻ `ask_user`, chip hạn mức ngày, thẻ nút dẫn đường tới trang trong ứng dụng.

## Kiểm thử

Bộ kiểm thử đơn vị phủ bộ lọc suy nghĩ, ngữ cảnh, hỏi lại và bộ lập lịch vòng lặp; kiểm thử end-to-end phủ luồng trả lời qua stream.
