-- ==========================================================
-- Seed: 2 môn đồ án dùng chung mọi ngành (idempotent)
-- Đồ án chuyên ngành (DACN) + Đồ án liên ngành (DALN); không gắn khoa để mọi ngành chọn được
-- Chạy lại ⇒ không ghi đè (admin có thể sửa tên / số tín chỉ / gán khoa)
-- ==========================================================

INSERT INTO courses (code, name, credits, description)
VALUES
  ('DACN', 'Đồ án chuyên ngành', 3, 'Đồ án thực hiện theo chuyên ngành đào tạo; báo cáo, mã nguồn và slide bảo vệ.'),
  ('DALN', 'Đồ án liên ngành', 3, 'Đồ án phối hợp nhiều ngành; báo cáo tổng hợp, sản phẩm và slide bảo vệ.')
ON CONFLICT (code) DO NOTHING;
