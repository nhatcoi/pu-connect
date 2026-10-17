-- ==========================================================
-- Migration: Notification v1 (idempotent, chạy mỗi lần deploy)
-- Thiết kế: docs/core/05-notifications-and-realtime.md
-- Lưu ý: ALTER TYPE ... ADD VALUE không chạy được trong transaction ⇒ psql -f (autocommit)
-- ==========================================================

-- 1. Loại thông báo mới
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'user_follow';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'account_verified';
ALTER TYPE notification_type_enum ADD VALUE IF NOT EXISTS 'ai_reply'; -- dành cho N7AI (P3)

-- 2. Gộp thông báo (aggregation) + điều hướng
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS group_key VARCHAR(120);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actor_ids UUID[] NOT NULL DEFAULT '{}';
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS actors_count INT NOT NULL DEFAULT 1;
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS link VARCHAR(300);
ALTER TABLE notifications ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ;
UPDATE notifications SET updated_at = created_at WHERE updated_at IS NULL;
ALTER TABLE notifications ALTER COLUMN updated_at SET DEFAULT NOW();
UPDATE notifications SET actor_ids = ARRAY[actor_id]
WHERE actor_id IS NOT NULL AND cardinality(actor_ids) = 0;

-- Mỗi nhóm chỉ có 1 thông báo CHƯA ĐỌC ⇒ upsert nguyên tử (ON CONFLICT)
CREATE UNIQUE INDEX IF NOT EXISTS uq_notifications_group_unread
  ON notifications(recipient_id, group_key)
  WHERE is_read = FALSE AND group_key IS NOT NULL;

-- Danh sách sắp theo hoạt động mới nhất (cursor pagination)
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_updated
  ON notifications(recipient_id, updated_at DESC, id DESC);

-- 3. Tùy chọn nhận thông báo theo loại: {"post_like": false, ...} — thiếu key ⇒ bật
ALTER TABLE users ADD COLUMN IF NOT EXISTS notification_settings JSONB NOT NULL DEFAULT '{}';
