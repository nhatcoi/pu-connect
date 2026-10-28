-- Migration: Upgrade Domain 1 (Identity & Profile)
-- Bổ sung Chuyên ngành, Lớp sinh hoạt, Xác thực tích xanh và Cài đặt riêng tư

-- 1. Bổ sung các cột mới vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS is_verified BOOLEAN DEFAULT FALSE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS privacy_settings JSONB DEFAULT '{
    "show_email": false,
    "show_student_id": true,
    "show_class": true,
    "is_private_profile": false
}'::jsonb;
ALTER TABLE users ADD COLUMN IF NOT EXISTS location VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS website VARCHAR(255);
ALTER TABLE users ADD COLUMN IF NOT EXISTS birth_date DATE;
ALTER TABLE users ADD COLUMN IF NOT EXISTS banner_url VARCHAR(500);

-- 2. Đánh chỉ mục tối ưu tìm kiếm theo sinh viên
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- Lưu ý: tích xanh KHÔNG cấp ở đây nữa (migration này chạy mỗi lần deploy).
-- Tích xanh chỉ cấp khi email đã xác thực: xem auth-upgrade.sql và AuthService.verifyEmail.
-- Đã gỡ các câu UPDATE gán ngành/lớp mẫu: chúng áp cho mọi sinh viên (kể cả tài khoản mới).
