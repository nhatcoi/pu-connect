-- ==========================================================
-- Migration: Hạn mức AI/ngày riêng từng người dùng (idempotent)
-- NULL = dùng mặc định chung (AI_DAILY_QUOTA)
-- ==========================================================

ALTER TABLE users ADD COLUMN IF NOT EXISTS ai_daily_quota INT CHECK (ai_daily_quota IS NULL OR ai_daily_quota >= 0);

UPDATE users SET ai_daily_quota = 1000 WHERE lower(username) = 'vnhatdev' AND ai_daily_quota IS NULL;
