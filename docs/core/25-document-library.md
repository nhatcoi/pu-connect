# 25. Kho tài liệu (đính kèm bài viết → kho môn học)

> Cập nhật 2026-10-27 · Đợt 1 (xương sống) → đợt 2 (N7AI gợi ý phân loại, Viết giúp) → đợt 3 (kho cá nhân, tài liệu trong bình luận) → đợt 4 (trang Môn học & Tài liệu, trang chi tiết tài liệu).

## Mô hình

Mỗi tệp là **một bản ghi `documents`** (một tệp thật trên R2). Bài viết, bình luận và kho cá nhân chỉ **trỏ tới** bản ghi đó, không sao chép tệp.

| Cột / bảng | Ý nghĩa |
|---|---|
| `documents.status` | `draft` (vừa đính kèm, bài chưa đăng, luôn `private`) → `published` khi đăng bài |
| `documents.listed` | Có trong **kho môn học** (cần `course_id` + `doc_type`, bài công khai) |
| `documents.doc_type` | Phân loại nội dung (`doc_type_enum`): đề giữa kỳ, đề cuối kỳ, slide, đề cương, giáo trình, bài tập & lời giải, đồ án mẫu, báo cáo thực tập, bài báo, khác. `NULL` = chưa phân loại |
| `documents.type` | Định dạng tệp (pdf, doc, slides, sheet…), suy từ MIME |
| `documents.file_hash` | sha256 byte tệp ⇒ báo "đã có trong kho" khi tải lên tệp trùng |
| `documents.academic_year` | Năm học, vd `2025-2026` (tùy chọn) |
| `post_documents(post_id, document_id, position)` | Liên kết bài ↔ tài liệu. Cột URL `posts.attached_document_ids` vẫn được ghi để các danh sách cũ đếm được tệp |
| `comment_documents(comment_id, document_id, position)` | Liên kết bình luận ↔ tài liệu (tối đa 3 / bình luận) |
| `library_items(owner_id, document_id, folder_id)` | Kho cá nhân: tham chiếu, không sao chép. `documents.save_count` = số người lưu (trừ chủ), giữ bằng trigger |
| `library_folders(owner_id, name)` | Thư mục trong kho cá nhân (tên không trùng, không phân biệt hoa thường; tối đa 50) |

Migration `documents-library-upgrade.sql` (idempotent; phần chuyển dữ liệu chạy một lần, đánh dấu `migration_marks`):
- Tài liệu cũ có môn + loại ⇒ `listed`.
- Mỗi URL trong `posts.attached_document_ids` ⇒ một tài liệu `published`, chưa phân loại, không vào kho, kèm dòng `post_documents`.

Migration `document-library-personal-upgrade.sql` (đợt 3, idempotent): `library_folders`, `library_items` + trigger `save_count`, `comment_documents`, index kho chung theo lượt tải.

## Luồng đăng bài

1. Chọn tệp (không phải ảnh) ⇒ `POST /documents/upload` (multipart) ngay lúc đính kèm: tải lên R2, tạo bản nháp, trả `duplicateOf` nếu đã có tài liệu công khai cùng nội dung.
2. Thẻ tệp trong composer có ô **Môn học · Loại · Năm học** và công tắc **Đưa vào kho môn học** (`PATCH /documents/:id`, chỉ chủ tài liệu). Đủ môn + loại lần đầu ⇒ web tự bật công tắc (người đăng tắt được). Bài đang gắn môn ⇒ tệp mới tự nhận môn đó.
3. Trùng nội dung ⇒ "Dùng bản đó": bỏ bản nháp, bài trỏ tới tài liệu có sẵn (giữ chủ sở hữu và phân loại gốc).
4. Intent **Đề thi & Slide** bắt buộc có tệp và mỗi tệp đủ môn + loại. Intent khác: không phân loại vẫn đăng được, tệp chỉ là đính kèm của bài.
5. `POST /posts` gửi `documentIds`: bản nháp của người đăng ⇒ `published`, quyền xem theo bài (bài không công khai ⇒ tài liệu riêng tư, không vào kho); tài liệu công khai của người khác chỉ được liên kết.
6. Gỡ tệp khỏi bài đang soạn ⇒ `DELETE /documents/:id/draft`. Bản nháp bỏ quá 24 giờ bị dọn mỗi giờ: bản ghi vào thùng rác, tệp R2 bị xóa nếu không bản ghi nào khác dùng cùng URL.

Bài viết trả `documents: AttachedDocument[]` (feed, chi tiết bài): thẻ hiện loại, năm học, dung lượng, mã môn (link trang môn), nhãn "Kho môn học"; bấm mở tệp và đếm lượt tải (`POST /documents/:id/download`).

## N7AI trong kho tài liệu (đợt 2)

Cả hai tính **1 lượt N7AI** (`ai_runs.trigger = 'document'`, task `doc_classify` / `doc_post`); AI không tự lưu gì, người dùng xem rồi mới lưu / đăng.

