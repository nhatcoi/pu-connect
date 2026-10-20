-- Lịch sử làm quiz: số câu đúng / tổng / thời gian trên nhật ký study_events (lần làm cũ: NULL)
-- Quiz attempt history: correct / total / duration on the study_events log
ALTER TABLE study_events ADD COLUMN IF NOT EXISTS correct SMALLINT;
ALTER TABLE study_events ADD COLUMN IF NOT EXISTS total SMALLINT;
ALTER TABLE study_events ADD COLUMN IF NOT EXISTS duration_seconds INTEGER;

-- GET tools/sets/:id/attempts: các lần làm gần nhất của 1 bộ
CREATE INDEX IF NOT EXISTS idx_study_events_set_attempts ON study_events (set_id, created_at DESC) WHERE event = 'attempt';
