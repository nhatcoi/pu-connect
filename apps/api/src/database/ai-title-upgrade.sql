-- Tên thread N7AI: tên tạm lấy từ câu hỏi đầu (title_auto = true) → sau lượt trả lời, AI đặt lại tên theo ngữ cảnh.
-- Người dùng đổi tên tay ⇒ title_auto = false, không bị ghi đè.
ALTER TABLE conversations ADD COLUMN IF NOT EXISTS title_auto BOOLEAN NOT NULL DEFAULT false;