- **N7AI gợi ý** trên thẻ tệp ⇒ `POST /documents/:id/suggest` (chỉ chủ tài liệu). Đọc đoạn đầu nội dung (từ `document_chunks` nếu đã index, chưa thì đọc thẳng ≤ 5 trang đầu trên R2), kèm danh sách môn + loại; model trả JSON. Server chỉ giữ mã môn có thật, khóa loại hợp lệ, năm học dạng `YYYY-(YYYY+1)`. Web điền các ô N7AI chắc chắn qua `PATCH /documents/:id` (đủ môn + loại ⇒ tự bật Đưa vào kho như chọn tay).
- **N7AI viết giúp** dưới phần đính kèm của composer ⇒ `POST /documents/write-post { documentIds, content? }`: viết nội dung bài giới thiệu tài liệu (tài liệu của mình hoặc công khai), giữ ý bản đang viết nếu có; toast có **Hoàn tác**.
- **Học với N7AI** trên trang `/documents/[id]` (đăng nhập, xem được tài liệu): `POST /documents/:id/summarize` ⇒ tóm tắt Markdown (không lưu); `POST /documents/:id/study-draft { kind: 'flashcards' | 'quiz' }` ⇒ bản nháp bộ học tập qua `StudyDraftService` (cùng hợp đồng registry với `/tools/sets/draft`), web lưu luôn bằng `POST /tools/sets` rồi dẫn tới `/tools/<kind>/<id>`. Nội dung lấy từ `document_chunks` / ≤ 5 trang đầu trên R2 (tối đa 8000 ký tự); không trích được chữ (PDF quét ảnh…) ⇒ 400, không để model đoán từ tên tệp. Mỗi lần 1 lượt N7AI (quota + `ai_runs`).

## Bình luận kèm tài liệu (đợt 3)

Nút kẹp giấy ở ô bình luận ⇒ tệp tải lên ngay thành bản nháp (`POST /documents/upload`), gửi `documentIds` cùng `POST /posts/:postId/comments`. Bản nháp ⇒ `published`, quyền xem theo bài chứa bình luận. `CommentItem.documents` hiện thẻ gọn dưới bình luận (lưu / tải được). Tài liệu bị chủ chuyển riêng tư chỉ chủ còn thấy.

## Kho cá nhân (đợt 3)

`/courses?tab=library` — "Kho của tôi":
- **Đã lưu**: tài liệu lưu từ bài, bình luận, kho môn học, trang chi tiết (nút lưu `POST /library`, bỏ `DELETE /library/:documentId`, `GET /library/ids` để đánh dấu nút) + tệp riêng tải thẳng lên (`POST /library/upload`: tài liệu `published` riêng tư, không hết hạn như bản nháp).
- **Tôi đã đăng**: mọi tài liệu mình sở hữu đã đăng (`GET /library?scope=mine`).
- Thư mục: `GET/POST /library/folders`, `PATCH/DELETE /library/folders/:id` (xóa thư mục ⇒ tài liệu về "Chưa phân thư mục"); chuyển tài liệu `PATCH /library/:documentId { folderId }`.
- Chỉ là tham chiếu: tài liệu gốc bị xóa (cascade) hoặc chuyển riêng tư ⇒ biến mất khỏi kho người khác.

## Kho môn học & trang Tài liệu (đợt 4)

- Nav **Môn học** → `/courses` "Môn học & Tài liệu", 3 tab: **Môn học** (danh mục) · **Tài liệu** (`?tab=documents`) · **Kho của tôi** (`?tab=library`).
- Tab Tài liệu ⇒ `GET /documents/browse?course&category&q&sort=popular|newest&cursor` (chỉ `listed`, 20 / trang, offset). "Nhiều lượt tải" xếp theo `download_count + 2 × save_count`. Tab Tài liệu của trang môn dùng cùng danh sách, cố định môn.
- Tab Tài liệu của trang môn và số đếm tài liệu của môn chỉ tính tài liệu `listed`.
- Nút "Chia sẻ tài liệu": tải tệp thật lên rồi `POST /documents` với môn + loại bắt buộc (gắn sẵn môn nếu mở từ trang môn).

## Trang chi tiết `/documents/[id]` (đợt 4)

`GET /documents/:id/detail`: tài liệu công khai đã đăng (hoặc của chính mình), kèm tối đa 5 bài viết công khai có đính kèm và 6 tài liệu cùng môn (ưu tiên cùng loại). Trang có xem trước tệp trong app (trình xem dùng chung với N7AI), Tải về, Lưu vào kho, Chia sẻ; chủ tài liệu sửa phân loại và **xóa** (`DELETE /documents/:id`: gỡ khỏi bài / bình luận / kho mọi người, bỏ URL khỏi `posts.attached_document_ids`; bản ghi vào thùng rác 30 ngày, khôi phục không tự gắn lại vào bài). Tên tài liệu ở thẻ trong bài / bình luận / danh sách đều mở trang này.

## An toàn

- `POST /documents` validate Zod, chỉ nhận URL nằm trong thư mục `documents/` trên R2 của hệ thống (chặn link ngoài / `javascript:`).
- `GET /documents/:id`: bản nháp và tài liệu riêng tư chỉ chủ sở hữu xem được; chủ xem không tăng lượt xem.
- GraphQL `documents`: bỏ email người đăng, chỉ trả tài liệu công khai đã đăng, lọc `courseCode` thật.
- N7AI (RAG) chỉ đọc tệp trên R2 của mình; bản nháp/riêng tư chỉ dùng cho chính chủ.

Test: `apps/api/test/documents-library.e2e-spec.ts` (đợt 1), `apps/api/test/document-library-personal.e2e-spec.ts` (đợt 2–4).
