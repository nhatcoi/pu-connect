# 📰 Đặc Tả Chi Tiết: Bảng Tin Cá Nhân Hóa & Đăng Bài Đa Phương Thức (Feed & Posts)

---

## 1. Kiến Trúc Bảng Tin Cá Nhân Hóa (Personalized Home Feed)

Bảng tin `Home Feed` là trục xương sống tương tác của sinh viên và giảng viên, được thiết kế theo cấu trúc **3 cột chuẩn X** với cơ chế phân phối nội dung thông minh.

### 1.1. Các Luồng Bài Viết Bảng Tin (Feed Streams)
* **Tab "Dành cho bạn" (`for_you`):** Phân phối bài viết thông qua **Thuật toán đề xuất lai (Hybrid Recommendation Engine)** kết hợp độ hợp (khoa, khóa, follow, sở thích, hồ sơ quan tâm), tương tác dạng log và suy giảm theo giờ kiểu hot rank (§1.2).
* **Tab "Đang theo dõi" (`following`):** Dòng thời gian đảo ngược thời gian thực (Reverse Chronological - `created_at DESC`) từ Giảng viên, Trợ giảng và bạn bè mà sinh viên đang bấm theo dõi (`user_follows`).
* **Tab "Hỏi đáp" (`qa`):** Lọc riêng các câu hỏi bài tập và thắc mắc học thuật (`post_type = 'question'`), hỗ trợ duyệt lời giải chính xác (`Accepted Solution` +15 Rep).

### 1.2. Thuật Toán Xếp Hạng Bài Viết (Hot Rank)
Mã nguồn: `apps/api/src/modules/posts/feed-ranking.sql.ts` (dùng chung REST `PostsService.findAll` và GraphQL `feed`). Áp dụng cho tab sắp theo điểm (`for_you`, `qa`, `courses`); `following` / `bookmarks` / tab hoạt động hồ sơ sắp theo thời gian.

$$S(u, p) = \frac{10 + A(u, p) + 10 \cdot \text{resolved} + 12 \cdot \ln(1 + 2L + 5C)}{(\Delta h + 2)^{1.2}} \cdot 0.7^{\min(seen, 5)} \cdot 0.5^{\max(r_a - 2,\,0)}$$

| Tham số | Giá trị | Ý nghĩa |
|---|---|---|
| $A(u, p)$ | cùng khoa $+30$, cùng khóa $+15$, follow $+35$, tag ∩ interests $+35$, tag ∩ skills $+25$, hồ sơ quan tâm $0..40$ | Độ hợp với người xem (khách = 0). |
| $\ln(1 + 2L + 5C)$ | $\times 12$ | Tương tác **log** ⇒ bài 100 like không đè mãi bài mới. |
| $\Delta h$ | giờ tuổi bài, tính theo mốc `snapshotAt` | Chia theo tuổi (gravity 1.2, kiểu Hacker News) ⇒ bài cũ tự tụt sau 1–2 ngày. Không dùng `NOW()` ⇒ phân trang offset ổn định. |
| $seen$ | số `user_events.post_view` của người xem trước `snapshotAt` | Bài đã lướt qua nhân 0.7 mỗi lần ⇒ feed đổi giữa các lần vào. |
| $r_a$ | thứ hạng bài trong nhóm cùng tác giả (`ROW_NUMBER() OVER (PARTITION BY author_id)`) | Bài thứ 3+ của cùng tác giả giảm ×0.5 dần ⇒ một người/bot đăng dồn không chiếm cả trang. |

Thực thi: điểm tính một lần qua `CROSS JOIN LATERAL (…) rk`, `LEFT JOIN` gộp `post_view` (alias `seen`), window function cho đa dạng tác giả. Hằng số tinh chỉnh ở `FEED_RANKING`.

**Lịch sử (2026-10-19):** công thức cũ cộng tuyến tính `likes×2 + comments×5 − 2/ngày` ⇒ bài 21 like/14 comment (~112 điểm) cần ~56 ngày mới tụt, 43 bài mới/ngày (0 tương tác) bị đẩy khỏi trang đầu. Đổi sang hot rank ở trên; test `apps/api/test/feed-ranking.e2e-spec.ts`.

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

### 2.2. Đăng Ẩn Danh (Anonymous Posts & Comments)

Dành cho câu hỏi nhạy cảm (điểm số, giảng viên, sức khỏe tinh thần). Cột `posts.is_anonymous`, `comments.is_anonymous` (migration `anonymous-upgrade.sql`).

**Nguyên tắc:** *lưu thật, hiển thị ẩn* — `author_id` vẫn được lưu (admin truy vết khi có báo cáo, chủ bài xoá / sửa được); mọi phản hồi công khai thay tác giả bằng `ANONYMOUS_AUTHOR` (`id: anonymous`, `username: an-danh` — có dấu gạch ngang nên không ai đăng ký trùng được). Phản hồi thêm `isAnonymous` + `isMine` (chủ bài thấy "Ẩn danh (bạn)").

**Quy tắc đăng:** bài chỉ ở loại hỏi đáp (`qa`), công khai, ngoài cộng đồng; bình luận ẩn danh được ở mọi bài. Hạn mức trượt 24 giờ: 3 bài + 20 bình luận (`assertAnonymousQuota`, HTTP 429).

**Điểm che (đã rà từng đường lộ):**

| Đường | Cách xử lý |
|---|---|
| Feed / chi tiết / tìm kiếm / `featuredComment` | Mapper che tác giả (`anonymousAuthor()`), `isAuthorFollowedByMe = false`, `facultyCode` không lấy từ tác giả |
| Tab *Đang theo dõi*, pill bài mới | Loại bài ẩn danh khỏi tab theo dõi và danh sách tác giả của pill |
| Lọc theo khoa (tìm kiếm) | Bài ẩn danh chỉ khớp theo khoa của học phần, không theo khoa tác giả |
| GraphQL `feed` / `post` / `comments` / `user.posts` | Loại bỏ nội dung ẩn danh (resolver trả tác giả thật) |
| Thông báo | `anonymizeNotification`: `actorId = null`, không `groupKey`, tiêu đề "Một người ẩn danh …" (bình luận, trả lời, mention, duyệt lời giải bài ẩn danh); không báo follower, không phát `feed:new_post` |
| Chat | Ảnh chụp bài khi chia sẻ + link preview dùng tác giả ẩn |
| AI | Tóm tắt / ngữ cảnh N7AI thay tên bằng "Ẩn danh" |
| Gợi ý @mention, đóng góp học phần, hoạt động "đã bình luận" | Bỏ người viết ẩn danh |

**Giới hạn đã biết:** chủ bài chưa có trang riêng liệt kê bài ẩn danh (tìm trong feed, có nhãn "bạn"); admin vẫn thấy tác giả thật. Test: `apps/api/test/anonymous.e2e-spec.ts`.

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
