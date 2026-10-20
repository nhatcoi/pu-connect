-- Ẩn danh: bài viết / bình luận hiển thị "Ẩn danh" với người khác; vẫn lưu author_id để kiểm duyệt
-- Anonymous posts & comments: author stays stored for moderation, masked in every public response
ALTER TABLE posts ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE comments ADD COLUMN IF NOT EXISTS is_anonymous BOOLEAN NOT NULL DEFAULT FALSE;

-- Hạn mức mỗi ngày: đếm bài / bình luận ẩn danh gần đây của một người
CREATE INDEX IF NOT EXISTS idx_posts_anon_author_recent ON posts (author_id, created_at DESC) WHERE is_anonymous;
CREATE INDEX IF NOT EXISTS idx_comments_anon_author_recent ON comments (author_id, created_at DESC) WHERE is_anonymous;
