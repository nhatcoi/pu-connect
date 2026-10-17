-- ==========================================================
-- Migration: Mention trong chat, N7AI nhiều hội thoại, skill tự tạo (idempotent)
-- Thiết kế: docs/core/09-chat-mention-ai-threads-skills.md
-- ==========================================================

-- 1. Mention trong tin nhắn: đếm "nhắc bạn chưa đọc" bằng index (user, hội thoại, tin)
CREATE TABLE IF NOT EXISTS message_mentions (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    conversation_id UUID NOT NULL REFERENCES conversations(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_message_mentions_user ON message_mentions(user_id, conversation_id, message_id DESC);

-- 2. N7AI nhiều hội thoại: tiêu đề tự đặt + tóm tắt cuộn (trí nhớ dài)
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_summary TEXT;
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS ai_summary_upto BIGINT;
CREATE INDEX IF NOT EXISTS idx_conversations_ai_threads
    ON conversations(created_by, (COALESCE(last_message_at, created_at)) DESC, id DESC) WHERE type = 'ai';
CREATE INDEX IF NOT EXISTS idx_conversations_ai_title_trgm
    ON conversations USING gin (immutable_unaccent(lower(title)) gin_trgm_ops) WHERE type = 'ai';

-- 3. Skill tự tạo (slash command), riêng từng người
CREATE TABLE IF NOT EXISTS ai_skills (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    owner_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    slug VARCHAR(40) NOT NULL,
    name VARCHAR(60) NOT NULL,
    description VARCHAR(200) NOT NULL DEFAULT '',
    instructions TEXT NOT NULL,
    input_hint VARCHAR(150),
    use_count INT NOT NULL DEFAULT 0,
    last_used_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    UNIQUE (owner_id, slug)
);
CREATE INDEX IF NOT EXISTS idx_ai_skills_owner ON ai_skills(owner_id, last_used_at DESC NULLS LAST);

-- 4. Hội thoại N7AI cũ chưa có tiêu đề ⇒ lấy dòng đầu câu hỏi đầu tiên (≤ 60 ký tự)
UPDATE conversations c SET title = t.title
FROM (
    SELECT DISTINCT ON (m.conversation_id) m.conversation_id,
           left(regexp_replace(btrim(split_part(m.content, E'\n', 1)), '\s+', ' ', 'g'), 60) AS title
    FROM messages m JOIN conversations cc ON cc.id = m.conversation_id AND cc.type = 'ai' AND cc.title IS NULL
    WHERE m.kind = 'text' AND m.deleted_at IS NULL AND btrim(COALESCE(m.content, '')) <> ''
    ORDER BY m.conversation_id, m.id
) t
WHERE c.id = t.conversation_id AND c.title IS NULL;
