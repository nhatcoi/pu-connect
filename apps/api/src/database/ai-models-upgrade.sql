-- ==========================================================
-- Migration: danh mục model N7AI do admin quản lý (idempotent, chạy mỗi lần deploy)
-- id = tên model trên gateway; API key KHÔNG lưu ở đây (vẫn là env của server)
-- ==========================================================

CREATE TABLE IF NOT EXISTS ai_models (
    id VARCHAR(40) PRIMARY KEY,              -- tên model gửi lên gateway (vd. n7ai-fast)
    label VARCHAR(40) NOT NULL,              -- tên hiển thị cho người dùng
    hint VARCHAR(160) NOT NULL DEFAULT '',   -- mô tả ngắn trong menu chọn
    cost SMALLINT NOT NULL DEFAULT 1 CHECK (cost BETWEEN 1 AND 10),  -- số lượt quota mỗi câu hỏi
    visible BOOLEAN NOT NULL DEFAULT TRUE,   -- hiện trong menu chọn của người dùng
    enabled BOOLEAN NOT NULL DEFAULT TRUE,   -- tắt ⇒ không ai dùng được, người đang chọn rơi về mặc định
    is_default BOOLEAN NOT NULL DEFAULT FALSE,
    sort_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
-- Đúng 1 model mặc định
CREATE UNIQUE INDEX IF NOT EXISTS uq_ai_models_default ON ai_models (is_default) WHERE is_default;

-- 2026-10-20: gateway đổi tên puc-* → n7ai-* (puc-* không còn) ⇒ đổi id, giữ nhãn/cờ admin đã chỉnh, chuyển người đang chọn
UPDATE ai_models m SET id = 'n7ai-' || substr(m.id, 5), updated_at = NOW()
WHERE m.id IN ('puc-fast', 'puc-perfect', 'puc-deep') AND NOT EXISTS (SELECT 1 FROM ai_models x WHERE x.id = 'n7ai-' || substr(m.id, 5));
UPDATE ai_settings SET ai_model = 'n7ai-' || substr(ai_model, 5) WHERE ai_model IN ('puc-fast', 'puc-perfect', 'puc-deep');

INSERT INTO ai_models (id, label, hint, cost, visible, is_default, sort_order) VALUES
  ('n7ai-fast',   'Nhanh',     'Trả lời nhanh, hợp câu hỏi ngắn và tìm tài liệu',  1, TRUE,  TRUE,  10),
  ('n7ai-perfect','Cân bằng',  'Kỹ hơn cho bài giải, tổng hợp và giải thích',       1, TRUE,  FALSE, 20),
  ('n7ai-deep',   'Sâu',       'Suy luận sâu cho câu khó',                          2, FALSE, FALSE, 30)
ON CONFLICT (id) DO NOTHING;

-- Tên model tự đặt dài hơn 20 ký tự
ALTER TABLE ai_settings ALTER COLUMN ai_model TYPE VARCHAR(40);
