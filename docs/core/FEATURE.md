# 🌟 Phân Hệ Core: Danh Mục Tính Năng & Lộ Trình (Social Core Features & Roadmap)

Tài liệu ghi nhận ngắn gọn, súc tích toàn bộ các tính năng **Đã Triển Khai (Completed)** và **Sắp Triển Khai (Roadmap & Backlog)** của phân hệ Mạng Xã Hội Học Thuật Core trong dự án **PU Connect**.

---

## 1. 🚀 Tính Năng Đã Triển Khai (Completed Features)

### 📱 A. Giao Diện & Điều Hướng Di Động Chuẩn X (Mobile Responsive & Top Header)
- [x] **Top Header Di Động Phong Cách X Không Cố Định ([`Header`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/header.tsx))**:
  - **Bố cục 3 phần cân đối hoàn hảo**: 
    - *Bên trái*: Avatar người dùng (chạm để mở Menu thao tác nhanh / Trang cá nhân / Đã lưu).
    - *Chính giữa*: Logo biểu trưng PU tối giản căn giữa tuyệt đối (`absolute left-1/2 -translate-x-1/2`).
    - *Bên phải*: Nút hành động dạng con nhộng (**Pill Action Button**) `+ Đăng bài` hoặc `Đăng nhập`.
  - **Cơ chế cuộn tự nhiên (Non-fixed Natural Scroll)**: Trên Mobile, Top Header nằm trong luồng cuộn tự nhiên (`relative md:sticky md:top-0`), cuộn trượt mượt mà ra khỏi màn hình khi lướt feed, giải phóng 100% chiều cao màn hình cho việc đọc bài viết học thuật.
  - **Gắn dính thanh 3 Luồng Feed thông minh (Smart 3-Stream Tab Pinning)**: Khi Top Header cuộn đi, thanh 3 Tab phân luồng (*Dành cho bạn, Đang theo dõi, Hỏi đáp*) tự động dính ở vị trí `top-0` trên Mobile (và `md:top-14` trên Desktop).
- [x] **Top Header Tìm Kiếm Tinh Gọn Cho Mobile ([`SearchPage`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/app/search/page.tsx))**:
  - Tự động ẩn Header chung trên mobile `/search`, thay bằng thanh tìm kiếm Pill Shape dạng `[ Avatar ] [ 🔍 Tìm kiếm... ] [ ⚙️ Cài đặt ]`, tái hiện 100% giao diện X Explore.
- [x] **Thanh Điều Hướng Đáy Màn Hình ([`MobileBottomNav`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/navigation/mobile-bottom-nav.tsx))**:
  - 5 tab phân hệ chính: Bảng tin, Khám phá & Tìm kiếm, Thông báo, Nhóm đồ án, Hồ sơ cá nhân. Tự động làm mờ khi người dùng đang cuộn nhanh để tập trung đọc bài viết.

---

