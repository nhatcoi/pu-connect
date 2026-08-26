# 📰 Đặc Tả Chi Tiết: Bảng Tin Cá Nhân Hóa & Đăng Bài Đa Phương Thức (Feed & Posts)

---

## 1. Kiến Trúc Bảng Tin Cá Nhân Hóa (Personalized Home Feed)

Bảng tin `Home Feed` là trục xương sống tương tác của sinh viên và giảng viên, được thiết kế theo cấu trúc **3 cột chuẩn X** với cơ chế phân phối nội dung thông minh.

### 1.1. Các Tab Phân Loại Bảng Tin
* **Tab "Dành cho bạn" (`for_you`):** Phân phối bài viết thông qua **Thuật toán đề xuất lai (Hybrid Recommendation Engine)**.
* **Tab "Đang theo dõi" (`following`):** Dòng thời gian đảo ngược thời gian thực (Reverse Chronological) từ những người dùng mà sinh viên đang bấm theo dõi (`user_follows`).
* **Tab "Học phần & Hỏi đáp" (`courses`):** Lọc riêng các bài viết có gắn mã học phần (`course_id`), câu hỏi cần giải đáp (`qa`) và tài liệu học tập (`document`).

### 1.2. Thuật Toán Xếp Hạng Bài Viết (Hybrid Recommendation Formula)
Hệ thống chấm điểm bài viết động dựa trên ma trận ngữ cảnh người dùng:

$$S(u, p) = w_1 \cdot C(u, p) + w_2 \cdot F(u, p) + w_3 \cdot Y(u, p) + w_4 \cdot Follow(u, p) + w_5 \cdot Tag(u, p) + w_6 \cdot E(p) - \lambda \cdot \Delta t$$

| Tham Số | Trọng Số Điểm | Ý Nghĩa Kỹ Thuật |
|---|---|---|
| $C(u, p)$ | $+40.0$ | Trùng khớp môn học mà sinh viên đang quan tâm hoặc đăng ký trong kỳ. |
| $F(u, p)$ | $+30.0$ | Tác giả bài viết thuộc cùng **Khoa/Viện** (`FIT`, `FEE`, `FBA`...). |
| $Y(u, p)$ | $+15.0$ | Tác giả bài viết thuộc cùng **Niên khóa** (`K15`, `K16`...). |
| $Follow(u, p)$ | $+35.0$ | Người dùng hiện tại đang bấm theo dõi tác giả bài viết. |
| $Tag(u, p)$ | $+35.0$ / $+25.0$ | Tags bài viết trùng khớp với `interests` ($+35$) hoặc `skills` ($+25$) của user. |
| $E(p)$ | $2 \cdot L + 5 \cdot C$ | Điểm tương tác: Mỗi Like $+2.0$, Mỗi Bình luận $+5.0$, Q&A có lời giải $+10.0$. |
| $\lambda \cdot \Delta t$ | $-2.0 / 24\text{h}$ | Hệ số suy giảm theo thời gian thực để ưu tiên hiển thị nội dung mới. |

---

## 2. Trình Soạn Thảo & Đa Định Dạng Bài Viết (Post Engine)

### 2.1. Phân Loại Mục Đích Bài Viết (`post_type_enum`)
* **Thảo luận chung (`general`):** Chia sẻ thông tin đời sống sinh viên, kinh nghiệm học tập.
* **Hỏi đáp bài tập (`qa`):** Đặt câu hỏi học thuật, gắn mã môn học, hỗ trợ duyệt lời giải chính xác (`Accepted Solution`).
* **Chia sẻ tài liệu (`document`):** Đính kèm đề thi, slide PDF, tài liệu tham khảo.
* **Tuyển nhóm đồ án (`group_recruit`):** Đăng bài tìm đồng đội làm bài tập lớn/PBL kèm số lượng slot (`recruit_slots_total`).
* **Thông báo chính thức (`announcement`):** Dành riêng cho Giảng viên, Ban chủ nhiệm Khoa, Admin.

### 2.2. Hỗ Trợ Đa Phương Tiện (Rich-Media Capabilities)
* **LaTeX / KaTeX Formulas:** Hiển thị công thức toán, lý, hóa inline `$E=mc^2$` và block `$$\int_{a}^{b} f(x)dx$$`.
* **Code Snippets:** Syntax highlighting đa ngôn ngữ (C++, Python, TypeScript, Java, SQL).
* **Lưới ảnh chuẩn X ([`PostMediaGallery`](file:///home/nhatcoi/Documents/personal/pu-connector/apps/web/src/components/social/post-media-gallery.tsx)):** Hiển thị 1, 2, 3, 4 ảnh dạng mosaic grid với bo góc chuẩn $16\text{px}$, lightbox xem ảnh toàn màn hình.
* **Đính kèm File học phần:** Tích hợp trực tiếp ID tài liệu từ kho lưu trữ (`attached_document_ids`).
* **Khảo sát & Bình chọn (Polls):** Hỗ trợ câu hỏi bình chọn nhiều phương án với thời hạn đóng vote.

---

## 3. Hệ Thống Tương Tác: Like, Share, Bookmark

### 3.1. Like / Reaction (`post_reactions`)
* **ACID Toggle:** Thao tác thích bài viết được thực hiện trong transaction với `SELECT ... FOR UPDATE` để đảm bảo bộ đếm `likes_count` luôn chính xác tuyệt đối, không bị race condition khi có hàng nghìn lượt like cùng lúc.

### 3.2. Chia Sẻ Đa Dạng (Share & Repost)
* **Sao chép liên kết (Copy Link):** Sinh đường dẫn trực tiếp `#post-{id}` và sao chép vào Clipboard kèm Toast thông báo.
* **Chia sẻ vào Chat nhóm đồ án (Via Chat):** Chuyển tiếp bài viết vào phòng chat WebSocket nhóm PBL.
* **Chia sẻ mạng xã hội bên ngoài:** Tích hợp intent chia sẻ nhanh lên X (Twitter) và LinkedIn.

### 3.3. Lưu Trữ Bài Viết Yêu Thích (Bookmarks / Saved Posts)
* **Bảng lưu trữ `saved_posts`:**
  ```sql
  CREATE TABLE IF NOT EXISTS saved_posts (
      user_id UUID REFERENCES users(id) ON DELETE CASCADE,
      post_id UUID REFERENCES posts(id) ON DELETE CASCADE,
      collection_name VARCHAR(100) DEFAULT 'Mặc định',
      saved_at TIMESTAMPTZ DEFAULT NOW(),
      PRIMARY KEY (user_id, post_id)
  );
  CREATE INDEX IF NOT EXISTS idx_saved_posts_user ON saved_posts(user_id, saved_at DESC);
  ```
* **Endpoints:**
  * `POST /api/posts/:id/bookmark`: Toggle trạng thái lưu bài viết.
  * `GET /api/posts/bookmarked`: Lấy danh sách bài viết đã lưu của người dùng hiện tại.
