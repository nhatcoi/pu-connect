-- ==========================================================
-- Migration: provider AI (base URL + API key, OpenAI-compatible) do admin quản lý (idempotent, chạy mỗi lần deploy)
-- Thứ tự priority = thứ tự thử: provider đầu là chính, các provider sau là dự phòng khi gateway lỗi
-- Bảng rỗng ⇒ API dùng AI_BASE_URL / AI_API_KEY / AI_FALLBACK_* trong env như cũ
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_providers (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(60) NOT NULL,                -- tên gợi nhớ (vd. Gateway chính)
    base_url TEXT NOT NULL,                   -- vd. https://gateway.example.com/v1
    api_key_enc TEXT NOT NULL,                -- AES-256-GCM (TokenCipher); không bao giờ trả ra client
    key_hint VARCHAR(8) NOT NULL DEFAULT '',  -- 4 ký tự cuối của key để admin nhận ra
    model_override VARCHAR(60),               -- NULL = dùng đúng tên model được yêu cầu; có giá trị = luôn gọi model này trên provider này
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    priority INT NOT NULL DEFAULT 0,          -- nhỏ thử trước
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_providers_order ON ai_providers (enabled, priority, created_at);
