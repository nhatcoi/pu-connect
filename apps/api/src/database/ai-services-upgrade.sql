-- ==========================================================
-- Migration: Quản lý dịch vụ AI bổ trợ (Embedding RAG & OCR Vision) (idempotent)
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_services (
    service VARCHAR(30) PRIMARY KEY,     -- 'embedding' | 'ocr'
    name VARCHAR(60) NOT NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    base_url TEXT NOT NULL DEFAULT '',
    api_key_enc TEXT,                    -- AES-256-GCM (TokenCipher); không trả ra client
    key_hint VARCHAR(8) NOT NULL DEFAULT '',
    model VARCHAR(120) NOT NULL DEFAULT '',
    max_pages INT NOT NULL DEFAULT 30,
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- Seed mặc định hoặc cập nhật tên chuẩn gọn
INSERT INTO ai_services (service, name, enabled, base_url, model, key_hint, max_pages)
VALUES 
  ('embedding', 'RAG', TRUE, 'http://127.0.0.1:11435/v1', 'qwen3-embedding:0.6b', '', 30),
  ('ocr', 'OCR', TRUE, 'https://api-ai.vnhat.dev/v1', 'gemini-3.7-flash-medium', '', 30)
ON CONFLICT (service) DO UPDATE SET name = EXCLUDED.name;
