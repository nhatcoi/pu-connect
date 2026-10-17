-- ==========================================================
-- Migration: Đổi tên trợ lý PU AI → N7AI (idempotent)
-- Bot @puai → @n7ai, cộng đồng /c/puai → /c/n7ai. Chạy TRƯỚC messaging-upgrade.sql
-- (để bước INSERT bot không tạo thêm tài khoản mới). Nội dung cũ có "@puai" vẫn gọi được bot.
-- ==========================================================

UPDATE users
SET username = 'n7ai', email = 'n7ai@system.local', display_name = 'N7AI',
    bio = 'Trợ lý học tập của PU Connector. Tag @n7ai để hỏi.',
    avatar_url = replace(avatar_url, 'seed=puai', 'seed=n7ai'), updated_at = NOW()
WHERE email = 'puai@system.local'
  AND NOT EXISTS (SELECT 1 FROM users WHERE username = 'n7ai');

UPDATE communities
SET slug = 'n7ai', name = 'N7AI', description = replace(description, 'PU AI', 'N7AI')
WHERE slug = 'puai'
  AND NOT EXISTS (SELECT 1 FROM communities WHERE slug = 'n7ai');
