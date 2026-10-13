-- ==========================================================
-- Migration: Nhắn tin P1 — DM, nhóm, hội thoại AI (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §3.2–3.3
-- ==========================================================

CREATE TABLE IF NOT EXISTS conversations (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    type VARCHAR(20) NOT NULL,              -- direct | group | ai
    title VARCHAR(150),                     -- NULL với direct / ai
    avatar_url VARCHAR(500),
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    direct_key VARCHAR(80) UNIQUE,          -- 'minUserId:maxUserId' ⇒ 1 DM duy nhất mỗi cặp
    last_message_id BIGINT,
    last_message_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_conversations_last ON conversations(last_message_at DESC NULLS LAST);

CREATE TABLE IF NOT EXISTS conversation_members (
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(10) NOT NULL DEFAULT 'member', -- owner | member
    last_read_message_id BIGINT NOT NULL DEFAULT 0,
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    left_at TIMESTAMPTZ,
    PRIMARY KEY (conversation_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_conv_members_user ON conversation_members(user_id) WHERE left_at IS NULL;

CREATE TABLE IF NOT EXISTS messages (
    id BIGSERIAL PRIMARY KEY,               -- tăng dần ⇒ keyset pagination & read cursor
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    sender_id UUID REFERENCES users(id) ON DELETE SET NULL,
    client_msg_id UUID,                     -- idempotency + optimistic UI
    kind VARCHAR(12) NOT NULL DEFAULT 'text', -- text | system | ai
    content TEXT,
    blocks JSONB,                           -- citations của câu trả lời AI
    reply_to_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    status VARCHAR(10) NOT NULL DEFAULT 'done', -- streaming | done | error
    deleted_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (sender_id, client_msg_id)
);
CREATE INDEX IF NOT EXISTS idx_messages_conv ON messages(conversation_id, id DESC);
