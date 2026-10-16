-- ==========================================================
-- Migration: Tùy chọn tính năng của người dùng (idempotent)
-- Khác privacy_settings: chỉ ảnh hưởng trải nghiệm của chính mình (Feature plugs)
-- ==========================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS preferences JSONB NOT NULL DEFAULT '{}'::jsonb;
