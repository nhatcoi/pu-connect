# 🤝 Đặc Tả Tính Năng: Hệ Thống Theo Dõi & Kết Nối (Follow / Following)

Tài liệu này mô tả toàn diện kiến trúc kỹ thuật, thiết kế Cơ sở dữ liệu PostgreSQL, GraphQL API và luồng trải nghiệm người dùng (UX) cho phân hệ **Theo dõi & Mạng lưới kết nối (Social Graph)** trong nền tảng học thuật **PU Connector**.

---

## 1. Tổng Quan & Mục Tiêu

Trong môi trường đại học (Phenikaa University), sinh viên và giảng viên cần kết nối để:
- **Theo dõi bạn học cùng lớp / cùng ngành:** Cập nhật các bài thảo luận, câu hỏi ôn thi và tài liệu học phần do bạn bè chia sẻ.
- **Theo dõi Giảng viên / Trợ giảng (TA):** Nhận thông báo tức thời khi thầy/cô đăng bài giảng, đề cương hoặc thông báo quan trọng.
- **Tìm kiếm đối tác Đồ án PBL:** Theo dõi các sinh viên có kỹ năng công nghệ mạnh để mời vào nhóm bài tập lớn/đồ án tốt nghiệp.

---

## 2. Thiết Kế Cơ Sở Dữ Liệu (Database Schema)

### 2.1. Bảng Quan Hệ `user_follows`
Mối quan hệ M-N giữa các tài khoản người dùng được lưu trữ trong bảng `user_follows` với khóa chính kép:

```sql
CREATE TABLE IF NOT EXISTS user_follows (
    follower_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    following_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    PRIMARY KEY (follower_id, following_id),
    CONSTRAINT chk_no_self_follow CHECK (follower_id != following_id)
);

-- Chỉ mục tối ưu tốc độ truy vấn 2 chiều
CREATE INDEX IF NOT EXISTS idx_user_follows_following ON user_follows(following_id);
CREATE INDEX IF NOT EXISTS idx_user_follows_follower ON user_follows(follower_id);
```

### 2.2. Ý nghĩa các trường:
* `follower_id`: ID người thực hiện hành động bấm theo dõi.
* `following_id`: ID người được theo dõi (target user).
* `created_at`: Thời điểm bắt đầu theo dõi.
* `chk_no_self_follow`: Ràng buộc ngăn người dùng tự follow chính mình.

---

## 3. Đặc Tả GraphQL API

### 3.1. Types & Models

```graphql
type FollowResult {
  """Trạng thái mới: true nếu đã theo dõi, false nếu đã hủy theo dõi"""
  isFollowing: Boolean!
  """Tổng số người đang theo dõi tài khoản này sau khi thay đổi"""
  followersCount: Int!
  """Tổng số người mà tài khoản này đang theo dõi"""
  followingCount: Int!
}

extend type User {
  """Xác định người dùng hiện tại đã follow tài khoản này hay chưa"""
  isFollowedByMe: Boolean!
  """Số lượng người theo dõi thực tế từ database"""
  followersCount: Int!
  """Số lượng người mà tài khoản này đang theo dõi thực tế"""
  followingCount: Int!
}
```

### 3.2. Mutations

```graphql
extend type Mutation {
  """Toggle theo dõi / hủy theo dõi một tài khoản"""
  toggleFollow(targetUserId: ID!): FollowResult!
}
```

* **Xử lý Logic Backend:**
  1. Kiểm tra xác thực (`currentUserId`).
  2. Nếu `currentUserId === targetUserId` $\rightarrow$ Báo lỗi `BadRequestException`.
  3. Kiểm tra sự tồn tại của cặp `(currentUserId, targetUserId)` trong `user_follows`:
     - Nếu **đã tồn tại**: Thực hiện `DELETE FROM user_follows WHERE follower_id = $1 AND following_id = $2` $\rightarrow$ Trả về `isFollowing: false`.
     - Nếu **chưa tồn tại**: Thực hiện `INSERT INTO user_follows (follower_id, following_id) VALUES ($1, $2)` $\rightarrow$ Trả về `isFollowing: true`.
  4. Đếm lại số lượng `followersCount` và `followingCount` trả về cho Client.

### 3.3. Queries

```graphql
extend type Query {
  """Danh sách gợi ý người dùng (ưu tiên Giảng viên & sinh viên cùng Khoa/Viện)"""
  suggestedUsers(limit: Int): [User!]!

  """Danh sách những người đang theo dõi một tài khoản"""
  userFollowers(userId: ID!): [User!]!

  """Danh sách những người mà tài khoản này đang theo dõi"""
  userFollowing(userId: ID!): [User!]!
}
```

---

## 4. Thiết Kế Trải Nghiệm Giao Diện (Frontend UX)

### 4.1. Component `FollowButton` đa trạng thái (Optimistic UI)
* **Trạng thái 1 (Chưa Follow):**
  * Hiển thị: Nút nền đen/trắng `+ Theo dõi`.
* **Trạng thái 2 (Đang Follow):**
  * Hiển thị: Nút outline `Đang theo dõi`.
  * Khi rê chuột (Hover): Chuyển sang màu đỏ nhạt `Hủy theo dõi`.
* **Trạng thái 3 (Trang của chính mình):**
  * Hiển thị: `Chỉnh sửa hồ sơ` hoặc ẩn nút.
* **Cơ chế Optimistic Update:** Khi người dùng click, giao diện lập tức cập nhật trạng thái và nhảy số đếm Follower (+1/-1) mà không cần đợi server phản hồi. Nếu mạng lỗi, tự động rollback và hiển thị thông báo.

### 4.2. Modal Danh Sách `UserListDialog`
* Khi người dùng click vào nhãn **`XX Người theo dõi`** hoặc **`YY Đang theo dõi`** trên trang cá nhân `/[username]`:
  * Mở Modal hiển thị danh sách các tài khoản với Avatar, Tên, `@username`, Khoa/Viện.
  * Mỗi tài khoản trong danh sách đều có sẵn nút `FollowButton` để kết nối nhanh.

### 4.3. Tích hợp Right Sidebar (`RightSidebar.tsx`)
* Mục *"Gợi ý kết nối học tập"* truy vấn động danh sách `suggestedUsers` từ GraphQL.
* Bấm theo dõi trực tiếp ngay trên Sidebar mà không cần rời trang.
