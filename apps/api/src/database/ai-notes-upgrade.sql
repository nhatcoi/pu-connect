-- ==========================================================
-- Migration: ghi chú Markdown của N7AI (idempotent)
-- Cây trang (parent_id), ghim, gắn tùy chọn với một hội thoại
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_notes (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    parent_id UUID REFERENCES ai_notes(id) ON DELETE CASCADE,
    title VARCHAR(200) NOT NULL DEFAULT '',
    content TEXT NOT NULL DEFAULT '',
    pinned BOOLEAN NOT NULL DEFAULT FALSE,
    position INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_notes_user ON ai_notes (user_id, pinned DESC, updated_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_notes_parent ON ai_notes (parent_id) WHERE parent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_ai_notes_conversation ON ai_notes (conversation_id) WHERE conversation_id IS NOT NULL;
