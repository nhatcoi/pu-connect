-- Seed Documents with correct column names
INSERT INTO documents (id, owner_id, title, description, type, file_url, file_size, tags, download_count, view_count, created_at)
SELECT
    gen_random_uuid(),
    u.id,
    'Đề thi & Đáp án chi tiết Cuối kỳ Giải tích 2 (Kỳ 2 2024)',
    'Đề thi chuẩn kèm hướng dẫn giải chi tiết từng câu hỏi tích phân đường và mặt.',
    'pdf',
    'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf',
    2516582,
    ARRAY['MATH201', 'Calculus', 'ExamPrep'],
    156,
    420,
    NOW() - INTERVAL '3 days'
FROM users u WHERE u.username = 'tranminhduc' LIMIT 1;

INSERT INTO documents (id, owner_id, title, description, type, file_url, file_size, tags, download_count, view_count, created_at)
SELECT
    gen_random_uuid(),
    u.id,
    'Slide Bài Giảng Trí Tuệ Nhân Tạo & Học Máy Nâng Cao (FIT/FCS)',
    'Bộ slide 12 chương từ Giới thiệu Học có giám sát đến Mạng nơ-ron Transformer.',
    'pdf',
    'https://raw.githubusercontent.com/mozilla/pdf.js/master/web/compressed.tracemonkey-pldi-09.pdf',
    8493465,
    ARRAY['AI302', 'MachineLearning', 'Slide'],
    289,
    890,
    NOW() - INTERVAL '6 days'
FROM users u WHERE u.username = 'gv_nguyenvanha' LIMIT 1;
