-- Thông báo hệ thống: nhắm theo vai trò / đơn vị / khóa, hẹn giờ, banner toàn trang. Idempotent.
CREATE TABLE IF NOT EXISTS announcements (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    title VARCHAR(120) NOT NULL,
    message TEXT NOT NULL,
    link VARCHAR(255),
    -- { roles?: string[], unitIds?: uuid[] (gồm đơn vị con), years?: string[] }; rỗng = mọi thành viên
    audience JSONB NOT NULL DEFAULT '{}',
    send_in_app BOOLEAN NOT NULL DEFAULT TRUE,
    banner BOOLEAN NOT NULL DEFAULT FALSE,
    banner_until TIMESTAMPTZ,
    status VARCHAR(12) NOT NULL DEFAULT 'scheduled',  -- scheduled | sent | cancelled
    scheduled_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    sent_at TIMESTAMPTZ,
    recipients_count INT,
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_announcements_due ON announcements(scheduled_at) WHERE status = 'scheduled';
CREATE INDEX IF NOT EXISTS idx_announcements_banner ON announcements(banner_until) WHERE banner AND status = 'sent';
