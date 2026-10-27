-- ==========================================================
-- Migration: Cây đơn vị học thuật — idempotent, chạy mỗi lần deploy
-- Hiện chỉ seed cấp trường; khoa / ngành / viện / trung tâm do admin thêm sau (bảng vẫn hỗ trợ đủ cấp)
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
  ('school-tourism', 'school', 'Trường Du lịch Phenikaa', 'Du lịch', NULL, 690)
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
