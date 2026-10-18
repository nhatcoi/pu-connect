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

## N7AI đọc tiến độ học ("Học tập của tôi", 2026-10-18)

Trước đây N7AI không trả lời được "mình đã học từ vựng gì rồi", vì bộ thẻ nằm ở `/tools` còn N7AI chỉ thấy thread hiện tại và bộ nhớ dài hạn. Có 2 đường đọc:

**1. Connector `my_study` (tool, model tự gọi khi cần).** `StudyAgentToolsService.open(userId)` trả `AgentToolSession` (`ai/agent-tools.ts`), chạy chung vòng tool với Google MCP trong `McpAgentService`. Chỉ thread N7AI riêng; nhóm chat không có. Chỉ đọc, lọc `owner_id = người hỏi`. Tham số model đưa vào được kiểm (uuid, enum, giới hạn), kết quả ≤ 12k ký tự.

| Tool | Việc |
| --- | --- |
| `my_study__list_study_sets(kind?, query?, limit ≤ 20)` | bộ + tiến độ: thẻ đã thuộc / mới / đến hạn / hay quên; quiz: số lần làm, điểm cao nhất |
| `my_study__get_study_items(set_id?, query?, status?, limit ≤ 80)` | mục kèm trạng thái ôn; `status` = `due` · `weak` · `new` · `learning` · `learned` · `all` |

Trạng thái thẻ (`study-progress.sql.ts`, dùng chung với ref):
- `new`: chưa ôn.
- `learned`: nhớ ≥ 2 lần, khoảng ôn ≥ 3 ngày.
- `learning`: còn lại.
- `weak`: từng "Quên" hoặc `ease < 2.3`.

Tiến trình hiện "Đọc thẻ đã học · từ hay quên" (icon `Layers`).

**Bật sẵn:** `my_study` có trong mặc định `ai_settings` (`DEFAULTS` và DEFAULT cột). Migration `ai-study-connector-upgrade.sql` thêm vào người đã có cài đặt **đúng 1 lần**: mốc là DEFAULT của cột, nên chạy lại mỗi lần deploy không bật lại cho người đã tự tắt. Tắt ở menu `+` › Connectors hoặc Cài đặt N7AI.

**2. Gắn `@bộ học tập` (ref `study_set`).** Gõ `@` trong thread N7AI ⇒ mục "Bộ học tập" (bộ mới học trước, phụ đề "Flashcard · 29 mục"). Ghim toàn bộ bộ vào lượt hỏi gồm tiến độ chung và từng mục: flashcard "mặt trước — mặt sau [trạng thái, hay quên]", quiz "Hỏi … · Đáp án …". `ChatRef.code` = loại bộ ⇒ chip dẫn tới `/tools/[kind]/[id]`. Giống ref `thread`, đây là dữ liệu riêng: chỉ chủ bộ, chỉ khi hỏi N7AI (`ChatRefsService.resolve(…, allowPrivate)`).

## Web

| Route | Nội dung |
| --- | --- |
| `/tools` | thẻ từng công cụ (số bộ, mục, thẻ cần ôn) + bộ gần đây |
| `/tools/[kind]` | danh sách bộ, tìm theo tên, nút **Tạo bộ** (Tạo bằng N7AI / Tự soạn) |
| `/tools/[kind]/[id]` | ôn flashcard (`FlashcardReview`: Space lật, phím 1–4 chấm, ← → thẻ trước / bỏ qua thẻ) hoặc làm quiz (`QuizRunner`: ← → chuyển câu, bỏ qua được, câu bỏ trống tính sai), xem toàn bộ mục, sửa / xóa |

`components/tools/tool-catalog.ts` khai báo các loại công cụ. Thêm công cụ mới = thêm 1 mục ở đây, thêm `kind` vào schema / CHECK, và viết trình học tương ứng. Trình soạn `StudySetEditor` hỗ trợ tự nhập, dán danh sách (`mặt trước - mặt sau` mỗi dòng) và N7AI soạn nháp (thêm vào cuối bộ, xem lại rồi lưu).

## Hướng mở rộng

Đếm ngược Pomodoro + thống kê giờ học, tính GPA / điểm cần đạt, lịch thi & deadline (kết nối Google Calendar), sổ công thức, sơ đồ tư duy do N7AI tạo, đề thi thử bấm giờ từ tài liệu học phần.
