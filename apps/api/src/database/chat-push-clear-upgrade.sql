-- ==========================================================
-- Migration: Đóng thông báo OS khi đã đọc ở thiết bị khác (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §13
-- ==========================================================

-- Lúc gần nhất đã hiện thông báo đẩy cho hội thoại này; đọc ⇒ NULL + gửi push "đóng"
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS push_shown_at TIMESTAMPTZ;
