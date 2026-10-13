-- ==========================================================
-- Migration: Trạng thái hoạt động (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §15
-- ==========================================================

-- Lần cuối còn kết nối realtime (ghi khi ngắt kết nối cuối cùng + hết thời gian chờ)
ALTER TABLE users ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
