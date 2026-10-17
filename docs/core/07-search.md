# 07 · Tìm kiếm (Search) — thiết kế & quy tắc nghiệp vụ

> Trạng thái: **đã triển khai** (2026-10-04). Mã: `apps/api/src/modules/search/` · Migration: `apps/api/src/database/search-upgrade.sql`.
> Nền cho bước sau: "bài liên quan", semantic search, N7AI (xem [06-messaging-and-ai](./06-messaging-and-ai.md)).

## 1. Mục tiêu

Người dùng gõ tiếng Việt **có dấu, không dấu, viết hoa/thường, gõ dở chữ hoặc gõ sai nhẹ** đều tìm được học phần, tài liệu, bài viết, người dùng, nhóm đồ án — và kết quả liên quan nhất nằm trên cùng.

Trước đây: `ILIKE '%q%'` ⇒ không dùng được chỉ mục, "tai lieu" không ra "tài liệu", không xếp hạng theo độ liên quan.

## 2. Kiến trúc (không thêm hạ tầng)

```
GET /api/search?q=&type=&faculty=&limit=&offset=
   └─ parseQuery(q)              bỏ dấu, tách từ, lọc từ nối, tạo tsquery tiền tố  (search-query.ts)
   └─ mỗi loại (song song):
        Pha 1  full-text  : search_tsv @@ to_tsquery('simple', 'tai:* & lieu:*')   (chỉ mục GIN)
        Pha 2  gõ sai     : word_similarity (trigram) — chỉ khi pha 1 thiếu kết quả   (chỉ mục GIN trigram)
   └─ xếp hạng = điểm chữ + khớp tên + độ phổ biến + độ mới
```

- **Postgres thuần**: extension `unaccent` + `pg_trgm`, config `simple` (không stemmer vì tiếng Việt đơn lập). Không Elasticsearch/Meilisearch.
- Cột `search_tsv` (**generated, STORED**) trên `posts`, `documents`, `courses`, `users`, `study_groups` — tự cập nhật khi sửa dữ liệu, không cần job đồng bộ.
- `immutable_unaccent()` bọc `unaccent` thành IMMUTABLE (bắt buộc cho cột generated/index). `unaccent` xử lý đủ `đ/Đ` và dấu thanh.
- Trọng số văn bản: **A** tiêu đề/mã/tên · **B** mô tả/nội dung · **C** tag/kỹ năng/sở thích.

| Loại | A | B | C |
|---|---|---|---|
| posts | title | content (cắt 100k ký tự) | tags |
| documents | title | description | tags |
| courses | code + name | description | — |
| users | username + display_name + student_id | bio | skills + interests |
| study_groups | name + course_code | topic + course_name + description | tech_stack |

## 3. Quy tắc truy vấn (business rules)

| # | Quy tắc | Lý do |
|---|---|---|
| Q1 | Không phân biệt hoa/thường, có dấu/không dấu (`Giải tích` = `giai tich`) | Sinh viên hay gõ không dấu trên điện thoại |
| Q2 | **Khớp tiền tố** từng từ (`postgre` ra `PostgreSQL`) và **AND** các từ | Gợi ý khi đang gõ; kết quả chính xác hơn OR |
| Q3 | Bỏ từ nối `của, và, là, các, những, cho, với, có, không, một, trong, được, này, để, ở, thì, mà` (so trên dạng **có dấu**) | Câu tự nhiên "tài liệu của môn giải tích" vẫn ra kết quả. Phải lọc trước khi bỏ dấu: "đề thi" không được mất "đề" thành "de" |
| Q4 | Tối đa **8 từ**, **100 ký tự** | Chặn truy vấn nặng |
| Q5 | Tổng độ dài các từ **< 2 ký tự** ⇒ không có kết quả | 1 ký tự khớp gần như mọi thứ |
| Q6 | Chỉ gồm ký tự đặc biệt (`!!!`) ⇒ trả rỗng, không lỗi | |
| Q7 | `#tag` ⇒ chỉ khớp **chính xác tag** (không phân biệt hoa/thường) của bài viết, tài liệu, nhóm (tech stack), người dùng (kỹ năng/sở thích). Học phần không có tag ⇒ rỗng | |
| Q8 | `@username` ⇒ bỏ `@`, tìm như từ khóa; username khớp hệt/tiền tố được cộng điểm cao | |
| Q9 | Token chỉ gồm `[a-z0-9]` sau khi bỏ dấu ⇒ **không thể tiêm cú pháp tsquery/SQL** | Bảo mật (đã thử `x'); DROP TABLE users;--`) |
| Q10 | **Gõ sai** chỉ chạy khi pha 1 chưa đủ `limit` kết quả, chỉ ở **trang đầu** (`offset = 0`), từ khóa ≥ 3 ký tự; ngưỡng `word_similarity ≥ 0.35` | Giữ đường chính nhanh; gợi ý "có phải bạn muốn tìm" |

