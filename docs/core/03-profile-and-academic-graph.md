# 👤 Đặc Tả Chi Tiết: Hồ Sơ Sinh Viên & Mạng Lưới Học Thuật (Profile & Social Graph)

---

## 1. Cấu Trúc Hồ Sơ Học Thuật (Academic Student Profile)

Hồ sơ cá nhân trên PU Connect được chuẩn hóa để phản ánh đầy đủ năng lực, chuyên môn và quá trình học tập của sinh viên tại Trường Đại học Phenikaa.

### 1.1. Các Trường Dữ Liệu Cốt Lõi (`users` Table)
* **Định danh cơ bản:** `id (UUID)`, `email (edu mail)`, `username`, `display_name`, `avatar_url`, `bio`.
* **Cây định danh học thuật:**
  * `student_id`: Mã số sinh viên (ví dụ: `22010123`).
  * `university_id` → `universities`: trường đại học (có sẵn Phenikaa; email trường tự chọn). Chọn **"Khác"** + nhập tên ⇒ bản ghi `unit_requests` chờ admin duyệt; trong lúc chờ hồ sơ hiện **"Khác"**.
  * `interest_field_id` → `interest_fields`: **lĩnh vực quan tâm** (Công nghệ thông tin, Kỹ thuật, Kinh tế, Ngoại ngữ – KHXH, Y – Dược, Công nghệ số liên ngành, Du lịch…; admin thêm được). Cùng cơ chế "Khác" + duyệt. Môn học (`courses.interest_field_id`) và tài liệu (qua môn) gắn theo lĩnh vực này.
  * **Không còn** khoa / ngành / khóa / lớp: quá chi tiết nên người dùng ngại điền (2026-10-28). Cột cũ `faculty`, `major`, `class_name`, `academic_year`, `school`, `unit_id` và bảng `faculties`, `academic_units` còn trong DB nhưng code không đọc/ghi (bước 2 sẽ DROP sau khi xác nhận).
  * `role`: Phân quyền RBAC (`student`, `lecturer`, `ta`, `club_lead`, `admin`).
* **Hồ sơ năng lực & Sở thích:**
  * `skills (TEXT[])`: Mảng kỹ năng chuyên môn (`React Native`, `NestJS`, `Python AI`, `PostgreSQL`...).
  * `interests (TEXT[])`: Mảng lĩnh vực học thuật quan tâm (`Trí tuệ nhân tạo`, `An toàn thông tin`, `Kỹ thuật phần mềm`...).
  * `reputation_points (INT)`: Tổng điểm uy tín tích lũy từ đóng góp học thuật.

---

## 2. Hệ Thống Theo Dõi & Mạng Lưới Kết Nối (`user_follows`)

Quan hệ kết nối giữa các sinh viên, giảng viên và cố vấn học tập được xây dựng trên bảng quan hệ nhiều - nhiều:

```sql
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id != following_id)
);

CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
```

### 2.1. Logic Vận Hành
* **Đa chiều:** Người dùng A có thể theo dõi người dùng B mà không cần B đồng ý (mô hình Follower/Following chuẩn X/Twitter).
* **Ưu tiên bảng tin:** Bài viết của người được follow tự động nhận trọng số $+35.0$ điểm trong thuật toán xếp hạng Feed của người theo dõi.
* **Đếm số lượng tức thời:**
  * `followers_count = SELECT COUNT(*) FROM user_follows WHERE following_id = $userId`
  * `following_count = SELECT COUNT(*) FROM user_follows WHERE follower_id = $userId`

---

## 3. Cơ Chế Nhắc Tên Người Dùng (Mention `@username`)

### 3.1. Soạn Thảo & Gợi Ý Trực Tiếp
* Khi người dùng gõ ký tự `@` trong trình soạn thảo bài viết hoặc bình luận, hệ thống kích hoạt **Mention Autocomplete Popover**.
* Gợi ý nhanh danh sách bạn bè, người cùng lớp, giảng viên bộ môn khớp với tiền tố vừa gõ.

### 3.2. Phân Tích Cú Pháp & Bắn Sự Kiện Thông Báo
* Khi bài viết/bình luận được lưu thành công, backend thực hiện Regex trích xuất `@([a-zA-Z0-9_]+)`.
* Tự động sinh bản ghi thông báo loại `mention` gửi tới người dùng được nhắc tên qua **Notification Hub**.
