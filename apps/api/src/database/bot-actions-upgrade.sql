-- Bot actions: hành động admin giao cho bot (đăng/bình luận/thả tim) chạy ngay hoặc hẹn giờ, hồ sơ persona lưu DB.
-- Idempotent — chạy lại an toàn.

-- Persona của bot (tạo/sửa từ Admin → Bot; daemon đọc từ DB thay vì personas.json)
ALTER TABLE bot_profiles ADD COLUMN IF NOT EXISTS tone TEXT;

-- Lệnh có giờ chạy: scheduled_at <= NOW() mới được daemon nhận
ALTER TABLE bot_commands ADD COLUMN IF NOT EXISTS scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW();
DELETE FROM bot_commands WHERE type NOT IN ('post', 'comment', 'like');
ALTER TABLE bot_commands DROP CONSTRAINT IF EXISTS bot_commands_type_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_type_check CHECK (type IN ('post', 'comment', 'like'));
ALTER TABLE bot_commands DROP CONSTRAINT IF EXISTS bot_commands_status_check;
ALTER TABLE bot_commands ADD CONSTRAINT bot_commands_status_check CHECK (status IN ('pending', 'running', 'done', 'failed', 'cancelled'));
DROP INDEX IF EXISTS idx_bot_commands_pending;
CREATE INDEX IF NOT EXISTS idx_bot_commands_due ON bot_commands (scheduled_at, id) WHERE status = 'pending';

-- Bài crawl đã giao cho bot đăng (chờ giờ hẹn): FeedPoster không lấy
ALTER TABLE bot_feed_items DROP CONSTRAINT IF EXISTS bot_feed_items_status_check;
ALTER TABLE bot_feed_items ADD CONSTRAINT bot_feed_items_status_check CHECK (status IN ('new', 'review', 'approved', 'rejected', 'scheduled', 'posted', 'skipped'));