## 4. Quy tắc quyền xem & hiển thị

| # | Quy tắc |
|---|---|
| V1 | Bài viết và tài liệu: chỉ `visibility = 'public'`, **hoặc của chính người đang tìm** (kể cả riêng tư). Trước đây không lọc ⇒ nội dung riêng tư có thể lộ qua search |
| V2 | Người dùng: chỉ `status = 'active'` (tài khoản bị khóa **không** hiện) và `account_type IN ('human','bot')`. Bot `@n7ai` tìm được; tài khoản `system` thì không |
| V3 | Người dùng đặt **hồ sơ riêng tư** (`isPrivateProfile`) **vẫn tìm được theo tên** (giống Instagram): tìm được người, không lộ nội dung. Nếu sau này muốn ẩn hẳn ⇒ thêm cờ `searchable` riêng |
| V4 | Bộ lọc `faculty` giữ nguyên (khoa của tác giả/người dùng hoặc của học phần) |
| V5 | Cờ "đã thích / đã theo dõi" chỉ tính khi đăng nhập; khách vẫn tìm được nội dung công khai |

## 5. Xếp hạng

`điểm = điểm_chữ + khớp_tên + phổ_biến + mới`, hòa thì ưu tiên mới hơn.

- **điểm_chữ**: `ts_rank_cd(search_tsv, query, 32)` (A > B > C; chuẩn hóa về 0–1). Pha gõ sai dùng `word_similarity`.
- **khớp_tên** (theo tiêu đề/tên): hệt **+1.0** · bắt đầu bằng **+0.5** · chứa từ **+0.2**.

| Loại | Phổ biến | Mới | Khác |
|---|---|---|---|
| posts | `ln(1 + like + 2·comment) × 0.05` | `exp(-tuổi/90 ngày) × 0.15` | đã có lời giải **+0.05** |
| documents | `ln(1 + 2·tải + xem) × 0.05` | `exp(-tuổi/180 ngày) × 0.10` | |
| courses | `ln(1 + bài + tài liệu) × 0.05` | — | rating/5 × 0.05 |
| users | `ln(1 + uy tín) × 0.03` | — | username hệt **+1.0**, tiền tố **+0.4**; tích xanh **+0.1** |
| groups | — | `exp(-tuổi/60 ngày) × 0.10` | đang tuyển **+0.10** |

Nguyên tắc: **độ liên quan chữ luôn là yếu tố chính**; phổ biến/mới chỉ để phân hạng khi liên quan ngang nhau. Bỏ ưu tiên "ghim" của bài viết (ghim chỉ có ý nghĩa ở trang cá nhân). Trọng số là **giả định ban đầu** — chỉnh theo dữ liệu thật khi có `search_logs` + click.

## 6. Nhật ký truy vấn (`search_logs`) & riêng tư

- Ghi: từ khóa đã chuẩn hóa (bỏ dấu), loại tìm, số kết quả, thời điểm. **Không lưu người dùng/IP** ⇒ không thể truy ngược cá nhân.
- Chỉ ghi truy vấn **trang kết quả** (`limit > 5`, `offset = 0`). Gợi ý khi gõ (typeahead, `limit ≤ 5`) **không ghi** để tránh rác ("pyth", "pytho"…).
- Lưu **180 ngày**, tự xóa mỗi 24h.
- Mục đích kinh doanh: biết **người dùng tìm gì mà không có** ⇒ quyết định nội dung cần bổ sung (đề thi môn nào, học phần nào thiếu).

