-- ==========================================================
-- Kiểm duyệt bình luận: bình luận bị gắn cờ / giữ lại chờ admin (hidden_at) — idempotent
-- hidden_at != NULL ⇒ chỉ tác giả thấy (mờ, "đang chờ duyệt"); không tính vào comments_count, chưa báo ai
-- hidden_reason: 'auto-moderation:<lý do>' (chờ duyệt) | 'moderation-rejected' (admin xác nhận vi phạm)
-- ==========================================================

ALTER TABLE comments ADD COLUMN IF NOT EXISTS hidden_at TIMESTAMPTZ;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS hidden_reason TEXT;
CREATE INDEX IF NOT EXISTS idx_comments_hidden ON comments (hidden_at) WHERE hidden_at IS NOT NULL;
