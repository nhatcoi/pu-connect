# 15 — Công cụ học tập (`/tools`)

Mục **Công cụ** trên thanh điều hướng gom các công cụ hỗ trợ học tập. Đợt đầu: **Flashcard** (ôn lặp lại ngắt quãng) và **Quiz** (trắc nghiệm, lưu điểm cao nhất). Mỗi bộ tạo được 3 cách: tự soạn, dán danh sách, hoặc để N7AI soạn nháp. Bộ flashcard / quiz N7AI tạo trong chat **tự lưu** vào đây.

## Dữ liệu

Migration `study-tools-upgrade.sql` (chạy sau `comment-reactions-upgrade.sql`).

| Bảng | Vai trò |
| --- | --- |
| `study_sets` | 1 bộ: `kind` (`flashcards` / `quiz`), `title`, `description`, `options` JSONB (`{template: basic|vocab, lang}`), `source` (`manual` / `n7ai`), `source_message_id` (tin N7AI sinh ra bộ, unique ⇒ không lưu trùng), `item_count`, `attempts`, `best_score`, `last_studied_at` |
| `study_items` | 1 mục: `position`, `content` JSONB (`{front, back, phonetic?, example?}` hoặc `{q, options, answer, explain}`), lịch ôn `due_at` (NULL = thẻ mới), `interval_days`, `ease`, `reps`, `lapses` |

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

Nội dung mục được kiểm theo loại bộ: `StudySetBodySchema` (`dto/study-tools.dto.ts`) lấy schema mục + tùy chọn từ registry. Tùy chọn hỏng (vd. `lang` lạ) bị bỏ, không từ chối bộ.

## Registry loại bộ (`study-tools/kinds/`)

Mỗi loại công cụ dạng "bộ nhiều mục" khai báo 1 lần trong `kinds/<kind>.kind.ts` (`StudyKindDef`):

| Trường | Ý nghĩa |
| --- | --- |
| `item` | zod schema 1 mục; `.describe()` từng trường = hướng dẫn cho N7AI |
| `options` | zod schema tùy chọn cấp bộ (`.catch` ⇒ trường hỏng bị bỏ) |
| `fence`, `itemsKey` | khối ```` ```flashcards ```` / ```` ```quiz ```` trong tin chat: `{title, ...options, cards|questions}` |
| `ai.tool`, `ai.description`, `ai.instructions` | tên tool, khi nào gọi, quy tắc nội dung |

`kinds/study-kinds.registry.ts` gom các loại và sinh mọi thứ từ đó: JSON Schema tham số tool (`zod-to-json-schema`), `validateAiSet` (kiểm từng mục: lưu phần hợp lệ, báo mục bị bỏ; khung hỏng ⇒ trả `issues` để model sửa và gọi lại), `studyFence` (khối chuẩn cho chat). Trình soạn nháp (`tools/sets/draft`) dùng cùng JSON Schema + quy tắc ⇒ chat và nút "Tạo bằng N7AI" không lệch nhau.

Thêm loại mới: file `kinds/<kind>.kind.ts`, 1 dòng trong registry, `kind` trong `STUDY_TOOL_KINDS` + CHECK SQL, trình học ở web.

### Lịch ôn (SM-2 rút gọn, `srs.ts`)

- **Quên** ⇒ gặp lại sau 10 phút, `ease − 0.2`, đếm lại từ đầu.
- Lần đầu: Khó 12 giờ · Nhớ 1 ngày · Dễ 4 ngày. Lần 2: 1,5 · 3 · 7 ngày.
- Sau đó: `interval × ease` (Khó × 1,2, Dễ × ease × 1,3), `ease` tối thiểu 1,3, tối đa 365 ngày.

## N7AI tạo bộ trong chat (tool)

Thread N7AI riêng luôn có các tool `my_study__create_flashcards`, `my_study__create_quiz` (`StudyCreateToolsService`, 1 `AgentToolSession` dựng từ registry; nhóm chat không có). Chế độ Flashcard / Quiz chỉ dặn model gọi đúng tool; ở chế độ Hỏi đáp model tự quyết.

