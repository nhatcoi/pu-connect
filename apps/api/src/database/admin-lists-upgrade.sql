-- ==========================================================
-- Migration: Danh sách admin phân trang server (idempotent, chạy mỗi lần deploy)
-- Kiểm duyệt · Học thuật · Skills · Nhật ký: sắp xếp + lọc + đếm nhanh
-- ==========================================================

-- 1. Sắp xếp mới nhất (ORDER BY created_at DESC LIMIT n dùng index, dừng sớm)
CREATE INDEX IF NOT EXISTS idx_posts_created ON posts (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_posts_hidden ON posts (hidden_at DESC) WHERE hidden_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_comments_created ON comments (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_created ON documents (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_documents_owner ON documents (owner_id);

-- 2. Đếm đoạn RAG theo tài liệu (trước: quét toàn bảng document_chunks cho mỗi dòng)
CREATE INDEX IF NOT EXISTS idx_document_chunks_document ON document_chunks (document_id);

-- 3. Tìm bình luận không dấu (bình luận không có search_tsv)
CREATE INDEX IF NOT EXISTS idx_comments_content_trgm ON comments USING gin (immutable_unaccent(lower(content)) gin_trgm_ops);

-- 4. Báo cáo theo lý do
CREATE INDEX IF NOT EXISTS idx_post_reports_post_reason ON post_reports (post_id, reason);

-- 5. Nhật ký: lọc theo thao tác / người thực hiện
CREATE INDEX IF NOT EXISTS idx_admin_audit_action ON admin_audit_logs (action, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_admin ON admin_audit_logs (admin_id, created_at DESC);
