# Tìm kiếm

## Mục đích

Một ô tìm kiếm cho toàn hệ thống. Người dùng gõ tiếng Việt có dấu, không dấu, hoa thường, gõ dở hoặc sai nhẹ vẫn tìm được môn học, tài liệu, bài viết, người dùng và nhóm học; kết quả liên quan nhất ở trên cùng.

## Tính năng

| Tính năng | Mô tả |
|---|---|
| Gợi ý trực tiếp | Cửa sổ nổi dưới ô tìm kiếm, hiện vài kết quả đầu mỗi loại, không làm nhảy bố cục |
| Lịch sử gần đây | Lưu trong trình duyệt |
| Trang kết quả `/search` | Tab: Tất cả, Môn học, Tài liệu, Bài viết, Mọi người, Nhóm học |
| Hashtag và xu hướng | Chủ đề nóng trong tuần hiển thị ở cột bên phải |

## Cách tìm

```
GET /api/search?q=&type=&limit=&offset=
  1. Chuẩn hóa truy vấn: bỏ dấu, tách từ, tạo truy vấn tiền tố
  2. Với mỗi loại, chạy song song:
     Pha 1  Tìm toàn văn trên cột search_tsv (chỉ mục GIN)
     Pha 2  Tìm gần đúng bằng trigram, chỉ chạy khi pha 1 thiếu kết quả
  3. Xếp hạng = điểm chữ + khớp tên + độ phổ biến + độ mới
```

Chỉ dùng PostgreSQL (`unaccent`, `pg_trgm`, cấu hình `simple`), không cần công cụ tìm kiếm ngoài.

### Trọng số theo loại

| Loại | Trọng số A (cao) | B | C |
|---|---|---|---|
| Bài viết | Tiêu đề | Nội dung | Thẻ |
| Tài liệu | Tiêu đề | Mô tả | Thẻ |
| Môn học | Mã và tên | Mô tả | không |
| Người dùng | Username, tên hiển thị, mã sinh viên | Giới thiệu | Kỹ năng, sở thích |
| Nhóm học | Tên, mã môn | Chủ đề, mô tả | Công nghệ |

## Xu hướng

Điểm chủ đề trong 7 ngày: `lượt xem + 3 x lượt thích + 5 x bình luận` của các bài gắn thẻ đó. Top chủ đề hiện ở cột phải.

## Quy tắc nghiệp vụ

- Kết quả tôn trọng quyền xem: bài trong cộng đồng chưa duyệt, bài bị ẩn, tài liệu riêng tư không xuất hiện.
- Bài ẩn danh không khớp theo tên tác giả hay khoa tác giả.
- Mọi truy vấn được ghi vào `search_logs` để admin phân tích từ khóa phổ biến và từ khóa không có kết quả.
- Cột `search_tsv` là cột sinh tự động, tự cập nhật khi dữ liệu đổi, không cần tác vụ đồng bộ.

## Dữ liệu

| Bảng, cột | Nội dung |
|---|---|
| `posts`, `documents`, `courses`, `users`, `study_groups` (cột `search_tsv`) | Chỉ mục toàn văn |
| `search_logs` | Nhật ký truy vấn |

## API

| Phương thức | Đường dẫn | Việc |
|---|---|---|
| GET | `/search` | Tìm theo `q`, `type`, `limit`, `offset` |
| GET | `/admin/search/top`, `/admin/search/zero-results` | Phân tích cho admin |

Tìm kiếm cho N7AI dùng thêm vector, xem [Nguồn tài liệu và RAG](../n7ai/sources-rag).
