-- ==========================================================
-- Migration: Cài đặt N7AI — bộ nhớ, tác vụ tự động, phản hồi, quyền riêng tư (idempotent)
-- Thiết kế: docs/core/10-n7ai-settings.md
-- ==========================================================

-- 1. Cài đặt N7AI của từng người (thiếu hàng ⇒ mặc định)
CREATE TABLE IF NOT EXISTS ai_settings (
    user_id UUID PRIMARY KEY REFERENCES users(id) ON DELETE CASCADE,
    memory_enabled BOOLEAN NOT NULL DEFAULT TRUE,
    retention_days INT CHECK (retention_days IN (30, 365)), -- NULL = giữ vô hạn
    default_connectors TEXT[] NOT NULL DEFAULT '{library,web}',
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Bộ nhớ dài hạn (dữ kiện bền về người học)
CREATE TABLE IF NOT EXISTS ai_memories (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    content VARCHAR(300) NOT NULL,
    source VARCHAR(10) NOT NULL DEFAULT 'auto', -- auto | manual
    source_message_id BIGINT REFERENCES messages(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_memories_user ON ai_memories(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_ai_memories_trgm ON ai_memories USING gin (immutable_unaccent(lower(content)) gin_trgm_ops);

-- 3. Tác vụ tự động (hằng ngày / hằng tuần, giờ VN)
CREATE TABLE IF NOT EXISTS ai_tasks (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(80) NOT NULL,
    prompt TEXT NOT NULL,
    skill_id UUID REFERENCES ai_skills(id) ON DELETE SET NULL,
    connectors TEXT[] NOT NULL DEFAULT '{library}',
    frequency VARCHAR(10) NOT NULL CHECK (frequency IN ('daily', 'weekly')),
    run_time TIME NOT NULL,
    weekday SMALLINT CHECK (weekday BETWEEN 0 AND 6), -- 0 = Chủ nhật (weekly)
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    next_run_at TIMESTAMPTZ NOT NULL,
    last_run_at TIMESTAMPTZ,
    last_status VARCHAR(10), -- done | error | skipped
    fail_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_tasks_due ON ai_tasks(next_run_at) WHERE enabled;
CREATE INDEX IF NOT EXISTS idx_ai_tasks_user ON ai_tasks(user_id, created_at);

-- 4. Skill: bật/tắt + ghim lên đầu menu "/"
ALTER TABLE ai_skills ADD COLUMN IF NOT EXISTS enabled BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE ai_skills ADD COLUMN IF NOT EXISTS pinned BOOLEAN NOT NULL DEFAULT FALSE;

-- 5. Connector: lần dùng + lỗi gần nhất (hiện ở trang Trình kết nối)
ALTER TABLE user_connectors ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE user_connectors ADD COLUMN IF NOT EXISTS last_error VARCHAR(200);

-- 6. Phản hồi câu trả lời N7AI + yêu cầu hỗ trợ
CREATE TABLE IF NOT EXISTS ai_feedback (
    message_id BIGINT NOT NULL REFERENCES messages(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL CHECK (rating IN (-1, 1)),
    reason VARCHAR(30),
    comment VARCHAR(500),
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (message_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_ai_feedback_created ON ai_feedback(created_at DESC);

CREATE TABLE IF NOT EXISTS ai_support_tickets (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE SET NULL,
    category VARCHAR(20) NOT NULL, -- bug | wrong_answer | idea | other
    message TEXT NOT NULL,
    conversation_id UUID REFERENCES conversations(id) ON DELETE SET NULL,
    context JSONB, -- vài tin gần nhất (chỉ khi người dùng đồng ý)
    status VARCHAR(10) NOT NULL DEFAULT 'open',
    created_at TIMESTAMPTZ DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_ai_support_created ON ai_support_tickets(created_at DESC);

-- 7. Cộng đồng N7AI (chia sẻ skill, góp ý)
INSERT INTO communities (slug, name, description, community_type)
VALUES ('n7ai', 'N7AI', 'Chia sẻ skill hay, mẹo học với N7AI, góp ý & báo lỗi trợ lý học tập.', 'academic')
ON CONFLICT (slug) DO NOTHING;
