-- ==========================================================
-- Migration: Add Sub-Communities (Diễn đàn & Cộng đồng sinh viên)
-- ==========================================================

-- 1. Communities Table
CREATE TABLE IF NOT EXISTS communities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    slug VARCHAR(100) UNIQUE NOT NULL,
    name VARCHAR(255) NOT NULL,
    description TEXT NOT NULL,
    community_type VARCHAR(50) DEFAULT 'academic', -- 'campus', 'faculty', 'academic', 'life', 'club'
    avatar_url VARCHAR(500),
    banner_url VARCHAR(500),
    rules JSONB DEFAULT '[]',
    members_count INT DEFAULT 0,
    posts_count INT DEFAULT 0,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Community Members Table
CREATE TABLE IF NOT EXISTS community_members (
    community_id UUID REFERENCES communities(id) ON DELETE CASCADE,
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    role VARCHAR(30) DEFAULT 'member', -- 'admin', 'moderator', 'member'
    joined_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (community_id, user_id)
);

-- 3. Update Posts Table with community_id
ALTER TABLE posts ADD COLUMN IF NOT EXISTS community_id UUID REFERENCES communities(id) ON DELETE SET NULL;

-- 4. Indexes for Performance
CREATE INDEX IF NOT EXISTS idx_communities_slug ON communities(slug);
CREATE INDEX IF NOT EXISTS idx_communities_type ON communities(community_type);
CREATE INDEX IF NOT EXISTS idx_community_members_user ON community_members(user_id);
CREATE INDEX IF NOT EXISTS idx_posts_community ON posts(community_id, created_at DESC);

-- 5. Seed Core Phenikaa Sub-Communities
INSERT INTO communities (slug, name, description, community_type, avatar_url, banner_url, rules, members_count, posts_count)
VALUES
(
    'phenikaa',
    'Phenikaa Đại Sảnh & Confessions',
    'Cộng đồng trung tâm kết nối toàn bộ sinh viên, giảng viên và cựu sinh viên trường Đại học Phenikaa. Thảo luận mọi chủ đề đời sống, học đường và văn hóa Phenikaa.',
    'campus',
    'https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1523050854058-8df90110c9f1?w=1200&auto=format&fit=crop&q=80',
    '[
        {"title": "Tôn trọng lẫn nhau", "desc": "Không công kích cá nhân, xúc phạm danh dự của sinh viên hoặc giảng viên."},
        {"title": "Thông tin chính xác", "desc": "Không lan truyền tin đồn thất thiệt hoặc thông báo không chính thống về trường."},
        {"title": "Đúng chủ đề", "desc": "Gắn thẻ hashtag và chọn đúng phân loại bài viết khi chia sẻ."}
    ]'::jsonb,
    1420,
    286
),
(
    'fit',
    'Khoa Công Nghệ Thông Tin (FIT Hub)',
    'Góc học thuật, chia sẻ đồ án, mã nguồn và kinh nghiệm lập trình cho sinh viên FIT và FCS Phenikaa.',
    'faculty',
    'https://images.unsplash.com/photo-1517694712202-14dd9538aa97?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1526374965328-7f61d4dc18c5?w=1200&auto=format&fit=crop&q=80',
    '[
        {"title": "Định dạng mã nguồn", "desc": "Sử dụng markdown code block khi đăng code hoặc báo lỗi."},
        {"title": "Hỏi bài văn minh", "desc": "Nêu rõ đề bài, những gì bạn đã thử làm thay vì xin code giải hộ toàn bộ."},
        {"title": "Khuyến khích mã nguồn mở", "desc": "Ưu tiên chia sẻ link GitHub, tài liệu kỹ thuật có ích cho cộng đồng."}
    ]'::jsonb,
    850,
    164
),
(
    'do-an-tot-nghiep',
    'Góc Đồ Án Tốt Nghiệp & Nghiên Cứu PBL',
    'Nơi giao lưu, tìm kiếm đồng đội làm đồ án tốt nghiệp, chia sẻ kinh nghiệm bảo vệ hội đồng và đồ án mẫu.',
    'academic',
    'https://images.unsplash.com/photo-1434030216411-0b793f4b4173?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1497633762265-9d179a990aa6?w=1200&auto=format&fit=crop&q=80',
    '[
        {"title": "Tuyển thành viên rõ ràng", "desc": "Cần nêu rõ đề tài, giáo viên hướng dẫn, kỹ năng cần tuyển và cam kết thời gian."},
        {"title": "Đạo đức học thuật", "desc": "Nghiêm cấm các hành vi mua bán đồ án, luận văn hoặc đạo văn."},
        {"title": "Chia sẻ kinh nghiệm thực chiến", "desc": "Khuyến khích chia sẻ các mẹo trả lời câu hỏi phản biện của hội đồng."}
    ]'::jsonb,
    620,
    98
),
(
    'tim-phong-tro',
    'Nhà Trọ & Bạn Cùng Phòng Phenikaa',
    'Cộng đồng chia sẻ phòng trọ, căn hộ mini quanh khu vực Yên Nghĩa, Dương Nội, Hà Đông và tìm bạn ở ghép văn minh.',
    'life',
    'https://images.unsplash.com/photo-1522708323590-d24dbb6b0267?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1502672260266-1c1ef2d93688?w=1200&auto=format&fit=crop&q=80',
    '[
        {"title": "Thông tin minh bạch", "desc": "Bắt buộc ghi rõ địa chỉ, giá phòng, tiền điện nước và đính kèm ảnh thật."},
        {"title": "Cảnh báo lừa đảo", "desc": "Không chuyển cọc khi chưa xem phòng và gặp trực tiếp chủ nhà/người ở ghép."},
        {"title": "Lịch sự và trung thực", "desc": "Mô tả rõ thói quen sinh hoạt khi tìm bạn cùng phòng."}
    ]'::jsonb,
    940,
    145
),
(
    'clb-hoat-dong',
    'Câu Lạc Bộ & Hoạt Động Ngoại Khóa',
    'Tổng hợp thông tin tuyển thành viên, giải đấu thể thao (PU Cup), hội trại, workshop và đêm nhạc sinh viên.',
    'club',
    'https://images.unsplash.com/photo-1511578314322-379afb476865?w=200&auto=format&fit=crop&q=80',
    'https://images.unsplash.com/photo-1492684223066-81342ee5ff30?w=1200&auto=format&fit=crop&q=80',
    '[
        {"title": "Thông tin chính thức", "desc": "Bài đăng từ CLB cần có fanpage/kênh liên hệ chính thức đính kèm."},
        {"title": "Tôn trọng lịch chung", "desc": "Tránh spam bài đăng tuyển sinh trùng lặp liên tục."},
        {"title": "Khuyến khích tinh thần nhiệt huyết", "desc": "Hỗ trợ và cổ vũ các đội tuyển tham gia các giải đấu của trường."}
    ]'::jsonb,
    780,
    112
)
ON CONFLICT (slug) DO UPDATE SET
    name = EXCLUDED.name,
    description = EXCLUDED.description,
    rules = EXCLUDED.rules,
    avatar_url = EXCLUDED.avatar_url,
    banner_url = EXCLUDED.banner_url;
