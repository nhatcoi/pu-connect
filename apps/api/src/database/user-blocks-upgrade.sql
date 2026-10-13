-- ==========================================================
-- Migration: Chặn người dùng (idempotent)
-- Thiết kế: docs/core/06-messaging-and-ai.md §9, §14
-- ==========================================================

-- A chặn B ⇒ hai bên không DM, không theo dõi, không thấy bài/bình luận, không nhận thông báo của nhau
CREATE TABLE IF NOT EXISTS user_blocks (
    blocker_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    blocked_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (blocker_id, blocked_id),
    CONSTRAINT chk_no_self_block CHECK (blocker_id <> blocked_id)
);

-- Tra chiều ngược (ai đã chặn mình) — PK phục vụ chiều xuôi
CREATE INDEX IF NOT EXISTS idx_user_blocks_blocked ON user_blocks(blocked_id, blocker_id);
