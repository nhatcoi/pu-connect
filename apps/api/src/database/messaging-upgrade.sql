-- ==========================================================
-- Migration: Messaging & AI — P0 nền tảng (idempotent, chạy mỗi lần deploy)
-- Thiết kế: docs/core/06-messaging-and-ai.md
-- ==========================================================

-- 1. Session store (connect-pg-simple): đăng nhập không mất khi restart API
CREATE TABLE IF NOT EXISTS user_sessions (
    sid VARCHAR NOT NULL PRIMARY KEY,
    sess JSON NOT NULL,
    expire TIMESTAMP(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_user_sessions_expire ON user_sessions(expire);

-- 2. Loại tài khoản: human | bot | system (bot/system không thể đăng nhập)
ALTER TABLE users ADD COLUMN IF NOT EXISTS account_type VARCHAR(10) NOT NULL DEFAULT 'human';

-- 3. Tài khoản N7AI (@n7ai): không mật khẩu, không google_id
INSERT INTO users (email, username, display_name, account_type, role, reputation_points,
                   is_onboarded, is_verified, verified_at, email_verified, email_verified_at, avatar_url, bio)
VALUES ('n7ai@system.local', 'n7ai', 'N7AI', 'bot', 'student', 0,
        TRUE, TRUE, NOW(), TRUE, NOW(),
        'https://api.dicebear.com/7.x/bottts-neutral/svg?seed=puai&backgroundColor=1e3a8a',
        'Trợ lý học tập của PU Connector. Tag @n7ai để hỏi.')
ON CONFLICT DO NOTHING;

-- Đảm bảo @n7ai luôn là bot (kể cả khi username đã tồn tại từ trước)
UPDATE users SET account_type = 'bot', password_hash = NULL, google_id = NULL
WHERE username = 'n7ai' AND email = 'n7ai@system.local' AND account_type <> 'bot';

-- 4. Mention dùng chung cho post / comment / message
CREATE TABLE IF NOT EXISTS mentions (
    source_type VARCHAR(12) NOT NULL,           -- post | comment | message
    source_id TEXT NOT NULL,
    mentioned_user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    author_id UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (source_type, source_id, mentioned_user_id)
);
CREATE INDEX IF NOT EXISTS idx_mentions_user ON mentions(mentioned_user_id, created_at DESC);