```sql
-- Từ khóa tìm nhiều mà KHÔNG có kết quả (30 ngày) — ưu tiên bổ sung nội dung
SELECT q_norm, count(*) AS luot_tim
FROM search_logs WHERE result_count = 0 AND created_at > NOW() - INTERVAL '30 days'
GROUP BY q_norm ORDER BY luot_tim DESC LIMIT 30;

-- Từ khóa phổ biến nhất
SELECT q_norm, count(*) FROM search_logs WHERE created_at > NOW() - INTERVAL '30 days'
GROUP BY q_norm ORDER BY 2 DESC LIMIT 30;
```

## 7. API

`GET /api/search?q=&type=all|courses|documents|posts|users|groups&faculty=&limit=&offset=` (công khai; có session thì có cờ cá nhân). `type=all` trả tối đa 4 học phần · 5 tài liệu · 6 bài · 4 người · 4 nhóm. `counts` là số kết quả **trả về**, không phải tổng khớp. Giao diện gợi ý (`AcademicSearchBar`) dùng chung endpoint này với `limit=3`.

## 8. Hiệu năng & mở rộng

Đo trên **50.000 bài** (dữ liệu giả, đã rollback): full-text 6.253 bản ghi khớp, lấy top 20 **≈ 20 ms** (Bitmap Index Scan GIN); pha gõ sai tìm đủ 20 kết quả **≈ 2 ms**.

Giới hạn đã biết:
- Pha gõ sai dùng toán tử `<%` (dùng được chỉ mục trigram) nhưng khi **ít hoặc không có** kết quả có thể quét toàn bảng — ổn tới vài trăm nghìn bản ghi; sau đó cân nhắc giới hạn thời gian (`statement_timeout`) hoặc chuyển Meilisearch/OpenSearch.
- Thêm cột `search_tsv` là `ALTER TABLE` ghi lại bảng (một lần). Đổi công thức tsvector sau này phải `DROP COLUMN` + thêm lại (migration idempotent hiện tại **không** tự cập nhật công thức đã tồn tại).
- Trigram bắt lỗi gõ sai **ký tự lẻ** của từ dài tốt hơn từ ngắn (vd `overfiting`→`Overfitting` được; `pyhton` có thể không).

## 9. Đã kiểm thử (local, dữ liệu tiếng Việt thật)

Có dấu / không dấu / HOA; từ nối; tiền tố (`postgre`); nhiều từ; `#tag`; `@username`; gõ sai (`overfiting`, `pgvecotr`, `lethimia`); chuỗi SQL injection; chỉ ký tự đặc biệt; 1 ký tự; tài liệu riêng tư (không lộ với khách); người dùng bị khóa / tài khoản system (ẩn); bot `@n7ai` (hiện); log ghi trang kết quả, không ghi typeahead.

## 10. Backlog (làm khi cần)

| Việc | Khi nào |
|---|---|
| Đồng nghĩa/viết tắt (`CNTT` = công nghệ thông tin, `CSDL` = cơ sở dữ liệu, `GT1`) — từ điển nhỏ trong DB | Khi `search_logs` cho thấy nhiều lượt tìm viết tắt không ra kết quả |
| Cờ `searchable` cho người dùng (ẩn hẳn khỏi tìm kiếm) | Khi có yêu cầu riêng tư từ người dùng |
| Đo **tỉ lệ bấm** vào kết quả để tinh chỉnh trọng số (cần sự kiện click) | Sau khi có ~vài trăm lượt tìm/ngày |
| Semantic search (embedding `pgvector`) + "bài liên quan" | Bước 3 của lộ trình discovery; cần chọn nhà cung cấp embedding |
| Tổng số kết quả thật (`total`) để phân trang chính xác và hiện "Xem thêm N kết quả" | Khi giao diện cần |
| Trang quản trị: xem từ khóa không có kết quả | Cùng lúc làm trang admin (xem [FEAT.md](../FEAT.md) backlog vai trò) |
