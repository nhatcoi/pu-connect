-- ==========================================================
-- Migration: N7AI — nhật ký lượt chạy & quota (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §3.5
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_runs (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    bot_id UUID NOT NULL REFERENCES users(id),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    trigger VARCHAR(12) NOT NULL,           -- dm
    task VARCHAR(30) NOT NULL DEFAULT 'chat',
    source_ref JSONB,                       -- {type:'message', id}
    reply_ref JSONB,
    status VARCHAR(10) NOT NULL DEFAULT 'running', -- running | done | error | rejected
    model VARCHAR(60),
    input_tokens INT DEFAULT 0,
    output_tokens INT DEFAULT 0,
    error TEXT,
    latency_ms INT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    finished_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_ai_runs_quota ON ai_runs(requester_id, created_at DESC);
