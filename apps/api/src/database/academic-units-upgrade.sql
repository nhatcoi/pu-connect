-- ==========================================================
-- Migration: Cây đơn vị học thuật (trường → khoa → ngành, viện, trung tâm) — idempotent, chạy mỗi lần deploy
-- Thay danh sách cứng trong code: admin sửa được; users.unit_id trỏ vào đơn vị cụ thể nhất
-- ==========================================================

CREATE TABLE IF NOT EXISTS academic_units (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(60) UNIQUE NOT NULL,             -- khóa ổn định (seed: 'school-it', 'fac-cs'…), không đổi khi đổi tên
    parent_id UUID REFERENCES academic_units(id) ON DELETE RESTRICT,
    type VARCHAR(12) NOT NULL CHECK (type IN ('school', 'faculty', 'major', 'institute', 'center')),
    name VARCHAR(200) NOT NULL,
    short_name VARCHAR(40),                       -- hiển thị gọn (CNTT, KHMT, MKT…), thay mã cũ FIT/FCS/FBA
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_academic_units_parent ON academic_units (parent_id, sort_order);
CREATE UNIQUE INDEX IF NOT EXISTS idx_academic_units_name ON academic_units (COALESCE(parent_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

-- Seed từ danh mục Phenikaa (ON CONFLICT DO NOTHING ⇒ không ghi đè chỉnh sửa của admin)
-- Chèn theo từng cấp (cha trước con): subquery tìm cha không thấy dòng cùng câu lệnh
INSERT INTO academic_units (code, type, name, short_name, parent_id, sort_order) VALUES
  ('school-it', 'school', 'Trường Công nghệ thông tin Phenikaa', 'CNTT', NULL, 10),
  ('school-eng', 'school', 'Trường Kỹ thuật Phenikaa', 'Kỹ thuật', NULL, 120),
  ('school-econ', 'school', 'Trường Kinh tế Phenikaa', 'Kinh tế', NULL, 280),
  ('school-languages', 'school', 'Trường Ngoại ngữ – Khoa học Xã hội Phenikaa', 'NN&KHXH', NULL, 380),
  ('school-health', 'school', 'Trường Y – Dược Phenikaa', 'Y Dược', NULL, 490),
  ('school-digital', 'school', 'Trường Công nghệ số liên ngành Phenikaa', 'CNSLN', NULL, 620),
  ('school-tourism', 'school', 'Trường Du lịch Phenikaa', 'Du lịch', NULL, 690),
  ('fac-law', 'faculty', 'Khoa Luật', 'Luật', NULL, 750),
  ('fac-basic-sci', 'faculty', 'Khoa Khoa học cơ bản', 'KHCB', NULL, 780),
  ('inst-pias', 'institute', 'Viện Nghiên cứu tiên tiến Phenikaa', 'PIAS', NULL, 790),
  ('inst-nano', 'institute', 'Viện Nghiên cứu Nano', 'PHENA', NULL, 800),
  ('inst-prati', 'institute', 'Viện Nghiên cứu Công nghệ Phenikaa', 'PRATI', NULL, 810),
  ('center-it', 'center', 'Trung tâm Công nghệ thông tin', 'TT CNTT', NULL, 820),
  ('center-languages-skills', 'center', 'Trung tâm Ngoại ngữ, Tin học & Kỹ năng', 'TT NN&TH', NULL, 830),
  ('center-isr', 'center', 'Trung tâm Nghiên cứu Xã hội liên ngành (ISR)', 'TT ISR', NULL, 840),
  ('center-gene', 'center', 'Trung tâm Nghiên cứu Nguồn gen', 'TT Nguồn gen', NULL, 850)
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_units (code, type, name, short_name, parent_id, sort_order) VALUES
  ('fac-cs', 'faculty', 'Khoa Khoa học máy tính', 'KHMT', (SELECT id FROM academic_units WHERE code = 'school-it'), 20),
  ('fac-is', 'faculty', 'Khoa Hệ thống thông tin', 'HTTT', (SELECT id FROM academic_units WHERE code = 'school-it'), 60),
  ('fac-ai-ds', 'faculty', 'Khoa Trí tuệ nhân tạo & Khoa học dữ liệu', 'AI&DS', (SELECT id FROM academic_units WHERE code = 'school-it'), 90),
  ('fac-bio-chem-env', 'faculty', 'Khoa Công nghệ sinh học, Hóa học & Kỹ thuật môi trường', 'CNSH-HH-MT', (SELECT id FROM academic_units WHERE code = 'school-eng'), 130),
  ('fac-ee', 'faculty', 'Khoa Điện - Điện tử', 'ĐĐT', (SELECT id FROM academic_units WHERE code = 'school-eng'), 160),
  ('fac-mech', 'faculty', 'Khoa Cơ khí - Cơ điện tử', 'CK-CĐT', (SELECT id FROM academic_units WHERE code = 'school-eng'), 200),
  ('fac-materials', 'faculty', 'Khoa Khoa học & Kỹ thuật vật liệu', 'Vật liệu', (SELECT id FROM academic_units WHERE code = 'school-eng'), 230),
  ('fac-automotive', 'faculty', 'Khoa Kỹ thuật Ô tô & Năng lượng', 'Ô tô-NL', (SELECT id FROM academic_units WHERE code = 'school-eng'), 250),
  ('fac-ba', 'faculty', 'Khoa Quản trị kinh doanh', 'QTKD', (SELECT id FROM academic_units WHERE code = 'school-econ'), 290),
  ('fac-ib', 'faculty', 'Khoa Kinh tế & Kinh doanh quốc tế', 'KT&KDQT', (SELECT id FROM academic_units WHERE code = 'school-econ'), 320),
  ('fac-fa', 'faculty', 'Khoa Tài chính - Kế toán', 'TC-KT', (SELECT id FROM academic_units WHERE code = 'school-econ'), 350),
  ('fac-english', 'faculty', 'Khoa Ngôn ngữ Anh', 'NN Anh', (SELECT id FROM academic_units WHERE code = 'school-languages'), 390),
  ('fac-chinese', 'faculty', 'Khoa Ngôn ngữ Trung Quốc', 'NN Trung', (SELECT id FROM academic_units WHERE code = 'school-languages'), 410),
  ('fac-korean', 'faculty', 'Khoa Ngôn ngữ Hàn Quốc', 'NN Hàn', (SELECT id FROM academic_units WHERE code = 'school-languages'), 430),
  ('fac-japanese', 'faculty', 'Khoa Ngôn ngữ Nhật Bản', 'NN Nhật', (SELECT id FROM academic_units WHERE code = 'school-languages'), 450),
  ('fac-french', 'faculty', 'Khoa Ngôn ngữ Pháp', 'NN Pháp', (SELECT id FROM academic_units WHERE code = 'school-languages'), 470),
  ('fac-oriental', 'faculty', 'Khoa Đông phương học', 'Đông phương', (SELECT id FROM academic_units WHERE code = 'school-languages'), 480),
  ('fac-medicine', 'faculty', 'Khoa Y', 'Y', (SELECT id FROM academic_units WHERE code = 'school-health'), 500),
  ('fac-dentistry', 'faculty', 'Khoa Răng Hàm Mặt', 'RHM', (SELECT id FROM academic_units WHERE code = 'school-health'), 520),
  ('fac-pharmacy', 'faculty', 'Khoa Dược', 'Dược', (SELECT id FROM academic_units WHERE code = 'school-health'), 540),
  ('fac-nursing', 'faculty', 'Khoa Điều dưỡng', 'Điều dưỡng', (SELECT id FROM academic_units WHERE code = 'school-health'), 560),
  ('fac-med-tech', 'faculty', 'Khoa Kỹ thuật Y học', 'KTYH', (SELECT id FROM academic_units WHERE code = 'school-health'), 580),
  ('fac-biomed', 'faculty', 'Khoa Khoa học Y sinh', 'KHYS', (SELECT id FROM academic_units WHERE code = 'school-health'), 590),
  ('fac-public-health', 'faculty', 'Khoa Y tế công cộng', 'YTCC', (SELECT id FROM academic_units WHERE code = 'school-health'), 600),
  ('fac-traditional-med', 'faculty', 'Khoa Y học cổ truyền', 'YHCT', (SELECT id FROM academic_units WHERE code = 'school-health'), 610),
  ('fac-fintech', 'faculty', 'Khoa Kinh doanh & Tài chính số', 'KD&TCS', (SELECT id FROM academic_units WHERE code = 'school-digital'), 630),
  ('fac-ecom', 'faculty', 'Khoa Thương mại điện tử & Công nghệ số', 'TMĐT', (SELECT id FROM academic_units WHERE code = 'school-digital'), 650),
  ('fac-dig-media', 'faculty', 'Khoa Truyền thông số', 'TTS', (SELECT id FROM academic_units WHERE code = 'school-digital'), 670),
  ('fac-tourism-mgt', 'faculty', 'Khoa Quản trị Du lịch – Lữ hành', 'QTDL', (SELECT id FROM academic_units WHERE code = 'school-tourism'), 700),
  ('fac-hotel-mgt', 'faculty', 'Khoa Quản trị Khách sạn – Nhà hàng', 'QTKS', (SELECT id FROM academic_units WHERE code = 'school-tourism'), 720),
  ('fac-cul-tourism', 'faculty', 'Khoa Du lịch văn hóa & Cơ sở ngành', 'DLVH', (SELECT id FROM academic_units WHERE code = 'school-tourism'), 740),
  ('maj-law-econ', 'major', 'Luật kinh tế', NULL, (SELECT id FROM academic_units WHERE code = 'fac-law'), 760),
  ('maj-law', 'major', 'Luật học', NULL, (SELECT id FROM academic_units WHERE code = 'fac-law'), 770)
ON CONFLICT (code) DO NOTHING;

INSERT INTO academic_units (code, type, name, short_name, parent_id, sort_order) VALUES
  ('maj-cs', 'major', 'Khoa học máy tính', NULL, (SELECT id FROM academic_units WHERE code = 'fac-cs'), 30),
  ('maj-se', 'major', 'Kỹ thuật phần mềm', NULL, (SELECT id FROM academic_units WHERE code = 'fac-cs'), 40),
  ('maj-ce', 'major', 'Kỹ thuật máy tính', NULL, (SELECT id FROM academic_units WHERE code = 'fac-cs'), 50),
  ('maj-is', 'major', 'Hệ thống thông tin', NULL, (SELECT id FROM academic_units WHERE code = 'fac-is'), 70),
  ('maj-net-sec', 'major', 'Mạng máy tính & An toàn thông tin', NULL, (SELECT id FROM academic_units WHERE code = 'fac-is'), 80),
  ('maj-ai', 'major', 'Trí tuệ nhân tạo', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ai-ds'), 100),
  ('maj-ds', 'major', 'Khoa học dữ liệu', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ai-ds'), 110),
  ('maj-biotech', 'major', 'Công nghệ sinh học', NULL, (SELECT id FROM academic_units WHERE code = 'fac-bio-chem-env'), 140),
  ('maj-chem-env', 'major', 'Kỹ thuật Hóa học & Môi trường', NULL, (SELECT id FROM academic_units WHERE code = 'fac-bio-chem-env'), 150),
  ('maj-ee', 'major', 'Kỹ thuật Điện', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ee'), 170),
  ('maj-ece', 'major', 'Kỹ thuật Điện tử - Viễn thông', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ee'), 180),
  ('maj-auto', 'major', 'Kỹ thuật Điều khiển & Tự động hóa', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ee'), 190),
  ('maj-mech', 'major', 'Kỹ thuật Cơ khí', NULL, (SELECT id FROM academic_units WHERE code = 'fac-mech'), 210),
  ('maj-mechatronics', 'major', 'Kỹ thuật Cơ điện tử', NULL, (SELECT id FROM academic_units WHERE code = 'fac-mech'), 220),
  ('maj-materials', 'major', 'Kỹ thuật Vật liệu', NULL, (SELECT id FROM academic_units WHERE code = 'fac-materials'), 240),
  ('maj-automotive', 'major', 'Kỹ thuật Ô tô', NULL, (SELECT id FROM academic_units WHERE code = 'fac-automotive'), 260),
  ('maj-energy', 'major', 'Kỹ thuật Năng lượng', NULL, (SELECT id FROM academic_units WHERE code = 'fac-automotive'), 270),
  ('maj-ba', 'major', 'Quản trị kinh doanh', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ba'), 300),
  ('maj-mkt', 'major', 'Marketing', 'MKT', (SELECT id FROM academic_units WHERE code = 'fac-ba'), 310),
  ('maj-ib', 'major', 'Kinh doanh quốc tế', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ib'), 330),
  ('maj-logistics', 'major', 'Logistics & Quản lý chuỗi cung ứng', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ib'), 340),
  ('maj-finance', 'major', 'Tài chính - Ngân hàng', NULL, (SELECT id FROM academic_units WHERE code = 'fac-fa'), 360),
  ('maj-accounting', 'major', 'Kế toán - Kiểm toán', NULL, (SELECT id FROM academic_units WHERE code = 'fac-fa'), 370),
  ('maj-english', 'major', 'Ngôn ngữ Anh', NULL, (SELECT id FROM academic_units WHERE code = 'fac-english'), 400),
  ('maj-chinese', 'major', 'Ngôn ngữ Trung Quốc', NULL, (SELECT id FROM academic_units WHERE code = 'fac-chinese'), 420),
  ('maj-korean', 'major', 'Ngôn ngữ Hàn Quốc', NULL, (SELECT id FROM academic_units WHERE code = 'fac-korean'), 440),
  ('maj-japanese', 'major', 'Ngôn ngữ Nhật Bản', NULL, (SELECT id FROM academic_units WHERE code = 'fac-japanese'), 460),
  ('maj-medicine', 'major', 'Y khoa', NULL, (SELECT id FROM academic_units WHERE code = 'fac-medicine'), 510),
  ('maj-dentistry', 'major', 'Răng - Hàm - Mặt', NULL, (SELECT id FROM academic_units WHERE code = 'fac-dentistry'), 530),
  ('maj-pharmacy', 'major', 'Dược học', NULL, (SELECT id FROM academic_units WHERE code = 'fac-pharmacy'), 550),
  ('maj-nursing', 'major', 'Điều dưỡng', NULL, (SELECT id FROM academic_units WHERE code = 'fac-nursing'), 570),
  ('maj-fintech', 'major', 'Công nghệ tài chính (Fintech)', NULL, (SELECT id FROM academic_units WHERE code = 'fac-fintech'), 640),
  ('maj-ecom', 'major', 'Thương mại điện tử', NULL, (SELECT id FROM academic_units WHERE code = 'fac-ecom'), 660),
  ('maj-dig-media', 'major', 'Truyền thông đa phương tiện', NULL, (SELECT id FROM academic_units WHERE code = 'fac-dig-media'), 680),
  ('maj-tourism', 'major', 'Quản trị Dịch vụ du lịch & Lữ hành', NULL, (SELECT id FROM academic_units WHERE code = 'fac-tourism-mgt'), 710),
  ('maj-hotel', 'major', 'Quản trị Khách sạn', NULL, (SELECT id FROM academic_units WHERE code = 'fac-hotel-mgt'), 730)
ON CONFLICT (code) DO NOTHING;

-- Người dùng trỏ vào đơn vị cụ thể nhất (ngành > khoa > trường)
ALTER TABLE users ADD COLUMN IF NOT EXISTS unit_id UUID REFERENCES academic_units(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_unit ON users (unit_id) WHERE unit_id IS NOT NULL;

-- Tên trường / khoa / ngành suy ra từ cây (đi ngược tối đa 3 cấp)
CREATE OR REPLACE VIEW academic_unit_paths AS
SELECT u.id,
       COALESCE(CASE WHEN u.type = 'school' THEN u.name END,
                CASE WHEN p1.type = 'school' THEN p1.name END,
                CASE WHEN p2.type = 'school' THEN p2.name END) AS school,
       COALESCE(CASE WHEN u.type IN ('faculty', 'institute', 'center') THEN COALESCE(u.short_name, u.name) END,
                CASE WHEN p1.type IN ('faculty', 'institute', 'center') THEN COALESCE(p1.short_name, p1.name) END,
                CASE WHEN p2.type IN ('faculty', 'institute', 'center') THEN COALESCE(p2.short_name, p2.name) END,
                CASE WHEN u.type = 'school' THEN COALESCE(u.short_name, u.name) END) AS faculty,
       CASE WHEN u.type = 'major' THEN u.name END AS major
FROM academic_units u
LEFT JOIN academic_units p1 ON p1.id = u.parent_id
LEFT JOIN academic_units p2 ON p2.id = p1.parent_id;

-- Gán đơn vị cho dữ liệu cũ (chỉ dòng chưa có unit_id): ngành > khoa (tên) > mã cũ FIT/FCS/FBA… > trường
UPDATE users u SET unit_id = a.id FROM academic_units a
 WHERE u.unit_id IS NULL AND a.type = 'major' AND u.major IS NOT NULL
   AND immutable_unaccent(lower(btrim(u.major))) = immutable_unaccent(lower(a.name));

UPDATE users u SET unit_id = a.id FROM academic_units a
 WHERE u.unit_id IS NULL AND a.type IN ('faculty', 'institute', 'center') AND u.faculty IS NOT NULL
   AND immutable_unaccent(lower(btrim(u.faculty))) IN (immutable_unaccent(lower(a.name)), immutable_unaccent(lower(COALESCE(a.short_name, a.name))));

UPDATE users u SET unit_id = a.id
  FROM (VALUES ('FIT', 'school-it'), ('FCS', 'fac-cs'), ('FEE', 'fac-ee'), ('FAE', 'fac-automotive'), ('FBA', 'fac-ba'),
               ('FEL', 'school-languages'), ('FMS', 'school-health'), ('FAS', 'fac-materials')) AS m(legacy, code)
  JOIN academic_units a ON a.code = m.code
 WHERE u.unit_id IS NULL AND upper(btrim(u.faculty)) = m.legacy;

UPDATE users u SET unit_id = a.id FROM academic_units a
 WHERE u.unit_id IS NULL AND a.type = 'school' AND u.school IS NOT NULL
   AND immutable_unaccent(lower(btrim(u.school))) IN (immutable_unaccent(lower(a.name)), immutable_unaccent(lower(COALESCE(a.short_name, a.name))));

-- Đồng bộ cột chữ (hiển thị) theo cây: khoa = tên viết tắt (CNTT, KHMT…); ngành giữ nguyên khi đơn vị không phải ngành
UPDATE users u SET school = p.school, faculty = p.faculty, major = COALESCE(p.major, u.major)
  FROM academic_unit_paths p
 WHERE u.unit_id = p.id
   AND (u.school IS DISTINCT FROM p.school OR u.faculty IS DISTINCT FROM p.faculty OR u.major IS DISTINCT FROM COALESCE(p.major, u.major));
