-- ==========================================================
-- Quản lý bài đăng: lưu trữ bài (archived_at) — idempotent
-- Bài lưu trữ biến khỏi bảng tin / tìm kiếm / hồ sơ, chỉ tác giả thấy trong mục Lưu trữ; bỏ lưu trữ ⇒ hiện lại
-- ==========================================================

ALTER TABLE posts ADD COLUMN IF NOT EXISTS archived_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_posts_author_archived ON posts (author_id, archived_at DESC) WHERE archived_at IS NOT NULL;
