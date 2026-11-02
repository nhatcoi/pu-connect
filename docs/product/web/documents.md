# Kho tài liệu

## Mục đích

Biến tệp đính kèm trong bài viết và bình luận thành tài liệu có cấu trúc: phân loại theo môn và loại, tìm lại được, lưu về kho cá nhân, gom thành bộ sưu tập và dùng làm nguồn cho N7AI.

## Mô hình

Mỗi tệp là một bản ghi `documents` (một tệp thật trên R2). Bài viết, bình luận và kho cá nhân chỉ trỏ tới bản ghi đó, không sao chép tệp.

| Thuộc tính | Ý nghĩa |
|---|---|
| `status` | `draft` (vừa đính kèm, bài chưa đăng, luôn riêng tư) chuyển sang `published` khi đăng bài |
| `listed` | Có trong kho môn học (cần môn, loại tài liệu và bài công khai) |
| `doc_type` | Đề giữa kỳ, đề cuối kỳ, slide, đề cương, giáo trình, bài tập và lời giải, đồ án mẫu, báo cáo thực tập, bài báo, khác; trống nghĩa là chưa phân loại |
| `academic_year` | Năm học, ví dụ `2025-2026` (tùy chọn) |
| `file_hash` | Mã băm sha256 để phát hiện tệp trùng |
| `rating_avg`, `rating_count` | Đánh giá sao |
| `save_count` | Số người lưu (trừ chủ) |

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Đính kèm khi đăng bài | Tệp tải lên ngay lúc chọn; thẻ tệp có ô Môn học, Loại, Năm học và công tắc "Đưa vào kho môn học" |
| Chống trùng | Tệp trùng nội dung với tài liệu công khai có sẵn: gợi ý "Dùng bản đó" để bài trỏ tới tài liệu cũ |
| N7AI gợi ý phân loại | Đọc phần đầu tài liệu, đề xuất môn và loại; người dùng xem rồi mới lưu (tốn 1 lượt) |
| N7AI viết giúp | Soạn phần giới thiệu tài liệu cho bài viết; có nút Hoàn tác |
| Tài liệu trong bình luận | Tối đa 3 tệp mỗi bình luận |
| Trang môn và trang Tài liệu | Duyệt kho theo môn, loại, năm học; sắp theo sao hoặc lượt tải |
| Trang chi tiết `/documents/[id]` | Xem, tải, đánh giá sao, lưu, thêm vào bộ sưu tập |
| Học với N7AI | Tóm tắt Markdown; tạo nháp flashcard hoặc quiz từ tài liệu |
| Kho cá nhân `/documents?tab=library` | Tab Đã lưu và Tôi đã đăng; thư mục (tối đa 50, tên không trùng); tải thẳng tệp riêng |
| Bộ sưu tập | Gom tài liệu, công khai hoặc riêng; thêm cả bộ vào nguồn của N7AI |
| Lộ trình học theo môn | Các bước ôn theo thứ tự cùng tài liệu nổi bật; đề thi gom theo năm |

## Luồng đăng bài có tài liệu

1. Chọn tệp thì `POST /documents/upload` tạo bản nháp và trả `duplicateOf` nếu đã có.
2. Điền môn, loại, năm; bật công tắc để vào kho môn học.
3. Đăng bài (`POST /posts` kèm `documentIds`): bản nháp của người đăng chuyển sang đã đăng, quyền xem theo bài. Bài không công khai thì tài liệu riêng tư và không vào kho.
4. Gỡ tệp khỏi bài đang soạn thì xóa bản nháp; nháp bỏ quá 24 giờ bị dọn mỗi giờ (bản ghi vào thùng rác, tệp R2 xóa nếu không còn bản ghi nào dùng).

## Quy tắc nghiệp vụ

- Loại bài "Chia sẻ tài liệu" bắt buộc có tệp và mỗi tệp phải đủ môn, loại. Loại bài khác không phân loại vẫn đăng được, tệp chỉ là đính kèm.
- Chỉ chủ tài liệu sửa phân loại hoặc yêu cầu N7AI gợi ý.
- Đánh giá sao 1 đến 5, chỉ với tài liệu công khai đã đăng và không phải của mình; sau mỗi lần chấm máy chủ tính lại điểm trung bình.
- Kho cá nhân chỉ lưu tham chiếu. Tài liệu gốc bị xóa hoặc chuyển riêng tư thì biến mất khỏi kho người khác.
- Hạn chế tài khoản chặn tải tài liệu lên.
- Tài liệu được lập chỉ mục nội dung để N7AI tìm (xem [Nguồn tài liệu và RAG](../n7ai/sources-rag)).

## Dữ liệu

| Bảng | Nội dung |
|---|---|
| `documents` | Bản ghi tài liệu |
| `post_documents`, `comment_documents` | Liên kết với bài, bình luận |
| `library_items`, `library_folders` | Kho cá nhân |
| `document_ratings` | Đánh giá sao |
| `document_collections`, `document_collection_items` | Bộ sưu tập |
| `document_chunks` | Đoạn nội dung đã lập chỉ mục |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/documents`, `/documents/browse`, `/documents/:id`, `/documents/:id/detail` | Danh sách, duyệt, chi tiết |
| POST | `/documents/upload`, `/documents` | Tải lên, tạo |
| PATCH, DELETE | `/documents/:id` | Sửa phân loại, xóa |
| DELETE | `/documents/:id/draft` | Gỡ bản nháp |
| POST | `/documents/:id/download` | Ghi nhận lượt tải |
| PUT, DELETE | `/documents/:id/rating` | Đánh giá |
| POST | `/documents/:id/suggest`, `/documents/suggest-file` | N7AI gợi ý phân loại |
| POST | `/documents/write-post` | N7AI viết giúp bài |
| POST | `/documents/:id/summarize`, `/documents/:id/study-draft` | Tóm tắt, nháp bộ học |
| GET | `/documents/course-path` | Lộ trình theo môn |
| GET, POST, PATCH, DELETE | `/library`, `/library/ids`, `/library/upload`, `/library/folders...` | Kho cá nhân |
| GET, POST, PATCH, DELETE, PUT | `/collections...` | Bộ sưu tập |
