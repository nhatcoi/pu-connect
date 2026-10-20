-- ==========================================================
-- Migration: mức model N7AI theo người dùng (n7ai-fast | n7ai-perfect | n7ai-deep) (idempotent)
-- Thiết kế: docs/core/20-n7ai-model-tiers.md. Chạy sau puai-settings-upgrade.sql
-- ==========================================================

ALTER TABLE ai_settings ADD COLUMN IF NOT EXISTS ai_model VARCHAR(20) NOT NULL DEFAULT 'n7ai-fast';
ALTER TABLE ai_settings ALTER COLUMN ai_model SET DEFAULT 'n7ai-fast';
