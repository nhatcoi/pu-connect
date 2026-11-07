-- N7AI "chat nhanh" của Tin nhắn: thread riêng, không hiện trong lịch sử /n7ai (cột cộng thêm, idempotent)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_quick BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_conversations_ai_quick ON conversations (created_by) WHERE type = 'ai' AND ai_quick;
