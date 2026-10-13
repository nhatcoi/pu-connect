-- ==========================================================
-- Migration: Cá nhân hóa — hành vi người dùng & hồ sơ quan tâm (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §19
-- ==========================================================

-- Sự kiện hành vi ngầm (xem bài, mở tài liệu, tìm kiếm, bấm gợi ý AI); chỉ ghi thêm, giữ 90 ngày
-- Implicit behaviour log (append-only, purged after 90 days)
CREATE TABLE IF NOT EXISTS user_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    type VARCHAR(30) NOT NULL,
    target_type VARCHAR(20),
    target_id UUID,
    meta JSONB,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_user_events_user ON user_events(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_events_created ON user_events(created_at);

-- Hồ sơ quan tâm suy ra (môn / tag / từ khóa) — tính lại định kỳ từ hành động + sự kiện
-- Derived interest profile, recomputed by the personalization worker
CREATE TABLE IF NOT EXISTS user_interests (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('course', 'tag', 'query')),
    key TEXT NOT NULL,
    label TEXT NOT NULL,
    score REAL NOT NULL,
    PRIMARY KEY (user_id, kind, key)
);
CREATE INDEX IF NOT EXISTS idx_user_interests_score ON user_interests(user_id, score DESC);

-- Thời điểm tính hồ sơ gần nhất (NULL = chưa tính / đã xóa)
ALTER TABLE users ADD COLUMN IF NOT EXISTS interests_updated_at TIMESTAMPTZ;