### 📝 B. Bảng Tin & Soạn Thảo Học Thuật (Feed & Composer)
- [x] **Trình Soạn Thảo Trực Tiếp Độc Lập ([`AcademicPostComposer`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/academic-post-composer.tsx))**: Soạn thảo inline trên đỉnh feed, hỗ trợ Markdown, LaTeX công thức toán, code block, bộ chọn môn học ([`ComposerCoursePicker`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/composer-course-picker.tsx)) và vòng tròn đếm ký tự SVG.
- [x] **Bố Cục Bài Viết Căn Lề Thẳng Hàng Chuẩn X ([`PostCard`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-card.tsx))**: Avatar cột trái $\rightarrow$ Tên, Badge học thuật, Tiêu đề, Nội dung, Khảo sát, Ảnh mosaic, Tài liệu và Chuỗi nút tương tác thẳng hàng bên phải.
- [x] **Hàng Nút Tương Tác Chuẩn Hóa**: Chuỗi 5 nút logic: **❤️ Tym (Like) $\rightarrow$ 💬 Bình luận $\rightarrow$ 🔖 Lưu bài $\rightarrow$ 📊 Thống kê $\rightarrow$ 🔗 Chia sẻ (Share menu)**.
- [x] **Menu 3 Chấm Tinh Gọn**: Viewer: *Theo dõi tác giả, Không quan tâm, Báo cáo bài viết*; Owner: *Ghim bài viết, Sửa bài viết, Xóa bài viết*.
- [x] **Hệ Thống Khảo Sát Biểu Quyết ([`PostPollCard`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-poll-card.tsx))**: Biểu quyết 2-4 phương án realtime kèm tỷ lệ % trực quan.
- [x] **Hộp Thoại Phân Tích Số Liệu ([`PostAnalyticsDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-analytics-dialog.tsx))**: Thống kê Lượt hiển thị, Tỷ lệ tương tác, Điểm uy tín Phenikaa tích lũy (+5 Rep), phân bổ theo Khoa/Viện.

---

### 💬 C. Bình Luận Đa Cấp & Duyệt Lời Giải Q&A (Comments & Accepted Solution)
- [x] **Bình Luận Phân Cấp Lồng Nhau ([`PostCommentsSection`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/comments/post-comments-section.tsx))**: Hỗ trợ trả lời (Nested Replies), thích bình luận, gửi ảnh đính kèm.
- [x] **Duyệt Lời Giải Đúng Cho Bài Viết Q&A**: Chủ bài viết hoặc Giảng viên có quyền click "Chấp nhận câu trả lời này" $\rightarrow$ Thưởng ngay **+15 Điểm danh vọng** cho người trả lời trong ACID Transaction.

---

### 👤 D. Hồ Sơ Cá Nhân & Đồ Thị Quan Hệ (Profile & Social Graph)
- [x] **Trang Cá Nhân Chi Tiết ([`ProfilePage`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/app/%5Busername%5D/page.tsx))**: Banner bìa, Avatar, Khoa/Viện, Mã SV, Niên khóa, 4 tabs (Bài viết, Tài liệu, Nhóm đồ án, Huy hiệu thành tích).
- [x] **Mạng Lưới Theo Dõi Học Thuật (`user_follows`)**: GraphQL mutation `toggleFollow`, cập nhật quan hệ realtime và ưu tiên thuật toán Bảng tin.
- [x] **Huy Hiệu Vai Trò Học Thuật ([`AcademicBadge`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/ui/academic-badge.tsx))**: 🎓 Giảng viên, 🌟 Trợ giảng (TA), 👑 Ban Quản trị (Admin), 🏆 Top Contributor ($\ge 300$ Rep).

---

### 🔍 E. Tìm Kiếm & Khám Phá Xu Hướng (Search & Trending Hub)
- [x] **Explore & Trending Hub (Chế độ khám phá)**: Header tìm kiếm, 5 tabs danh mục (*Khám phá, Xu hướng, Môn học hot, Đề thi & Slide, Nhóm PBL*), Tin nổi bật Phenikaa và BXH từ khóa thịnh hành.
- [x] **Active Search Stream (Chế độ kết quả)**: Phân loại kết quả tìm kiếm đa thực thể (*Bài viết, Tài liệu, Môn học, Nhóm PBL, Mọi người*) kèm bộ lọc nâng cao theo Khoa/Viện.

---

### 🔔 F. Trung Tâm Thông Báo Realtime (Notification Hub)
- [x] **Popover Thông Báo Nổi ([`NotificationsPopover`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/notifications-popover.tsx))**: Huy hiệu đếm chưa đọc, phân loại sự kiện (Thích, Bình luận, Lời giải đúng, Tuyển nhóm), nút "Đánh dấu đã đọc tất cả".

---

## 2. 🔮 Kế Hoạch & Tính Năng Sắp Triển Khai (Roadmap & Backlog)

### 💬 Giai Đoạn 1: Chat Trực Tuyến & Nhóm Học Tập (Realtime Messaging)
- [ ] **Kênh Chat Nhóm Đồ Án PBL**: Phòng chat theo từng nhóm đồ án môn học, chia sẻ file slide/đề thi nhanh và phân công công việc.
- [ ] **Nhắn Tin Trực Tiếp Giữa Sinh Viên & Giảng Viên (Direct Messages)**: Trao đổi học vụ cá nhân bảo mật.

### 🔒 Giai Đoạn 2: Quản Trị & Kiểm Duyệt Học Thuật Nâng Cao (Academic Moderation)
- [ ] **Khóa Bình Luận Bài Viết (Lock Comments)**: Cho phép tác giả/giảng viên đóng bài tuyển nhóm khi đã đủ người hoặc đóng câu hỏi Q&A đã có đáp án chuẩn.
- [ ] **Tắt Thông Báo Thảo Luận Riêng Biệt (Mute Thread)**: Cho phép tắt chuông thông báo riêng cho từng bài viết khi không muốn nhận cập nhật liên tục.
- [ ] **Lịch Sử Chỉnh Sửa Bài Viết (Edit History)**: Xem các phiên bản chỉnh sửa nội dung bài viết để đảm bảo tính minh bạch học thuật.

### 🤖 Giai Đoạn 3: Trợ Lý AI Học Thuật & Đề Thi (AI Assistant & PWA)
- [ ] **Tóm Tắt Thảo Luận & Lời Giải Chuẩn Bằng AI (AI Q&A Summarizer)**: Tự động tổng hợp câu trả lời hay nhất từ các bình luận dài.
- [ ] **Gợi Ý Tài Liệu & Đề Thi Cùng Môn Học (AI Smart Recommendation)**: Tự động đính kèm đề thi năm trước liên quan khi sinh viên đặt câu hỏi về một môn học cụ thể.
- [ ] **Ứng Dụng PWA Hoàn Chỉnh (Progressive Web App)**: Cho phép cài đặt ứng dụng lên màn hình chính điện thoại (iOS/Android) với trải nghiệm App native.
