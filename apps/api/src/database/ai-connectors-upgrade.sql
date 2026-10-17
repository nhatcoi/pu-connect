-- ==========================================================
-- Migration: Connector ngoài cho N7AI (Google Drive) (idempotent)
-- Thiết kế: docs/core/09-chat-mention-ai-threads-skills.md §7
-- ==========================================================

-- Refresh token mã hóa AES-256-GCM ở tầng ứng dụng (không lưu access token)
CREATE TABLE IF NOT EXISTS user_connectors (
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    provider VARCHAR(30) NOT NULL,              -- google_drive
    refresh_token_enc TEXT NOT NULL,
    account_email VARCHAR(255),
    scope TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (user_id, provider)
);
