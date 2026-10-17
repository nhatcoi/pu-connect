-- ==========================================================
-- Migration: Tóm tắt bài viết bằng N7AI (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §17
-- ==========================================================

-- 1 bản tóm tắt / bài; content_hash khác ⇒ bài đã sửa ⇒ tóm tắt lại
CREATE TABLE IF NOT EXISTS post_summaries (
    post_id UUID PRIMARY KEY REFERENCES posts(id) ON DELETE CASCADE,
    content_hash CHAR(64) NOT NULL,
    summary TEXT NOT NULL,
    model VARCHAR(60),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
