-- Key admin cho MCP riêng (kind = 'admin', tiền tố pka_) + nhật ký mọi lời gọi bằng key
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS kind VARCHAR(8) NOT NULL DEFAULT 'user';
ALTER TABLE api_keys ADD COLUMN IF NOT EXISTS ip_allow TEXT[];   -- NULL = không giới hạn IP

CREATE TABLE IF NOT EXISTS api_key_logs (
    id BIGSERIAL PRIMARY KEY,
    key_id UUID NOT NULL REFERENCES api_keys(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    method VARCHAR(8) NOT NULL,
    path VARCHAR(300) NOT NULL,
    status INT NOT NULL,
    ip VARCHAR(64),
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_key ON api_key_logs (key_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_api_key_logs_recent ON api_key_logs (created_at DESC);
