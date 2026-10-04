-- Auth upgrade (idempotent): hỗ trợ đăng nhập Google, user không có mật khẩu
ALTER TABLE users ALTER COLUMN password_hash DROP NOT NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS google_id VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS auth_provider VARCHAR(20) DEFAULT 'local';
CREATE UNIQUE INDEX IF NOT EXISTS idx_users_google_id ON users(google_id) WHERE google_id IS NOT NULL;
-- Không còn bước onboarding bắt buộc: mọi tài khoản vào app ngay
ALTER TABLE users ALTER COLUMN is_onboarded SET DEFAULT TRUE;
UPDATE users SET is_onboarded = TRUE WHERE is_onboarded = FALSE;

-- Xác thực email (chạy 1 lần): tài khoản đã tồn tại / seed coi như đã xác minh
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'users' AND column_name = 'email_verified') THEN
    ALTER TABLE users ADD COLUMN email_verified BOOLEAN NOT NULL DEFAULT FALSE;
    UPDATE users SET email_verified = TRUE;
  END IF;
END $$;
ALTER TABLE users ADD COLUMN IF NOT EXISTS email_verified_at TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_hash VARCHAR(64);
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_token_expires TIMESTAMPTZ;
ALTER TABLE users ADD COLUMN IF NOT EXISTS verify_sent_at TIMESTAMPTZ;
CREATE INDEX IF NOT EXISTS idx_users_verify_token ON users(verify_token_hash) WHERE verify_token_hash IS NOT NULL;

-- Tích xanh: chỉ email trường ĐÃ xác thực (idempotent, an toàn chạy lại mỗi lần deploy)
UPDATE users
SET is_verified = TRUE, verified_at = COALESCE(verified_at, NOW())
WHERE email_verified = TRUE
  AND is_verified = FALSE
  AND (email ILIKE '%@phenikaa-uni.edu.vn' OR email ILIKE '%@st.phenikaa-uni.edu.vn');
