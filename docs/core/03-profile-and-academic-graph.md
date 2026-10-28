# 👤 Đặc Tả Chi Tiết: Hồ Sơ Sinh Viên & Mạng Lưới Học Thuật (Profile & Social Graph)

---

## 1. Cấu Trúc Hồ Sơ Học Thuật (Academic Student Profile)

Hồ sơ cá nhân trên PU Connect được chuẩn hóa để phản ánh đầy đủ năng lực, chuyên môn và quá trình học tập của sinh viên tại Trường Đại học Phenikaa.

### 1.1. Các Trường Dữ Liệu Cốt Lõi (`users` Table)
* **Định danh cơ bản:** `id (UUID)`, `email (edu mail)`, `username`, `display_name`, `avatar_url`, `bio`.
* **Cây định danh học thuật:**
  * `student_id`: Mã số sinh viên (ví dụ: `22010123`).
  * `university_id` → `universities`: trường đại học (có sẵn Phenikaa; email trường tự chọn). Chọn **"Khác"** + nhập tên ⇒ bản ghi `unit_requests` chờ admin duyệt; trong lúc chờ (và cả khi bị từ chối) hồ sơ hiện **"Khác"**.
  * `user_interest_fields (user_id, field_id, position)` → `interest_fields`: **lĩnh vực quan tâm — chọn nhiều, tối đa 3** (`MAX_INTEREST_FIELDS`, kiểm tra ở API; mục "Khác" đang chờ / bị từ chối cũng chiếm một chỗ). `users.interest_field_id` giữ lĩnh vực **chính** (mục đầu, `position 0`) cho huy hiệu tác giả bài viết, bot và mọi chỗ chỉ cần một giá trị. Hồ sơ trả `interestFieldIds` (theo thứ tự chọn) và `interestField` = tên nối bằng " · " (kèm "Khác"). Khớp lĩnh vực (xếp hạng bảng tin, gợi ý theo dõi, lọc tìm kiếm, lọc người dùng và đối tượng thông báo bên admin) dùng **mọi** lĩnh vực trong danh sách (`userHasFieldSql` / `sharedFieldSql` ở `unit-sql.ts`). Danh mục: (Công nghệ thông tin, Kỹ thuật, Kinh tế, Ngoại ngữ – KHXH, Y – Dược, Công nghệ số liên ngành, Du lịch…; admin thêm được). Cùng cơ chế "Khác" + duyệt. Môn học (`courses.interest_field_id`) và tài liệu (qua môn) gắn theo lĩnh vực này.
  * **Không còn** khoa / ngành / khóa / lớp: quá chi tiết nên người dùng ngại điền (2026-10-28). Bước 2 (`legacy-units-drop-upgrade.sql`) đã **xóa hẳn** cột `users.faculty/major/class_name/academic_year/school/unit_id`, `courses.faculty_id/faculty_code`, `course_suggestions.faculty_code`, `bot_profiles.major` và bảng `faculties`, `academic_units` (view `academic_unit_paths`); deploy tự sao lưu cả DB vào `/var/backups/pu-connector/` trước khi xóa.
  * `role`: Phân quyền RBAC (`student`, `lecturer`, `ta`, `club_lead`, `admin`).
* **Hồ sơ năng lực & Sở thích:**
  * `skills (TEXT[])`: Mảng kỹ năng chuyên môn (`React Native`, `NestJS`, `Python AI`, `PostgreSQL`...).
  * `interests (TEXT[])`: Mảng lĩnh vực học thuật quan tâm (`Trí tuệ nhân tạo`, `An toàn thông tin`, `Kỹ thuật phần mềm`...).
  * `reputation_points (INT)`: Tổng điểm uy tín tích lũy từ đóng góp học thuật.

---

### 1.2. Dữ liệu có đề xuất (quy tắc chung)

Áp dụng cho trường đại học, lĩnh vực quan tâm và môn học (và mọi danh mục tương tự thêm sau):

* **Hộp chọn chung** `SuggestPickerDialog` (`components/common/suggest-picker.tsx`): ô tìm bỏ dấu, danh sách **A–Z** nhóm theo chữ cái đầu, dòng **"Khác — đề xuất …"** ghim đầu danh sách. Chọn "Khác" ⇒ form đề xuất (trường đầu là tên, điền sẵn từ ô tìm; môn học có thêm lĩnh vực + ghi chú). Dùng ở form sửa hồ sơ (`unit-selector.tsx`), chọn môn khi phân loại tài liệu (`CourseSelect`) và nút *Đề xuất môn học* ở trang Môn học (`startInSuggest`).
* **Nơi lưu**: trường / lĩnh vực ⇒ `unit_requests` (`kind` university | field; mỗi người tối đa **một** dòng chưa duyệt cho mỗi loại, trạng thái `pending` hoặc `rejected`); môn học ⇒ `course_suggestions`.
* **Trạng thái hồ sơ**: đề xuất chờ duyệt **hoặc bị từ chối** ⇒ `university` / `interestField` hiển thị **"Khác"**; chủ hồ sơ còn nhận tên đã gửi và `*RequestStatus` (`pending` | `rejected`) để điền lại form.
* **Admin duyệt** (trang **Đề xuất**): duyệt ⇒ tạo mục mới hoặc gộp vào mục có sẵn, cập nhật hồ sơ mọi người gửi cùng tên và thông báo; môn học ⇒ tạo môn thật. **Từ chối** (kèm lý do) ⇒ dòng yêu cầu thành `rejected`, hồ sơ người dùng **vẫn là "Khác"**; họ chọn mục có sẵn hoặc đổi sang tên khác (tạo yêu cầu mới thay dòng cũ) mới thoát trạng thái này. Lưu hồ sơ với đúng tên đã bị từ chối **không** gửi lại.
* Thêm loại đề xuất mới: dùng lại hộp chọn + thêm một loại vào trang Đề xuất bên admin và cộng vào badge menu (`AdminStats`).

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
