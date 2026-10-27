-- Nhóm quyền quản trị: gộp quyền chi tiết rồi gán cho người dùng (ngoài vai trò admin). Idempotent.
CREATE TABLE IF NOT EXISTS admin_groups (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(60) NOT NULL UNIQUE,
    description VARCHAR(255),
    permissions TEXT[] NOT NULL DEFAULT '{}',
    created_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS admin_group_members (
    group_id UUID NOT NULL REFERENCES admin_groups(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (group_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_admin_group_members_user ON admin_group_members(user_id);

-- Nhóm mẫu (sửa được trên giao diện, không ghi đè khi chạy lại)
INSERT INTO admin_groups (name, description, permissions) VALUES
    ('Kiểm duyệt viên', 'Xử lý báo cáo, ẩn/ghim bài, xóa bình luận, xem người dùng', ARRAY['dashboard:view','moderation:read','moderation:write','users:read']),
    ('Biên tập học thuật', 'Quản lý học phần, tài liệu, cộng đồng và gửi thông báo', ARRAY['dashboard:view','academic:read','academic:manage','system:broadcast']),
    ('Vận hành N7AI', 'Theo dõi telemetry, xử lý ticket và skill N7AI', ARRAY['dashboard:view','ai:read','ai:manage','search:read'])
ON CONFLICT (name) DO NOTHING;
