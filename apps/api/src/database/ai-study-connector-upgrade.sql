-- ==========================================================
-- Migration: connector N7AI "Học tập của tôi" (my_study) bật sẵn (idempotent)
-- Thiết kế: docs/core/15-study-tools.md (mục "N7AI đọc tiến độ học")
-- Chạy sau puai-settings-upgrade.sql
-- ==========================================================

-- Bật my_study cho mọi người đúng 1 lần: mốc là DEFAULT của cột (đã chứa my_study ⇒ bỏ qua)
-- ⇒ chạy lại mỗi lần deploy không bật lại cho người đã tự tắt
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'ai_settings' AND column_name = 'default_connectors' AND column_default LIKE '%my_study%'
  ) THEN
    UPDATE ai_settings SET default_connectors = array_append(default_connectors, 'my_study')
    WHERE NOT ('my_study' = ANY(default_connectors));
    ALTER TABLE ai_settings ALTER COLUMN default_connectors SET DEFAULT '{library,web,my_study}';
  END IF;
END $$;
