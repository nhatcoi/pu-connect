-- ==========================================================
-- Migration: Nhắn tin P2 — đính kèm, trả lời, cảm xúc, ghim, sửa tin,
-- quản lý nhóm, tắt thông báo / ghim hội thoại, chế độ học PU AI (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §13
-- ==========================================================

-- Tin nhắn: tệp đính kèm, sửa, ghim, chế độ AI
ALTER TABLE messages ADD COLUMN IF NOT EXISTS attachments JSONB;          -- [{url,key,name,size,mime,kind}]
ALTER TABLE messages ADD COLUMN IF NOT EXISTS edited_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS pinned_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE messages ADD COLUMN IF NOT EXISTS meta JSONB;                 -- {aiMode} | {event, actorId, targetIds}

-- Tìm nhanh tin đã ghim / có tệp trong 1 hội thoại (tab "Đã ghim", "File & ảnh")
CREATE INDEX IF NOT EXISTS idx_messages_pinned ON messages(conversation_id, pinned_at DESC) WHERE pinned_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_messages_attachments ON messages(conversation_id, id DESC)
    WHERE attachments IS NOT NULL AND deleted_at IS NULL;

-- Cảm xúc: mỗi người mỗi emoji 1 lần / tin
CREATE TABLE IF NOT EXISTS message_reactions (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    emoji VARCHAR(16) NOT NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id, emoji)
);

-- Cài đặt riêng từng thành viên: tắt thông báo, ghim hội thoại lên đầu
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS muted_until TIMESTAMPTZ;
ALTER TABLE conversation_members ADD COLUMN IF NOT EXISTS pinned_at TIMESTAMPTZ;
