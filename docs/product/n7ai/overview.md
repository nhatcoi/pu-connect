# Tổng quan N7AI

## Mục đích

N7AI là trợ lý học tập tích hợp trong PU Connect. Khác một chatbot đứng riêng, N7AI biết ngữ cảnh học tập của người dùng (tài liệu trong kho, bài viết, nhóm học, hồ sơ học) và có thể gọi công cụ để tra cứu trước khi trả lời, luôn trích nguồn.

## Các điểm vào

| Điểm vào | Mô tả | Ngữ cảnh N7AI đọc |
|---|---|---|
| Không gian `/n7ai` | Chat riêng, lịch sử, thư viện, ghi chú, cài đặt | Lịch sử, bộ nhớ, hồ sơ học, tài liệu của hội thoại, kết nối đã bật |
| Chat nhanh trong Tin nhắn | Thread N7AI mới nhất, mở nhanh bằng nút nổi | Như trên |
| `@n7ai` trong bình luận | Hỏi ngay dưới bài viết | Bài viết và nhánh bình luận, xem [N7AI trong bình luận và chat](in-app-context) |
| `@n7ai` trong chat nhóm hoặc cá nhân | Hỏi giữa cuộc trò chuyện | 30 tin gần nhất |
| Nút trên bài và tài liệu | Tóm tắt bài, gợi ý phân loại, học với tài liệu | Chính bài hoặc tài liệu đó |

## Các module

| Module | Nội dung |
|---|---|
| [Chat và thư mục](chat-workspace) | Thread, lịch sử, thư mục, chia sẻ, thư viện, bố cục |
| [Chế độ học](learning-modes) | Hỏi đáp, giải thích, giải bài, quiz, flashcard, kế hoạch, nghiên cứu |
| [Agent engine và công cụ](agent-engine) | Vòng lặp hai pha, công cụ, tự phục hồi, hỏi lại người dùng |
| [Nguồn tài liệu và RAG](sources-rag) | Tệp, văn bản, liên kết, YouTube; lập chỉ mục và tìm kiếm kết hợp |
| [Bộ nhớ, ghi chú và tác vụ](notes-memory-tasks) | Bộ nhớ dài hạn, ghi chú Markdown, tác vụ lặp lịch, dữ liệu cá nhân |
| [Kết nối ngoài](connectors) | Google Workspace, PU Connect, Semantic Scholar |
| [Mức model và hạn mức](models-quota) | Nhanh, Cân bằng, Sâu; hạn mức lượt mỗi ngày |
| [N7AI trong bình luận và chat](in-app-context) | Cách dựng ngữ cảnh theo nơi gọi |

## Nguyên tắc

| Nguyên tắc | Ý nghĩa |
|---|---|
| Quyền của người hỏi | Mọi truy vấn dữ liệu đi qua kiểm tra quyền xem của người gọi; bot không có quyền riêng |
| Đọc tự do, ghi phải xác nhận | Công cụ chỉ đọc. Hành động ghi (tham gia nhóm, lưu bộ học) hiện thẻ đề xuất hoặc cần người dùng xác nhận |
| Trích nguồn | Câu trả lời học thuật kèm trích dẫn đánh số; không có nguồn thì nói không chắc |
| Nhóm không đọc dữ liệu cá nhân | Chat nhóm không dùng bộ nhớ và kết nối riêng của ai |
| Minh bạch chi phí | Mỗi lượt gọi ghi `ai_runs`; người dùng thấy lượt còn lại và thống kê token |

## Quan sát được trên giao diện

Mỗi câu trả lời có dòng trạng thái (đang suy nghĩ, thời gian), khối suy luận gập mở, các bước công cụ đã chạy, trích dẫn, thanh tác vụ (sao chép, đọc to, thử lại, xóa, thêm vào ghi chú) và chỉ số token, tỉ lệ cache, thời gian mô hình.

## Vận hành

Admin cấu hình provider, danh mục model, dịch vụ embedding và OCR, xem telemetry, xử lý ticket và kiểm duyệt skill ở Admin Console, mục N7AI (xem [Admin: Vận hành AI](../admin/ai-operations)).
