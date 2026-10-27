-- ==========================================================
-- Migration: Đề xuất môn học — người dùng gợi ý môn còn thiếu, admin duyệt (idempotent)
-- Duyệt ⇒ tạo môn thật (course_id trỏ tới môn đó); từ chối ⇒ giữ lý do để người đề xuất xem
-- ==========================================================

CREATE TABLE IF NOT EXISTS course_suggestions (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    requester_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    code VARCHAR(20),
    faculty_code VARCHAR(30),
    credits INT CHECK (credits BETWEEN 1 AND 15),
    note VARCHAR(500),
    status VARCHAR(10) NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
    review_note VARCHAR(500),
    reviewer_id UUID REFERENCES users(id) ON DELETE SET NULL,
    course_id UUID REFERENCES courses(id) ON DELETE SET NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    reviewed_at TIMESTAMPTZ
);
CREATE INDEX IF NOT EXISTS idx_course_suggestions_status ON course_suggestions(status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_course_suggestions_requester ON course_suggestions(requester_id, created_at DESC);
