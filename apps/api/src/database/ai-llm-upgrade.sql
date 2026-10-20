-- ==========================================================
-- Migration: gộp quản lý LLM — model gắn provider, tên model thật, effort, giới hạn token (idempotent, chạy mỗi lần deploy)
-- ==========================================================

ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS provider_id UUID REFERENCES ai_providers(id) ON DELETE SET NULL; -- NULL = chuỗi provider mặc định
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS upstream_model VARCHAR(120);                                     -- tên model gửi lên provider; NULL = dùng id
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS reasoning_effort VARCHAR(8);                                     -- low | medium | high; NULL = để provider quyết định
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS max_input_tokens INT;                                            -- NULL = không giới hạn; vượt ⇒ cắt bớt tin cũ nhất
ALTER TABLE ai_models ADD COLUMN IF NOT EXISTS max_output_tokens INT;                                           -- NULL = theo mặc định của hệ thống

DO $$ BEGIN
  ALTER TABLE ai_models ADD CONSTRAINT ai_models_effort_chk CHECK (reasoning_effort IS NULL OR reasoning_effort IN ('low', 'medium', 'high'));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE ai_models ADD CONSTRAINT ai_models_tokens_chk CHECK ((max_input_tokens IS NULL OR max_input_tokens BETWEEN 1000 AND 2000000) AND (max_output_tokens IS NULL OR max_output_tokens BETWEEN 256 AND 200000));
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

CREATE INDEX IF NOT EXISTS idx_ai_models_provider ON ai_models (provider_id) WHERE provider_id IS NOT NULL;
