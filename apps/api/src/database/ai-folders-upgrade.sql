-- ==========================================================
-- Migration: thư mục cho lịch sử N7AI (idempotent)
-- Thiết kế: docs/core/23-n7ai-folders.md
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_folders (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(60) NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_folders_user ON ai_folders (user_id, created_at);

-- Xóa thư mục ⇒ thread về Lịch sử (không xóa thread)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_folder_id UUID REFERENCES ai_folders(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_conversations_ai_folder ON conversations (ai_folder_id) WHERE ai_folder_id IS NOT NULL;
