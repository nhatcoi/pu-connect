-- Migration: Upgrade Domain 1 (Identity & Profile)
-- Bổ sung Chuyên ngành, Lớp sinh hoạt, Xác thực tích xanh và Cài đặt riêng tư

-- 1. Bổ sung các cột mới vào bảng users
ALTER TABLE users ADD COLUMN IF NOT EXISTS school VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS major VARCHAR(100);
ALTER TABLE users ADD COLUMN IF NOT EXISTS class_name VARCHAR(50);
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
CREATE INDEX IF NOT EXISTS idx_users_school ON users(school);
CREATE INDEX IF NOT EXISTS idx_users_major ON users(major);
CREATE INDEX IF NOT EXISTS idx_users_class ON users(class_name);
CREATE INDEX IF NOT EXISTS idx_users_is_verified ON users(is_verified);

-- 3. Tự động cấp tích xanh cho người dùng có email đuôi trường Phenikaa
UPDATE users 
SET is_verified = TRUE, 
    verified_at = NOW() 
WHERE email ILIKE '%@phenikaa-uni.edu.vn' 
   OR email ILIKE '%@st.phenikaa-uni.edu.vn';

-- 4. Cập nhật dữ liệu mẫu cho sinh viên Phenikaa hiện có
UPDATE users 
SET major = 'Kỹ thuật phần mềm', 
    class_name = 'K16-CNTT1',
    is_verified = TRUE,
    verified_at = NOW()
WHERE username IN ('nhat_k16', 'duc_k16') OR role = 'student';

UPDATE users 
SET major = 'Khoa học máy tính & Trí tuệ nhân tạo', 
    class_name = 'K17-AI1',
    is_verified = TRUE,
    verified_at = NOW()
WHERE username = 'mai_pro';

UPDATE users 
SET major = 'Công nghệ thông tin', 
    is_verified = TRUE,
    verified_at = NOW()
WHERE role = 'lecturer';
