# 25. Kho tài liệu (đính kèm bài viết → kho môn học)

> Cập nhật 2026-10-27 · Đợt 1 (xương sống). Đợt sau: N7AI gợi ý phân loại / viết bài, kho cá nhân, đính kèm trong bình luận, trang Môn học & Tài liệu.

## Mô hình

Mỗi tệp là **một bản ghi `documents`** (một tệp thật trên R2). Bài viết (và sau này bình luận, kho cá nhân) chỉ **trỏ tới** bản ghi đó, không sao chép tệp.

| Cột / bảng | Ý nghĩa |
|---|---|
| `documents.status` | `draft` (vừa đính kèm, bài chưa đăng, luôn `private`) → `published` khi đăng bài |
| `documents.listed` | Có trong **kho môn học** (cần `course_id` + `doc_type`, bài công khai) |
| `documents.doc_type` | Phân loại nội dung (`doc_type_enum`): đề giữa kỳ, đề cuối kỳ, slide, đề cương, giáo trình, bài tập & lời giải, đồ án mẫu, báo cáo thực tập, bài báo, khác. `NULL` = chưa phân loại |
| `documents.type` | Định dạng tệp (pdf, doc, slides, sheet…), suy từ MIME |
| `documents.file_hash` | sha256 byte tệp ⇒ báo "đã có trong kho" khi tải lên tệp trùng |
| `documents.academic_year` | Năm học, vd `2025-2026` (tùy chọn) |
| `post_documents(post_id, document_id, position)` | Liên kết bài ↔ tài liệu. Cột URL `posts.attached_document_ids` vẫn được ghi để các danh sách cũ đếm được tệp |

Migration `documents-library-upgrade.sql` (idempotent; phần chuyển dữ liệu chạy một lần, đánh dấu `migration_marks`):
- Tài liệu cũ có môn + loại ⇒ `listed`.
- Mỗi URL trong `posts.attached_document_ids` ⇒ một tài liệu `published`, chưa phân loại, không vào kho, kèm dòng `post_documents`.

## Luồng đăng bài

1. Chọn tệp (không phải ảnh) ⇒ `POST /documents/upload` (multipart) ngay lúc đính kèm: tải lên R2, tạo bản nháp, trả `duplicateOf` nếu đã có tài liệu công khai cùng nội dung.
2. Thẻ tệp trong composer có ô **Môn học · Loại · Năm học** và công tắc **Đưa vào kho môn học** (`PATCH /documents/:id`, chỉ chủ tài liệu). Đủ môn + loại lần đầu ⇒ web tự bật công tắc (người đăng tắt được). Bài đang gắn môn ⇒ tệp mới tự nhận môn đó.
3. Trùng nội dung ⇒ "Dùng bản đó": bỏ bản nháp, bài trỏ tới tài liệu có sẵn (giữ chủ sở hữu và phân loại gốc).
4. Intent **Đề thi & Slide** bắt buộc có tệp và mỗi tệp đủ môn + loại. Intent khác: không phân loại vẫn đăng được, tệp chỉ là đính kèm của bài.
5. `POST /posts` gửi `documentIds`: bản nháp của người đăng ⇒ `published`, quyền xem theo bài (bài không công khai ⇒ tài liệu riêng tư, không vào kho); tài liệu công khai của người khác chỉ được liên kết.
6. Gỡ tệp khỏi bài đang soạn ⇒ `DELETE /documents/:id/draft`. Bản nháp bỏ quá 24 giờ bị dọn mỗi giờ (bản ghi vào thùng rác; tệp R2 còn lại).

Bài viết trả `documents: AttachedDocument[]` (feed, chi tiết bài): thẻ hiện loại, năm học, dung lượng, mã môn (link trang môn), nhãn "Kho môn học"; bấm mở tệp và đếm lượt tải (`POST /documents/:id/download`).

## Kho môn học

- Tab Tài liệu của trang môn và số đếm tài liệu của môn chỉ tính tài liệu `listed`.
- Nút "Chia sẻ tài liệu" ở trang môn: tải tệp thật lên rồi `POST /documents` với môn + loại bắt buộc (gắn sẵn môn của trang).

## An toàn

- `POST /documents` validate Zod, chỉ nhận URL nằm trong thư mục `documents/` trên R2 của hệ thống (chặn link ngoài / `javascript:`).
- `GET /documents/:id`: bản nháp và tài liệu riêng tư chỉ chủ sở hữu xem được; chủ xem không tăng lượt xem.
- GraphQL `documents`: bỏ email người đăng, chỉ trả tài liệu công khai đã đăng, lọc `courseCode` thật.
- N7AI (RAG) chỉ đọc tệp trên R2 của mình; bản nháp/riêng tư chỉ dùng cho chính chủ.

Test: `apps/api/test/documents-library.e2e-spec.ts`.
