-- API key cá nhân (PU Connect MCP + REST bằng Bearer)
-- Chỉ lưu SHA-256 của key; key gốc hiện đúng 1 lần lúc tạo.
CREATE TABLE IF NOT EXISTS api_keys (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(80) NOT NULL,
    key_prefix VARCHAR(16) NOT NULL,          -- vài ký tự đầu để nhận diện trong danh sách
    key_hash CHAR(64) NOT NULL UNIQUE,        -- sha256 hex
    scopes TEXT[] NOT NULL DEFAULT ARRAY['read'],
    last_used_at TIMESTAMPTZ,
    expires_at TIMESTAMPTZ,
    revoked_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_api_keys_user ON api_keys (user_id, created_at DESC);
