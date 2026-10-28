-- ==========================================================
-- Migration: BƯỚC 2 của "đơn vị chỉ còn Trường đại học + Lĩnh vực quan tâm" — xóa hẳn bảng / cột khoa, ngành, lớp, khóa cũ (idempotent)
-- Dữ liệu đã được chuyển sang universities / interest_fields / unit_requests ở units-simplify-upgrade.sql (bước 1).
-- Không dùng CASCADE: còn phụ thuộc bất ngờ (view, khóa ngoại…) thì lỗi to thay vì xóa lặng lẽ.
-- Chạy SAU units-simplify-upgrade.sql và mọi migration khác.
-- ==========================================================

DROP VIEW IF EXISTS academic_unit_paths;

-- users: trường, khoa, ngành, lớp, khóa, đơn vị cũ (index trên cột tự bị xóa theo)
ALTER TABLE users DROP COLUMN IF EXISTS unit_id;
ALTER TABLE users DROP COLUMN IF EXISTS school;
ALTER TABLE users DROP COLUMN IF EXISTS faculty;
ALTER TABLE users DROP COLUMN IF EXISTS major;
ALTER TABLE users DROP COLUMN IF EXISTS class_name;
ALTER TABLE users DROP COLUMN IF EXISTS academic_year;

-- môn học / đề xuất môn: khoa cũ (môn học đã gắn theo interest_field_id)
ALTER TABLE courses DROP COLUMN IF EXISTS faculty_id;
ALTER TABLE courses DROP COLUMN IF EXISTS faculty_code;
ALTER TABLE course_suggestions DROP COLUMN IF EXISTS faculty_code;
ALTER TABLE bot_profiles DROP COLUMN IF EXISTS major;

DROP TABLE IF EXISTS academic_units;
DROP TABLE IF EXISTS faculties;