1. Model gọi tool với `{title, description?, options, cards|questions}`. Bước hiện trong chat: "Tạo bộ Flashcard · <tên>".
2. Server kiểm bằng `validateAiSet`, lưu ngay (`source = 'n7ai'`, `source_message_id` = tin trả lời, 1 tin ⇒ 1 bộ), trả `{saved, items, skipped?}` để model viết 1–2 câu kết.
3. Xong lượt: `N7AiService` chèn khối ```` ```flashcards ```` chuẩn (từ dữ liệu đã kiểm) vào cuối tin + `meta.studySet`. Web dựng bộ thẻ tương tác, Thư viện › Học liệu và thread chia sẻ dùng lại khối này.
4. Dự phòng: model không gọi tool mà tự viết khối ⇒ `saveFromReply` đọc khối đầu tiên như trước.

Tham số 1 lượt gọi tool tối đa 48 000 ký tự (`MAX_CALL_ARGS`, `mcp-agent.service.ts`) để chở đủ 60 thẻ kèm phiên âm, ví dụ.

Prompt nội dung (8–12 thẻ khi chỉ nêu chủ đề, giữ đủ danh sách người dùng đưa, tối đa 60; từ vựng ngoại ngữ ⇒ mẫu `vocab` + `lang` + phiên âm + ví dụ) nằm ở `ai.instructions` của từng loại.

## Flashcard: mẫu, phát âm, cách ôn

- **Mẫu bộ** (`options.template`): *Cơ bản* (mặt trước / sau; nút "+ Chi tiết" mở ô phiên âm, ví dụ) hoặc *Từ vựng* (ô phiên âm, ví dụ luôn hiện, có phát âm). Mẫu chỉ đổi giao diện, dữ liệu thẻ chung 1 kiểu.
- **Phát âm**: Web Speech API trên trình duyệt (`components/tools/card-speech.ts`, không tốn lượt / server). Bật khi bộ là *Từ vựng* hoặc đã chọn `options.lang`; không chọn ngôn ngữ ⇒ đoán theo chữ (Nhật, Hàn, Trung, Nga, tiếng Việt có dấu, còn lại tiếng Anh). Bỏ Markdown, LaTeX, loại từ "(n)" trước khi đọc. Nút loa trên mặt từ, phím `P`, tùy chọn "Tự đọc từ".
- **Cách ôn** (tùy chọn của người xem, lưu `localStorage`, không gắn vào bộ): *Lật thẻ* · *Đảo mặt* (nhìn nghĩa nhớ từ) · *Gõ đáp án* (so khớp bỏ dấu, hoa thường, loại từ; mặt trước "a / b" gõ 1 trong 2 cũng đúng; đúng ⇒ gợi ý *Nhớ*, sai ⇒ *Quên*, Enter chấm theo gợi ý). Ví dụ chứa từ cần nhớ ⇒ ở 2 cách sau chỉ hiện sau khi lật.
- **Dán danh sách**: `từ - nghĩa` như cũ, hoặc cột `|`: `từ | nghĩa | ví dụ`, `từ | /phiên âm/ | nghĩa | ví dụ`.

**3. Bộ nhớ tự ghi tiến độ.** Sau mỗi lần ôn / làm quiz, `StudyProgressMemoryService` ghi đè 1 mục bộ nhớ N7AI cho bộ đó (chi tiết: [`core/16` §6](./16-n7ai-agent-tools.md)).

## Web

| Route | Nội dung |
| --- | --- |
| `/tools` | thẻ từng công cụ (số bộ, mục, thẻ cần ôn) + bộ gần đây |
| `/tools/[kind]` | danh sách bộ, tìm theo tên, nút **Tạo bộ** (Tạo bằng N7AI / Tự soạn) |
| `/tools/[kind]/[id]` | ôn flashcard (`FlashcardReview`: 3 cách ôn, Space lật, phím 1–4 chấm, ← → thẻ trước / bỏ qua thẻ, P phát âm) hoặc làm quiz (`QuizRunner`: ← → chuyển câu, bỏ qua được, câu bỏ trống tính sai), xem toàn bộ mục, sửa / xóa |

`components/tools/tool-catalog.ts` khai báo các loại công cụ. Thêm công cụ mới = thêm 1 mục ở đây, thêm `kind` vào schema / CHECK, và viết trình học tương ứng. Trình soạn `StudySetEditor` hỗ trợ tự nhập, dán danh sách (`mặt trước - mặt sau` mỗi dòng) và N7AI soạn nháp (thêm vào cuối bộ, xem lại rồi lưu).

## Hướng mở rộng

Flashcard đợt 2: ảnh minh họa, điền chỗ trống (cloze), thống kê chuỗi ngày ôn, học kiểu trắc nghiệm. Đếm ngược Pomodoro + thống kê giờ học, tính GPA / điểm cần đạt, lịch thi & deadline (kết nối Google Calendar), sổ công thức, sơ đồ tư duy do N7AI tạo, đề thi thử bấm giờ từ tài liệu học phần.
