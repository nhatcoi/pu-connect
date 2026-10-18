-- ==========================================================
-- Migration: N7AI agent — hồ sơ học, ghim bộ nhớ, connector "Hội thoại của tôi" (idempotent)
-- Thiết kế: docs/core/16-n7ai-agent-tools.md
-- Chạy sau ai-study-connector-upgrade.sql
-- ==========================================================

-- 1. Hồ sơ học do người dùng tự viết (luôn có trong system prompt thread riêng)
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS profile_goal VARCHAR(300);
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS profile_about VARCHAR(600);
ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS profile_style VARCHAR(300);

-- 2. Ghim mục nhớ: luôn đưa vào ngữ cảnh, không bị mục tự động mới đẩy ra
ALTER TABLE ai_memories ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- 3. Bật my_chats cho mọi người đúng 1 lần (mốc = DEFAULT của cột đã chứa my_chats ⇒ bỏ qua; người tự tắt không bị bật lại)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_settings' AND column_name = 'default_connectors' AND column_default LIKE '%my_chats%'
  ) THEN
    UPDATE ai_settings SET default_connectors = array_append(default_connectors, 'my_chats')
    WHERE NOT ('my_chats' = ANY(default_connectors));
    ALTER TABLE ai_settings ALTER COLUMN default_connectors SET DEFAULT '{library,web,my_study,my_chats}';
  END IF;
END $$;
