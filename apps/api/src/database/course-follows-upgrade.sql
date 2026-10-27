-- ==========================================================
-- Migration: Theo dõi môn học — mục "Đang theo dõi" ở trang Môn học & Tài liệu (idempotent)
-- ==========================================================

CREATE TABLE IF NOT EXISTS course_follows (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (user_id, course_id)
);
CREATE INDEX IF NOT EXISTS idx_course_follows_user ON course_follows(user_id, created_at DESC);
