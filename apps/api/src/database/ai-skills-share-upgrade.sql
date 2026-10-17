-- ==========================================================
-- Migration: Chia sẻ skill N7AI công khai (thư viện skill) (idempotent)
-- Thiết kế: docs/core/09-chat-mention-ai-threads-skills.md §8
-- ==========================================================

ALTER TABLE ai_skills ADD COLUMN IF NOT EXISTS is_public BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE ai_skills ADD COLUMN IF NOT EXISTS install_count INT NOT NULL DEFAULT 0;
-- Bản cài từ thư viện trỏ về skill gốc (gốc bị xóa ⇒ bản cài vẫn giữ)
ALTER TABLE ai_skills ADD COLUMN IF NOT EXISTS source_skill_id UUID REFERENCES ai_skills(id) ON DELETE SET NULL;

-- Thư viện: skill công khai, nhiều lượt cài trước
CREATE INDEX IF NOT EXISTS idx_ai_skills_public ON ai_skills(install_count DESC, created_at DESC) WHERE is_public;
-- Mỗi người cài 1 skill gốc tối đa 1 lần
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_skills_installed ON ai_skills(owner_id, source_skill_id) WHERE source_skill_id IS NOT NULL;
