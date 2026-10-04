-- ============================================================================
-- Search chuẩn: full-text (bỏ dấu tiếng Việt) + trigram (chịu gõ sai) + log truy vấn
-- Idempotent: an toàn chạy lại mỗi lần deploy. Không đụng dữ liệu người dùng.
-- ============================================================================
CREATE EXTENSION IF NOT EXISTS unaccent;
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- unaccent gốc là STABLE ⇒ bọc IMMUTABLE để dùng cho cột generated & index
CREATE OR REPLACE FUNCTION immutable_unaccent(text) RETURNS text AS
$$ SELECT public.unaccent('public.unaccent'::regdictionary, $1) $$
LANGUAGE sql IMMUTABLE PARALLEL SAFE STRICT;

CREATE OR REPLACE FUNCTION immutable_join(text[]) RETURNS text AS
$$ SELECT array_to_string($1, ' ') $$
LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- tsvector 3 mức trọng số: A (tiêu đề/mã) > B (mô tả/nội dung) > C (tag/kỹ năng)
-- Config 'simple' + unaccent: "Tài liệu" và "tai lieu" cùng token "tai", "lieu"
CREATE OR REPLACE FUNCTION search_vec(a text, b text, c text) RETURNS tsvector AS
$$
  SELECT setweight(to_tsvector('simple', public.unaccent('public.unaccent'::regdictionary, coalesce(a, ''))), 'A')
      || setweight(to_tsvector('simple', public.unaccent('public.unaccent'::regdictionary, coalesce(b, ''))), 'B')
      || setweight(to_tsvector('simple', public.unaccent('public.unaccent'::regdictionary, coalesce(c, ''))), 'C')
$$ LANGUAGE sql IMMUTABLE PARALLEL SAFE;

-- Cột tìm kiếm (generated, tự cập nhật khi sửa dữ liệu)
ALTER TABLE posts ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (search_vec(title, left(content, 100000), immutable_join(tags))) STORED;
ALTER TABLE documents ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (search_vec(title, description, immutable_join(tags))) STORED;
ALTER TABLE courses ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (search_vec(coalesce(code, '') || ' ' || coalesce(name, ''), description, '')) STORED;
ALTER TABLE users ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (search_vec(
    coalesce(username, '') || ' ' || coalesce(display_name, '') || ' ' || coalesce(student_id, ''),
    bio,
    immutable_join(skills) || ' ' || immutable_join(interests)
  )) STORED;
ALTER TABLE study_groups ADD COLUMN IF NOT EXISTS search_tsv tsvector
  GENERATED ALWAYS AS (search_vec(
    coalesce(name, '') || ' ' || coalesce(course_code, ''),
    coalesce(topic, '') || ' ' || coalesce(course_name, '') || ' ' || coalesce(description, ''),
    immutable_join(tech_stack)
  )) STORED;

CREATE INDEX IF NOT EXISTS idx_posts_search ON posts USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_documents_search ON documents USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_courses_search ON courses USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_users_search ON users USING gin (search_tsv);
CREATE INDEX IF NOT EXISTS idx_study_groups_search ON study_groups USING gin (search_tsv);

-- Trigram trên trường ngắn: bắt lỗi gõ sai ("pyhton", "tai lieu on tp")
CREATE INDEX IF NOT EXISTS idx_posts_title_trgm ON posts USING gin (immutable_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_documents_title_trgm ON documents USING gin (immutable_unaccent(lower(title)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_name_trgm ON courses USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_courses_code_trgm ON courses USING gin (immutable_unaccent(lower(code)) gin_trgm_ops);
-- Người dùng: gộp tên hiển thị + username để bắt gõ sai cả hai
DROP INDEX IF EXISTS idx_users_username_trgm;
DROP INDEX IF EXISTS idx_users_display_name_trgm;
CREATE INDEX IF NOT EXISTS idx_users_name_trgm ON users USING gin (immutable_unaccent(lower(display_name || ' ' || username)) gin_trgm_ops);
CREATE INDEX IF NOT EXISTS idx_study_groups_name_trgm ON study_groups USING gin (immutable_unaccent(lower(name)) gin_trgm_ops);

-- Log truy vấn (không lưu user): tìm "từ khóa không có kết quả" & từ khóa phổ biến
CREATE TABLE IF NOT EXISTS search_logs (
    id BIGSERIAL PRIMARY KEY,
    q_norm VARCHAR(100) NOT NULL,
    search_type VARCHAR(20) NOT NULL DEFAULT 'all',
    result_count INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_search_logs_created ON search_logs(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_search_logs_q ON search_logs(q_norm);
