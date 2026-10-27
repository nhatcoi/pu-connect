-- ==========================================================
-- Migration (chạy MỘT LẦN, có đánh dấu): chỉ giữ đơn vị cấp trường, bỏ khoa / ngành / viện / trung tâm
-- Người dùng đang gắn khoa/ngành ⇒ chuyển về trường cha. Thêm đơn vị mới sau này qua Admin không bị xóa lại
-- (đánh dấu ở migration_marks). Dòng bị xóa nằm trong thùng rác (trash-upgrade.sql) 30 ngày ⇒ khôi phục được.
-- Chạy sau academic-units-upgrade.sql và trash-upgrade.sql
-- ==========================================================

CREATE TABLE IF NOT EXISTS migration_marks (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM migration_marks WHERE name = 'academic-units-schools-only') THEN
        RETURN;
    END IF;

    -- users.unit_id: đi ngược lên trường cha (khoa/ngành mồ côi không có trường ⇒ unit_id tự về NULL khi xóa)
    WITH RECURSIVE up AS (
        SELECT id AS start_id, id, parent_id, type FROM academic_units
        UNION ALL
        SELECT up.start_id, a.id, a.parent_id, a.type FROM up JOIN academic_units a ON a.id = up.parent_id WHERE up.type <> 'school'
    )
    UPDATE users u SET unit_id = up.id
      FROM up
     WHERE u.unit_id = up.start_id AND up.type = 'school' AND up.start_id <> up.id;

    -- Xóa từ lá lên gốc (parent_id ON DELETE RESTRICT)
    LOOP
        DELETE FROM academic_units a
         WHERE a.type <> 'school' AND NOT EXISTS (SELECT 1 FROM academic_units c WHERE c.parent_id = a.id);
        EXIT WHEN NOT FOUND;
    END LOOP;

    INSERT INTO migration_marks (name) VALUES ('academic-units-schools-only');
END $$;
