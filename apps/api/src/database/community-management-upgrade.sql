-- Quản lý cộng đồng: người dùng tạo (chờ admin duyệt), chủ sở hữu + điều hành viên — idempotent
-- Community management: user-created (pending admin review), owner + moderators.

ALTER TABLE communities ADD COLUMN IF NOT EXISTS created_by UUID REFERENCES users(id) ON DELETE SET NULL;
-- active: hiển thị công khai · pending: chờ admin duyệt (chỉ chủ thấy) · rejected: bị từ chối
ALTER TABLE communities ADD COLUMN IF NOT EXISTS status VARCHAR(20) NOT NULL DEFAULT 'active';
ALTER TABLE communities ADD COLUMN IF NOT EXISTS review_note TEXT;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS reviewed_by UUID REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE communities ADD COLUMN IF NOT EXISTS reviewed_at TIMESTAMPTZ;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'communities_status_check') THEN
    ALTER TABLE communities ADD CONSTRAINT communities_status_check CHECK (status IN ('active', 'pending', 'rejected'));
  END IF;
END $$;

-- Vai trò thành viên: owner · moderator · member (vai trò 'admin' cũ → owner)
UPDATE community_members SET role = 'owner' WHERE role = 'admin';

-- Mỗi cộng đồng tối đa một chủ sở hữu
CREATE UNIQUE INDEX IF NOT EXISTS uq_community_one_owner ON community_members (community_id) WHERE role = 'owner';
CREATE INDEX IF NOT EXISTS idx_communities_status ON communities (status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_communities_created_by ON communities (created_by) WHERE created_by IS NOT NULL;
