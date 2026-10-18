// Biểu thức SQL tiến độ ôn dùng chung (alias: s = study_sets, i = study_items)
// Shared SQL for spaced-repetition progress: tool "Học tập của tôi" and @study_set refs read the same definitions

// Thẻ flashcard: new = chưa ôn · learned = nhớ ≥ 2 lần liên tiếp, khoảng ôn ≥ 3 ngày · learning = còn lại; quiz ⇒ NULL
export const CARD_STATUS_SQL = `CASE WHEN s.kind <> 'flashcards' THEN NULL
  WHEN i.due_at IS NULL THEN 'new'
  WHEN i.reps >= 2 AND i.interval_days >= 3 THEN 'learned'
  ELSE 'learning' END`

// Hay quên: đã từng chọn "Quên" hoặc độ dễ tụt dưới mặc định
export const WEAK_CARD_SQL = `(s.kind = 'flashcards' AND (i.lapses > 0 OR i.ease < 2.3))`

// Thẻ đến hạn ôn (đã ôn ít nhất 1 lần)
export const DUE_CARD_SQL = `(s.kind = 'flashcards' AND i.due_at <= NOW())`

// 1 dòng / mục cho ngữ cảnh N7AI: flashcard "mặt trước — mặt sau [trạng thái]" · quiz "Hỏi … · Đáp án …"
export const ITEM_LINE_SQL = `CASE WHEN s.kind = 'flashcards'
  THEN concat(i.content->>'front', ' — ', i.content->>'back', ' [', ${CARD_STATUS_SQL}, CASE WHEN ${WEAK_CARD_SQL} THEN ', hay quên' ELSE '' END, ']')
  ELSE concat('Hỏi: ', i.content->>'q', ' · Đáp án: ', i.content->'options'->>((i.content->>'answer')::int)) END`
