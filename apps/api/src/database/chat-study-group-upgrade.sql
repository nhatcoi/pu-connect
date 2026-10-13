-- ==========================================================
-- Migration: Nối nhóm học ↔ nhóm chat (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §13
-- ==========================================================

-- Mỗi nhóm học có tối đa 1 nhóm chat (tạo lười khi thành viên mở lần đầu)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS study_group_id UUID REFERENCES study_groups(id) ON DELETE SET NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_conversations_study_group ON conversations(study_group_id) WHERE study_group_id IS NOT NULL;
