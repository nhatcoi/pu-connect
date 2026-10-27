-- Giảng viên phụ trách học phần (nền cho phân quyền theo môn). Idempotent.
CREATE TABLE IF NOT EXISTS course_lecturers (
    course_id UUID NOT NULL REFERENCES courses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    assigned_by UUID REFERENCES users(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    PRIMARY KEY (course_id, user_id)
);
CREATE INDEX IF NOT EXISTS idx_course_lecturers_user ON course_lecturers(user_id);
