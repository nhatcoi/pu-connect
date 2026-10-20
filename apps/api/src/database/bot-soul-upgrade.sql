-- Bot soul: "linh hồn" (tính cách, sở thích, cách viết) của từng bot — AI bám theo khi tự đăng/bình luận.
-- Bot không còn đăng từ kho crawl: nội dung ngoài vào bằng Excel (lịch đăng = bot_commands). Idempotent.

ALTER TABLE bot_profiles ADD COLUMN IF NOT EXISTS soul TEXT;

-- Lệnh đăng bài crawl đang chờ (luồng cũ) không còn chạy được ⇒ hủy
UPDATE bot_commands SET status = 'cancelled', result = 'Luồng kho crawl đã bỏ, hãy import Excel', finished_at = NOW()
WHERE status = 'pending' AND payload ? 'feedItemId';
