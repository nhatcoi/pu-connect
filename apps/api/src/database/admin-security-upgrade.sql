-- ==========================================================
-- Migration: Nhật ký bảo mật · Điểm rủi ro · View đã lưu (idempotent, chạy mỗi lần deploy)
-- ==========================================================

-- 1. Nhật ký bảo mật tài khoản (giữ 90 ngày, job tự xóa)
--    Chỉ ghi sự kiện đăng nhập / phiên / mật khẩu — KHÔNG ghi nội dung, mật khẩu, token
CREATE TABLE IF NOT EXISTS user_security_events (
    id BIGSERIAL PRIMARY KEY,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    event VARCHAR(32) NOT NULL,          -- login | login_failed | login_blocked | logout | register | password_reset | password_reset_requested | email_verified | session_revoked
    success BOOLEAN NOT NULL DEFAULT TRUE,
    method VARCHAR(16),                  -- password | google
    ip INET,
    user_agent VARCHAR(300),
    device VARCHAR(80),                  -- "Chrome · macOS" (rút gọn từ User-Agent)
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_security_events_user ON user_security_events (user_id, created_at DESC);
-- Phát hiện nhiều tài khoản cùng IP
CREATE INDEX IF NOT EXISTS idx_security_events_ip ON user_security_events (ip, created_at DESC) WHERE ip IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_security_events_created ON user_security_events (created_at);

-- 2. Điểm rủi ro (0–100) + lý do, job tính lại định kỳ ⇒ sắp xếp / lọc bằng index
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_score SMALLINT NOT NULL DEFAULT 0;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_factors JSONB NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS risk_updated_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_risk ON users (risk_score DESC) WHERE account_type = 'human' AND risk_score > 0;

-- 3. View đã lưu của admin (bộ lọc hay dùng) — shared = mọi admin thấy
CREATE TABLE IF NOT EXISTS admin_saved_views (
    id BIGSERIAL PRIMARY KEY,
    admin_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    page VARCHAR(30) NOT NULL,           -- users | moderation | academic | audit …
    name VARCHAR(60) NOT NULL,
    query TEXT NOT NULL,                 -- chuỗi query trên URL (#/users?role=student&reported=yes)
    shared BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_admin_saved_views_page ON admin_saved_views (page, created_at);

-- 4. "Cùng mạng": IPv6 đổi 64 bit cuối liên tục (privacy address) ⇒ so theo /64; IPv4 so nguyên địa chỉ
CREATE OR REPLACE FUNCTION ip_net(ip inet) RETURNS cidr
  LANGUAGE sql IMMUTABLE PARALLEL SAFE
  AS $$ SELECT CASE WHEN family(ip) = 6 THEN network(set_masklen(ip, 64)) ELSE network(set_masklen(ip, 32)) END $$;
CREATE INDEX IF NOT EXISTS idx_security_events_net ON user_security_events (ip_net(ip), user_id) WHERE ip IS NOT NULL;

-- 5. Sự kiện admin ép đăng xuất: không phải thiết bị của người dùng (dữ liệu cũ ghi device = 'Quản trị viên')
UPDATE user_security_events SET device = NULL, method = 'admin' WHERE device = 'Quản trị viên';

-- 6. Vị trí gần đúng từ IP (header Cloudflare "visitor location") + cờ đăng nhập từ nơi lạ
ALTER TABLE user_security_events ADD COLUMN IF NOT EXISTS country CHAR(2);
ALTER TABLE user_security_events ADD COLUMN IF NOT EXISTS region VARCHAR(80);
ALTER TABLE user_security_events ADD COLUMN IF NOT EXISTS city VARCHAR(80);
ALTER TABLE user_security_events ADD COLUMN IF NOT EXISTS unusual BOOLEAN NOT NULL DEFAULT FALSE;
-- 7. Admin bắt đổi mật khẩu: đăng nhập bằng mật khẩu bị chặn tới khi người dùng đặt mật khẩu mới qua email
ALTER TABLE users ADD COLUMN IF NOT EXISTS must_reset_password BOOLEAN NOT NULL DEFAULT FALSE;
CREATE INDEX IF NOT EXISTS idx_security_events_unusual ON user_security_events (created_at DESC) WHERE unusual;
