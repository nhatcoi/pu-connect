-- ==========================================================
-- Công cụ học tập (/tools): bộ Flashcard / Quiz (tạo tay, N7AI tạo, tự lưu từ chat)
-- Study tools: sets + items; flashcard items carry spaced-repetition state
-- Idempotent
-- ==========================================================

CREATE TABLE IF NOT EXISTS study_sets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(20) NOT NULL CHECK (kind IN ('flashcards', 'quiz')),
    title VARCHAR(120) NOT NULL,
    description VARCHAR(300),
    source VARCHAR(10) NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'n7ai')),
    source_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL, -- tin N7AI đã sinh bộ này
    item_count INT NOT NULL DEFAULT 0,
    attempts INT NOT NULL DEFAULT 0,          -- quiz: số lần làm / flashcard: số lượt ôn
    best_score SMALLINT,                      -- quiz: % đúng cao nhất
    last_studied_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Danh sách theo loại, mới cập nhật trước
CREATE INDEX IF NOT EXISTS idx_study_sets_owner_kind ON study_sets (owner_id, kind, updated_at DESC);
-- 1 tin N7AI ⇒ tối đa 1 bộ (tự lưu không trùng khi xử lý lại)
CREATE UNIQUE INDEX IF NOT EXISTS uq_study_sets_source_message ON study_sets (source_message_id) WHERE source_message_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS study_items (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    set_id UUID NOT NULL REFERENCES study_sets(id) ON DELETE CASCADE,
    position INT NOT NULL,
    content JSONB NOT NULL,                   -- flashcard {front, back} · quiz {q, options, answer, explain}
    -- Lịch ôn (flashcard, SM-2 rút gọn); due_at NULL = thẻ mới
    due_at TIMESTAMPTZ,
    interval_days REAL NOT NULL DEFAULT 0,
    ease REAL NOT NULL DEFAULT 2.5,
    reps INT NOT NULL DEFAULT 0,
    lapses INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_study_items_set ON study_items (set_id, position);
-- Đếm thẻ đến hạn
CREATE INDEX IF NOT EXISTS idx_study_items_due ON study_items (set_id, due_at);

-- Tùy chọn cấp bộ: mẫu flashcard (basic / vocab), ngôn ngữ phát âm — {"template": "vocab", "lang": "en-US"}
ALTER TABLE study_sets ADD COLUMN IF NOT EXISTS options JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Nhật ký học: 1 dòng / lượt chấm thẻ hoặc lần làm quiz ⇒ chuỗi ngày, lịch nhiệt (GET tools/stats)
-- Study activity log; set/item deleted ⇒ keep the row (streak history stays)
CREATE TABLE IF NOT EXISTS study_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    set_id UUID REFERENCES study_sets(id) ON DELETE SET NULL,
    item_id UUID REFERENCES study_items(id) ON DELETE SET NULL,
    event VARCHAR(10) NOT NULL CHECK (event IN ('review', 'attempt')),
    grade VARCHAR(5) CHECK (grade IN ('again', 'hard', 'good', 'easy')), -- review
    score SMALLINT,                                                      -- attempt: % đúng
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Thống kê theo người, mới trước
CREATE INDEX IF NOT EXISTS idx_study_events_user_time ON study_events (user_id, created_at DESC);
