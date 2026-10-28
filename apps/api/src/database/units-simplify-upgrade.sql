-- ==========================================================
-- Migration: Đơn giản hóa đơn vị — chỉ còn "Trường đại học" + "Lĩnh vực quan tâm" (idempotent)
-- Bỏ khoa / ngành / khóa / lớp: quá chi tiết, người dùng ngại điền. Môn học gắn theo lĩnh vực; tài liệu theo môn.
-- Người dùng chọn "Khác" + nhập tên ⇒ unit_requests (pending) ⇒ admin duyệt ⇒ cập nhật người dùng.
-- BƯỚC 1 (không phá hủy): chỉ thêm bảng/cột + chuyển dữ liệu. Cột/bảng cũ (faculties, users.faculty/major/class_name/
-- academic_year/unit_id, academic_units) giữ nguyên, code không còn đọc/ghi; DROP ở bước 2 sau khi xác nhận.
-- Chạy sau academic-units-upgrade.sql, academic-units-schools-only.sql, search-upgrade.sql (immutable_unaccent)
-- ==========================================================

CREATE TABLE IF NOT EXISTS universities (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_universities_name ON universities (lower(immutable_unaccent(name)));

CREATE TABLE IF NOT EXISTS interest_fields (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    code VARCHAR(60) UNIQUE NOT NULL,
    name VARCHAR(200) NOT NULL,
    sort_order INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_interest_fields_name ON interest_fields (lower(immutable_unaccent(name)));

-- Yêu cầu thêm đơn vị mới ("Khác" + tên tự nhập), chờ admin duyệt. Mỗi người tối đa 1 yêu cầu chờ cho mỗi loại.
CREATE TABLE IF NOT EXISTS unit_requests (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    kind VARCHAR(12) NOT NULL CHECK (kind IN ('university', 'field')),
    name VARCHAR(200) NOT NULL,
    status VARCHAR(12) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    resolved_id UUID,                          -- đơn vị được tạo / gộp vào khi duyệt
    reject_reason VARCHAR(300),
    reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL,
    reviewed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE UNIQUE INDEX IF NOT EXISTS uq_unit_requests_pending ON unit_requests (user_id, kind) WHERE status = 'pending';
CREATE INDEX IF NOT EXISTS idx_unit_requests_status ON unit_requests (status, created_at DESC);

ALTER TABLE users ADD COLUMN IF NOT EXISTS university_id UUID REFERENCES universities(id) ON DELETE SET NULL;
ALTER TABLE users ADD COLUMN IF NOT EXISTS interest_field_id UUID REFERENCES interest_fields(id) ON DELETE SET NULL;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS interest_field_id UUID REFERENCES interest_fields(id) ON DELETE SET NULL;
ALTER TABLE course_suggestions ADD COLUMN IF NOT EXISTS interest_field_id UUID REFERENCES interest_fields(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_users_university ON users (university_id) WHERE university_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_users_interest_field ON users (interest_field_id) WHERE interest_field_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_courses_interest_field ON courses (interest_field_id) WHERE interest_field_id IS NOT NULL;

-- Danh mục có sẵn (ON CONFLICT DO NOTHING ⇒ không ghi đè chỉnh sửa của admin)
INSERT INTO universities (code, name, sort_order) VALUES ('phenikaa', 'Trường Đại học Phenikaa', 10)
ON CONFLICT (code) DO NOTHING;

-- Lĩnh vực lấy lại mã từ các trường thành viên cũ (school-*) để chuyển dữ liệu đúng
INSERT INTO interest_fields (code, name, sort_order) VALUES
  ('school-it', 'Công nghệ thông tin', 10),
  ('school-digital', 'Công nghệ số liên ngành', 20),
  ('school-eng', 'Kỹ thuật', 30),
  ('school-econ', 'Kinh tế', 40),
  ('school-languages', 'Ngoại ngữ – Khoa học xã hội', 50),
  ('school-health', 'Y – Dược', 60),
  ('school-tourism', 'Du lịch', 70)
ON CONFLICT (code) DO NOTHING;

-- Chuyển dữ liệu cũ MỘT LẦN (đánh dấu): thêm lĩnh vực/đơn vị mới sau này không bị ghi đè lại
CREATE TABLE IF NOT EXISTS migration_marks (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
DECLARE
    -- Mã khoa cũ → lĩnh vực
    legacy CONSTANT TEXT[][] := ARRAY[
        ['FIT', 'school-it'], ['FCS', 'school-it'], ['FEE', 'school-eng'], ['FAE', 'school-eng'], ['FAS', 'school-eng'],
        ['FBA', 'school-econ'], ['FEL', 'school-languages'], ['FMS', 'school-health']
    ];
    i INT;
BEGIN
    IF EXISTS (SELECT 1 FROM migration_marks WHERE name = 'units-simplify-v1') THEN
        RETURN;
    END IF;

    -- Người dùng: lĩnh vực theo unit_id (trường thành viên cũ), rồi theo mã khoa cũ
    IF to_regclass('academic_units') IS NOT NULL THEN
        UPDATE users u SET interest_field_id = f.id
          FROM academic_units a JOIN interest_fields f ON f.code = a.code
         WHERE u.unit_id = a.id AND u.interest_field_id IS NULL;
    END IF;
    FOR i IN 1 .. array_length(legacy, 1) LOOP
        UPDATE users u SET interest_field_id = f.id
          FROM interest_fields f
         WHERE f.code = legacy[i][2] AND u.interest_field_id IS NULL AND upper(btrim(u.faculty)) = legacy[i][1];
        UPDATE courses c SET interest_field_id = f.id
          FROM interest_fields f
         WHERE f.code = legacy[i][2] AND c.interest_field_id IS NULL AND upper(btrim(c.faculty_code)) = legacy[i][1];
        UPDATE course_suggestions c SET interest_field_id = f.id
          FROM interest_fields f
         WHERE f.code = legacy[i][2] AND c.interest_field_id IS NULL AND upper(btrim(c.faculty_code)) = legacy[i][1];
    END LOOP;

    -- Trường: Phenikaa nếu đã chọn trường thành viên / ghi Phenikaa / email Phenikaa
    UPDATE users u SET university_id = (SELECT id FROM universities WHERE code = 'phenikaa')
     WHERE u.university_id IS NULL
       AND (u.unit_id IS NOT NULL OR u.school ILIKE '%phenikaa%' OR u.email ILIKE '%phenikaa%');

    -- Trường khác tự nhập (trước đây không ai duyệt) ⇒ đưa vào hàng chờ admin
    INSERT INTO unit_requests (user_id, kind, name)
    SELECT u.id, 'university', left(btrim(u.school), 200)
      FROM users u
     WHERE u.university_id IS NULL AND NOT u.is_bot AND btrim(COALESCE(u.school, '')) <> ''
    ON CONFLICT DO NOTHING;

    -- Thông báo nhắm theo đơn vị / khóa cũ (unitIds, years) không còn khớp được ai: hủy lịch gửi, tắt banner
    -- (nếu để nguyên, đối tượng rỗng sẽ biến chúng thành gửi cho mọi người)
    IF to_regclass('announcements') IS NOT NULL THEN
        UPDATE announcements SET status = 'cancelled'
         WHERE status = 'scheduled' AND (audience ? 'unitIds' OR audience ? 'years');
        UPDATE announcements SET banner = FALSE
         WHERE banner AND (audience ? 'unitIds' OR audience ? 'years');
    END IF;

    INSERT INTO migration_marks (name) VALUES ('units-simplify-v1');
END $$;

