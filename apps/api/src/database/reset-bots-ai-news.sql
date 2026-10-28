-- Reset toàn bộ bot cũ và khởi tạo bot AI & Tech News duy nhất
BEGIN;

-- 1. Dọn dẹp lệnh, nhật ký và feed của bot cũ
DELETE FROM bot_commands;
DELETE FROM bot_activity;
DELETE FROM bot_feed_items;

-- 2. Xóa toàn bộ tài khoản bot cũ (CASCADE xóa bot_profiles, posts, comments, reactions của bot)
DELETE FROM users WHERE is_bot = true;

-- 3. Cập nhật lại bộ đếm likes_count và comments_count của các bài viết còn lại
UPDATE posts p SET
  likes_count = (SELECT COUNT(*) FROM post_reactions r WHERE r.post_id = p.id),
  comments_count = (SELECT COUNT(*) FROM comments c WHERE c.post_id = p.id);

-- 4. Bổ sung topic Tin tức AI & Công nghệ nếu chưa có
INSERT INTO bot_topics (slug, label, keywords, enabled)
VALUES (
  'ai-tech-news',
  'Tin tức AI & Công nghệ',
  ARRAY['ai', 'trí tuệ nhân tạo', 'openai', 'google', 'gemini', 'anthropic', 'nvidia', 'robotics', 'an ninh mạng', 'security', 'công nghệ', 'tin tức', 'tech news'],
  true
)
ON CONFLICT (slug) DO UPDATE SET
  label = EXCLUDED.label,
  keywords = EXCLUDED.keywords,
  enabled = true;

-- 5. Khởi tạo bot AI & Tech News đầu tiên
WITH new_bot AS (
  INSERT INTO users (
    id,
    email,
    username,
    password_hash,
    display_name,
    role,
    status,
    is_onboarded,
    email_verified,
    email_verified_at,
    bio,
    is_bot,
    created_at
  )
  VALUES (
    gen_random_uuid(),
    'ainews@seed.pu-connector.test',
    'ainews',
    '$2b$10$nysm2/2G36tk6zTQOeIoS.dDS9OznPtvJFigmueDe1PAbrIaUNID.',
    'AI & Tech News',
    'lecturer',
    'active',
    true,
    true,
    NOW(),
    'Bản tin tự động cập nhật công nghệ, AI, an ninh mạng và khoa học có dẫn nguồn chính thống.',
    true,
    NOW()
  )
  RETURNING id
)
INSERT INTO bot_profiles (
  user_id,
  tone,
  soul,
  topics,
  enabled,
  can_post,
  can_comment,
  can_like,
  interact_humans,
  max_posts_per_day,
  max_comments_per_day,
  max_likes_per_day
)
SELECT
  id,
  'súc tích, chuyên nghiệp, khách quan, phân tích tác động và dẫn nguồn đầy đủ',
  'Biên tập viên AI News: chuyên theo dõi và tổng hợp tin tức công nghệ mới nhất từ các nguồn quốc tế & trong nước (Reuters, OpenAI, Google, TechCrunch, ArXiv...). Cung cấp bản tóm tắt súc tích bằng tiếng Việt, luôn nêu rõ sự kiện chính, tác động chuyên môn và nguồn bài viết.',
  ARRAY['ai-tech-news', 'cntt', 'nckh'],
  true,
  true,
  true,
  true,
  true,
  50,
  100,
  100
FROM new_bot;

COMMIT;
