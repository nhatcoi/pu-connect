-- ==========================================================
-- Migration: Sửa bình luận (idempotent)
-- edited_at NULL = chưa sửa; tách khỏi updated_at (mặc định NOW() khi tạo)
-- ==========================================================

ALTER TABLE comments ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
