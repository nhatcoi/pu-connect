# 🔔 Đặc Tả Chi Tiết: Trung Tâm Thông Báo & Thời Gian Thực (Notifications & Realtime)

---

## 1. Kiến Trúc Trung Tâm Thông Báo Hợp Nhất (Notification Hub)

Trung tâm thông báo là nơi tiếp nhận, điều phối và phân phối toàn bộ sự kiện diễn ra trên hệ thống tới sinh viên và giảng viên một cách tức thì.

### 1.1. Phân Loại Nhóm Thông Báo
* **Tương tác Xã hội (Social):** Có người thích bài viết, bình luận mới, trả lời bình luận của bạn, nhắc tên (`@mention`).
* **Hỏi đáp & Danh vọng (Academic Q&A):** Câu trả lời của bạn được chọn làm Lời giải chính xác (`Accepted Solution`) kèm điểm danh vọng được thưởng.
* **Đồ án & PBL (Study Groups):** Có sinh viên xin gia nhập nhóm đồ án của bạn, trưởng nhóm duyệt đơn gia nhập, có tin nhắn mới trong phòng chat nhóm.
* **Kho Tri thức (Knowledge Vault):** Có tài liệu mới được tải lên môn học bạn đang theo dõi (`IT101`, `MATH201`).
* **Thông báo Nhà trường (Announcements):** Thông báo từ Ban Giám hiệu, Ban Chủ nhiệm Khoa, nhắc lịch đăng ký tín chỉ và lịch thi.

---

## 2. Thiết Kế Cơ Sở Dữ Liệu `notifications`

```sql
CREATE TYPE notification_type_enum AS ENUM (
    'post_like',
    'post_comment',
    'comment_reply',
    'accepted_solution',
    'user_mention',
    'group_join_request',
    'group_member_accepted',
    'course_document_uploaded',
    'system_announcement'
);

CREATE TABLE IF NOT EXISTS notifications (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    recipient_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    actor_id UUID REFERENCES users(id) ON DELETE SET NULL,
    type notification_type_enum NOT NULL,
    title VARCHAR(255) NOT NULL,
    message TEXT NOT NULL,
    entity_id VARCHAR(100), -- ID bài viết, comment hoặc nhóm đồ án
    entity_type VARCHAR(50), -- 'post', 'comment', 'study_group', 'document'
    is_read BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Chỉ mục truy vấn danh sách thông báo chưa đọc của user với độ trễ < 5ms
CREATE INDEX IF NOT EXISTS idx_notifications_recipient_unread 
ON notifications(recipient_id, is_read, created_at DESC);
```

---

## 3. Giao Thức Đẩy Thời Gian Thực & Cơ Chế Gộp Thông Báo

### 3.1. Kênh Truyền WebSocket (`Socket.io`)
* Khi có sự kiện phát sinh (ví dụ bạn B bình luận bài của bạn A):
  * Backend lưu bản ghi vào PostgreSQL `notifications`.
  * Gửi socket event `notification:new` trực tiếp đến room cá nhân `user:{recipient_id}`.
  * Web & Mobile Client nhận event, phát âm thanh thông báo nhẹ và cập nhật số huy hiệu đỏ (Badge counter) trên Header.

### 3.2. Thuật Toán Gộp Thông Báo (Notification Aggregation)
* Khi một bài viết nhận được nhiều lượt thích trong thời gian ngắn (ví dụ 10 lượt thích trong 1 giờ), hệ thống không gửi 10 thông báo riêng rẽ mà gộp thành:
  > *"Nguyễn Văn A và 9 người khác đã thích bài viết của bạn."*
* Giảm thiểu 90% tải DB và tránh làm phiền người dùng.
