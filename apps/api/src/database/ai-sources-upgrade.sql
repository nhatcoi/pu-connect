-- ==========================================================
-- Migration: tài liệu của cuộc trò chuyện N7AI / thư viện (idempotent)
-- Thiết kế: docs/core/24-n7ai-sources.md
-- thread_id NULL = tài liệu trong thư viện riêng của người dùng
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_sources (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    thread_id UUID REFERENCES conversations(id) ON DELETE CASCADE,
    kind VARCHAR(10) NOT NULL CHECK (kind IN ('file', 'text', 'url', 'youtube')),
    title VARCHAR(200) NOT NULL,
    url TEXT,                       -- file: URL R2 · url / youtube: liên kết gốc
    file_key TEXT,                  -- file: key R2 (chat/<user>/…)
    mime VARCHAR(120),
    size INTEGER,
    content TEXT,                   -- text / url / youtube: văn bản đã dán hoặc đã trích
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_sources_thread ON ai_sources (thread_id, created_at DESC) WHERE thread_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_sources_library ON ai_sources (user_id, created_at DESC) WHERE thread_id IS NULL;
