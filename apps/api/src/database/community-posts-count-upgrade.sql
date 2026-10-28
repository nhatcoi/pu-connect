-- communities.posts_count tự đúng: trigger đếm lại khi bài vào / rời cộng đồng, bị ẩn hoặc lưu trữ — idempotent
-- Keep communities.posts_count accurate (was seed-only): recount on insert / delete / community change / hide / archive.
-- Đếm khớp bảng tin cộng đồng: chưa ẩn, chưa lưu trữ.

CREATE OR REPLACE FUNCTION sync_community_posts_count() RETURNS trigger AS $$
DECLARE
  cid UUID;
BEGIN
  FOR cid IN
    SELECT DISTINCT x FROM unnest(ARRAY[
      CASE WHEN TG_OP <> 'INSERT' THEN OLD.community_id END,
      CASE WHEN TG_OP <> 'DELETE' THEN NEW.community_id END
    ]) AS x WHERE x IS NOT NULL
  LOOP
    UPDATE communities
       SET posts_count = (SELECT COUNT(*) FROM posts WHERE community_id = cid AND hidden_at IS NULL AND archived_at IS NULL)
     WHERE id = cid;
  END LOOP;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_community_posts_count ON posts;
CREATE TRIGGER trg_community_posts_count
  AFTER INSERT OR DELETE OR UPDATE OF community_id, hidden_at, archived_at ON posts
  FOR EACH ROW EXECUTE FUNCTION sync_community_posts_count();

-- Tính lại số seed cho khớp dữ liệu thật
UPDATE communities c
   SET posts_count = (SELECT COUNT(*) FROM posts p WHERE p.community_id = c.id AND p.hidden_at IS NULL AND p.archived_at IS NULL);
