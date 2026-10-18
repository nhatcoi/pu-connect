# 15 — Công cụ học tập (`/tools`)

Mục **Công cụ** trên thanh điều hướng gom các công cụ hỗ trợ học tập. Đợt đầu: **Flashcard** (ôn lặp lại ngắt quãng) và **Quiz** (trắc nghiệm, lưu điểm cao nhất). Mỗi bộ tạo được 3 cách: tự soạn, dán danh sách, hoặc để N7AI soạn nháp. Bộ flashcard / quiz N7AI tạo trong chat **tự lưu** vào đây.

## Dữ liệu

Migration `study-tools-upgrade.sql` (chạy sau `comment-reactions-upgrade.sql`).

| Bảng | Vai trò |
| --- | --- |
| `study_sets` | 1 bộ: `kind` (`flashcards` / `quiz`), `title`, `description`, `source` (`manual` / `n7ai`), `source_message_id` (tin N7AI sinh ra bộ, unique ⇒ không lưu trùng), `item_count`, `attempts`, `best_score`, `last_studied_at` |
| `study_items` | 1 mục: `position`, `content` JSONB (`{front, back}` hoặc `{q, options, answer, explain}`), lịch ôn `due_at` (NULL = thẻ mới), `interval_days`, `ease`, `reps`, `lapses` |

Giới hạn: 200 mục / bộ, 300 bộ / người.

## API (`StudyToolsModule`, cần đăng nhập, chỉ chủ bộ)

| Endpoint | Việc |
| --- | --- |
| `GET tools/overview` | số bộ / mục / thẻ đến hạn theo loại + 6 bộ gần đây |
| `GET tools/sets?kind=&q=` | danh sách (kèm `dueCount`, `bestScore`) |
| `POST tools/sets` · `PATCH tools/sets/:id` · `DELETE tools/sets/:id` | tạo / sửa / xóa. Sửa: mục giữ `id` ⇒ giữ lịch ôn, mục bị bỏ ⇒ xóa, không đổi được `kind` |
| `POST tools/sets/draft` | N7AI soạn nháp từ chủ đề / nội dung dán vào (chưa lưu, tốn 1 lượt, `ai_runs.trigger = 'tool'`) |
| `POST tools/sets/:id/review` | chấm 1 thẻ `again / hard / good / easy` ⇒ lịch ôn kế tiếp |
| `POST tools/sets/:id/attempts` | ghi kết quả quiz ⇒ cập nhật `best_score` |

Nội dung mục được kiểm theo loại bộ (`StudySetBodySchema` trong `dto/study-tools.dto.ts`).

### Lịch ôn (SM-2 rút gọn, `srs.ts`)

- **Quên** ⇒ gặp lại sau 10 phút, `ease − 0.2`, đếm lại từ đầu.
- Lần đầu: Khó 12 giờ · Nhớ 1 ngày · Dễ 4 ngày. Lần 2: 1,5 · 3 · 7 ngày.
- Sau đó: `interval × ease` (Khó × 1,2, Dễ × ease × 1,3), `ease` tối thiểu 1,3, tối đa 365 ngày.

## Tự lưu từ chat

Sau khi N7AI trả lời trong thread riêng, `N7AiService` gọi `StudyToolsService.saveFromReply`. Hàm này đọc khối ```` ```flashcards ```` / ```` ```quiz ```` đầu tiên (cùng định dạng web hiển thị), bỏ mục hỏng, lưu với `source = 'n7ai'`, rồi ghi `meta.studySet = {id, kind, title}` vào tin. Web hiện nhãn **"Đã lưu vào Công cụ › Flashcard · Ôn ngay"** dưới câu trả lời. Nhóm chat không tự lưu. Lỗi khi lưu không chặn câu trả lời.

Prompt chế độ Flashcard: chỉ nêu chủ đề ⇒ 8–12 thẻ. Người dùng đưa danh sách cụ thể hoặc số lượng ⇒ tạo đủ (tối đa 60).

## Web

| Route | Nội dung |
| --- | --- |
| `/tools` | thẻ từng công cụ (số bộ, mục, thẻ cần ôn) + bộ gần đây |
| `/tools/[kind]` | danh sách bộ, tìm theo tên, nút **Tạo bộ** (Tạo bằng N7AI / Tự soạn) |
| `/tools/[kind]/[id]` | ôn flashcard (`FlashcardReview`: Space lật, phím 1–4 chấm, ← → thẻ trước / bỏ qua thẻ) hoặc làm quiz (`QuizRunner`: ← → chuyển câu, bỏ qua được, câu bỏ trống tính sai), xem toàn bộ mục, sửa / xóa |

`components/tools/tool-catalog.ts` khai báo các loại công cụ. Thêm công cụ mới = thêm 1 mục ở đây, thêm `kind` vào schema / CHECK, và viết trình học tương ứng. Trình soạn `StudySetEditor` hỗ trợ tự nhập, dán danh sách (`mặt trước - mặt sau` mỗi dòng) và N7AI soạn nháp (thêm vào cuối bộ, xem lại rồi lưu).

## Hướng mở rộng

Đếm ngược Pomodoro + thống kê giờ học, tính GPA / điểm cần đạt, lịch thi & deadline (kết nối Google Calendar), sổ công thức, sơ đồ tư duy do N7AI tạo, đề thi thử bấm giờ từ tài liệu học phần.
