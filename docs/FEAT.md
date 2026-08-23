# PU Connector — Danh Mục Tính Năng & Lộ Trình Phát Triển

Tài liệu theo dõi trạng thái các tính năng đã hoàn thành và kế hoạch phát triển (Backlog & Roadmap) của hệ thống PU Connector.

---

## 1. Tính Năng Đã Hoàn Thành (Completed Features)

### 🏗️ Kiến Trúc & Nền Tảng (Core & Infrastructure)
- [x] 📦 **Monorepo Turborepo + pnpm (`apps/web`, `apps/api`, `packages/schemas`, `packages/ui`)**: Tách biệt rõ ràng giữa Client, Server và Shared Library.
- [x] ⚡ **Quản lý tiến trình tập trung (`procman.yaml`)**: Chạy toàn bộ hệ thống (`db`, `api`, `web`) chỉ với 1 lệnh `procman up`.
- [x] 🗄️ **Cơ sở dữ liệu chuẩn hóa (`PostgreSQL 16 + pgvector`)**: Thiết kế DDL 11 bảng phân hệ học thuật, môn học, tài liệu, nhóm đồ án, sự kiện và tương tác.
- [x] 🛡️ **Quản lý ACID Transaction ([`DatabaseService.transaction`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/api/src/database/database.service.ts))**: Bọc mọi luồng ghi dữ liệu quan trọng trong atomic transaction với row-level lock (`FOR UPDATE`), tự động rollback khi có lỗi và cảnh báo `Slow Transaction [>300ms]`.
- [x] 🚀 **Chỉ mục hiệu năng cao ([`add-indexes.sql`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/api/src/database/add-indexes.sql))**: Đánh chỉ mục **GIN Index** cho `tags`, `interests`, `skills` và Composite B-Tree Index cho `created_at DESC`, `comments`, `reactions`.
- [x] 🔐 **Xác thực phiên làm việc an toàn (`Session-based Auth & Passport.js`)**: Đăng ký, đăng nhập với cookie HttpOnly (`pu_session`), mã hóa bcrypt và phân quyền theo vai trò (`student`, `lecturer`, `ta`, `admin`).
- [x] 🚪 **Đăng xuất an toàn toàn diện (`Logout Flow & Session Invalidation`)**: Endpoint `POST /api/auth/logout` xóa cookie `pu_session`, hủy session trên server, reset sạch Client State Zustand và điều hướng tức thời về Landing Page (`/`).
- [x] 👥 **Dữ liệu giả lập thực tế (`Database Seeder - 100 Phenikaa Users`)**: Khởi tạo 100 tài khoản sinh viên và giảng viên phân bổ đủ 8 Khoa/Viện đào tạo.
- [x] 🚀 **Kiến Trúc Hybrid (GraphQL + REST API)**: Tích hợp Apollo Server `/graphql` cho dữ liệu quan hệ lồng nhau (Feed, Profile, Documents, PBL Groups) và giữ REST API cho Session Auth & Upload File lớn.

### ☁️ Lưu Trữ Đám Mây & Tệp Tin (Cloudflare R2 Storage)
- [x] ☁️ **Tích hợp Cloudflare R2 Object Storage (`@aws-sdk/client-s3`)**: Lưu trữ media, ảnh đính kèm bài viết và tệp tài liệu học phần bảo mật với Zero Egress Fee.
- [x] 📤 **Endpoints Tải Lên Đa Năng (`/api/storage/upload` & `/api/storage/presigned-url`)**: Hỗ trợ upload ảnh bài viết, avatar, file slide/đề thi PDF kèm kiểm tra định dạng và kích thước.

### 🌐 Định Tuyến & Giao Diện Chuẩn X (Routing & Social UI)
- [x] 🌟 **Landing Page phong cách X (`/` - Happening now)**: Giao diện chào đón khi chưa đăng nhập, tự động chuyển tiếp sang `/home` nếu đã có session, tích hợp hộp đăng nhập nhanh với 100 tài khoản mẫu seed.
- [x] 🛡️ **Client Route Guard (`AuthGuard`)**: Bảo vệ toàn bộ các route nội bộ (`/home`, `/courses`...), tự động chuyển hướng khách chưa đăng nhập về trang chủ, tự động khóa `/home` và chuyển hướng sang `/get-started` nếu tài khoản chưa hoàn tất khởi tạo hồ sơ.
- [x] 🚀 **Trang Khởi Tạo Hồ Sơ Tân Sinh Viên Chuyên Biệt (`/get-started` - Standalone No Background)**: Trang toàn màn hình độc lập 100% (không lộ background `/home`), thiết kế giao diện Lucide SVG chuyên nghiệp, 4 bước (Mã SV, Khoa/Viện, Môn học, Kỹ năng, Follows), hiệu ứng Transition nạp bảng tin và thưởng ngay **+100 Điểm danh vọng**.
- [x] 🏛️ **Bảng tin 3 cột chuẩn X (`/home`)**: Sidebar điều hướng $\rightarrow$ Feed học thuật với Tab dính (*Dành cho bạn / Môn học / Kho tài liệu*) $\rightarrow$ Xu hướng & Gợi ý kết nối.
- [x] 👤 **Trang cá nhân sinh viên / giảng viên (`/[username]`)**: Banner ảnh bìa, Avatar, Khoa/Viện, Mã SV, Niên khóa, 4 Tabs chuyển đổi (Bài viết, Tài liệu, Nhóm PBL, Huy hiệu thành tích) truy vấn 100% qua GraphQL `userProfile`.
- [x] 🧠 **Thuật Toán Đề Xuất Bài Viết Cá Nhân Hóa (Hybrid Recommendation Engine)**: Chấm điểm bài viết trên Tab *"Dành cho bạn"* kết hợp Môn học ($+40$), Cùng Khoa ($+30$), Cùng Niên khóa ($+15$), Người đang Follow ($+35$), Độ tương tác ($2\times L + 5\times C$) và Hệ số suy giảm thời gian (Time Decay $-2.0 / 24\text{h}$).
- [x] 📜 **Cuộn vô hạn bảng tin (Infinite Scroll Feed)**: Tải dữ liệu phân trang mượt mà qua `IntersectionObserver`, tự động lọc trùng ID (Deduplication) và bảo toàn vị trí cuộn.
- [x] 🤝 **Hệ thống theo dõi & Kết nối bạn bè (`user_follows`)**: Bảng quan hệ theo dõi sinh viên/giảng viên, tự động ưu tiên phân phối bài viết trên Bảng tin.

### 📝 Bảng Tin Học Thuật & Soạn Thảo (Academic Feed & Q&A)
- [x] ✍️ **Trình Soạn Thảo Độc Lập Chuẩn X ([`AcademicPostComposer`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/academic-post-composer.tsx))**: Soạn thảo trực tiếp trên đỉnh feed (không dùng popup modal thô cứng), tự động mở rộng, vòng đo độ dài ký tự SVG (Progress Ring), bộ chọn phạm vi người xem (Audience Menu) và bộ chọn môn học ([`ComposerCoursePicker`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/composer-course-picker.tsx)).
- [x] 🎨 **Bộ Nhận Diện Mục Đích Học Thuật ([`ComposerIntentSelector`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/composer-intent-selector.tsx))**: Chọn phân loại: Thảo luận chung (`general`), Hỏi đáp (`qa`), Chia sẻ tài liệu (`document`), Tuyển nhóm PBL (`group_recruit`).
- [x] 🖼️ **Lưới Hiển Thị Ảnh Chuẩn X ([`PostMediaGallery`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-media-gallery.tsx))**: Hiển thị 1, 2, 3 hoặc 4 ảnh dạng mosaic grid với bo góc chuẩn $16\text{px}$, lớp phủ số lượng ảnh thừa `+N` và xem ảnh toàn màn hình.
- [x] 🔗 **Tính Năng Chia Sẻ Đa Dạng ([`PostCard`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-card.tsx))**: Dropdown menu: Sao chép liên kết (`Copy Link` + Toast), Gửi qua tin nhắn nhóm đồ án (`Via Chat`), Chia sẻ lên X (Twitter).
- [x] ⏰ **Định Dạng Thời Gian Tương Đối Chuẩn Tiếng Việt ([`formatRelativeTime`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/lib/utils.ts))**: Hiển thị "Vừa xong", "X phút trước", "X giờ trước", "X ngày trước" cho toàn bộ bài viết và bình luận.
- [x] 🏷️ **Hiển Thị Mã Môn Học Chuẩn Xác**: Thay thế toàn bộ mã UUID thô bằng mã môn học người dùng đọc được (ví dụ `📘 IT101`, `🏛️ FIT`).

### 🔍 Hệ Thống Tìm Kiếm Thông Tin & Tài Liệu Học Tập (Academic Search Engine)
- [x] ⚡ **Thanh Tìm Kiếm Nổi Tức Thời ([`AcademicSearchBar`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/search/academic-search-bar.tsx))**: Tích hợp trên Header, mở Popover nổi ngay tại input với **Zero Layout Shift**, lưu lịch sử tìm kiếm gần đây (Recent Searches) trong LocalStorage và gợi ý chủ đề hot (`#IT101`, `#DoAnTotNghiep`, `#GiaiTich2`).
- [x] 🔍 **Live Autocomplete Preview**: Tự động gợi ý nhanh top kết quả đa phân hệ (Môn học, Đề thi PDF, Bài viết, Người dùng) ngay khi gõ phím.
- [x] 📑 **Trang Kết Quả Tìm Kiếm Chuyên Sâu ([`/search`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/app/search/page.tsx))**: Trang 3 cột hoàn chỉnh với 6 tabs phân loại (*Tất cả, Môn học, Đề thi & Tài liệu, Bài viết Q&A, Mọi người, Nhóm PBL*) kèm bộ lọc theo Khoa/Viện.
- [x] 🚀 **Backend Full-Text Search Engine ([`SearchService`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/api/src/modules/search/search.service.ts))**: Endpoint `GET /api/search` truy vấn song song 5 bảng PostgreSQL với tốc độ $<10\text{ms}$.

### 💬 Hệ Thống Bình Luận & Duyệt Lời Giải (Academic Comments & Q&A)
- [x] 💬 **Bình luận phân cấp & Phân trang ([`PostCommentsSection`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/comments/post-comments-section.tsx))**: Tải trước 3 bình luận, nút "Xem thêm N bình luận", hỗ trợ trả lời lồng nhau (Nested Replies) và thu gọn phản hồi.
- [x] 🎯 **Cơ Chế Duyệt Lời Giải Chính Xác (Accepted Solution)**: Tác giả bài viết Q&A có quyền chọn và ghim câu trả lời chính xác lên đầu, hiển thị huy hiệu xanh lá và tự động đánh dấu bài viết `[Đã giải quyết]`.
- [x] 🏆 **Hệ Thống Thưởng Danh Vọng Tự Động (Gamification)**:
  - Đăng bài viết: **+5 điểm danh vọng**.
  - Đóng góp bình luận: **+2 điểm danh vọng**.
  - Được duyệt câu trả lời đúng (Accepted Solution): **+10 điểm danh vọng**.

### 📚 Kho Tài Liệu & Đề Thi Học Phần (Knowledge Vault)
- [x] 📑 **Phân loại tài liệu đa định dạng (`PDF`, `Code`, `Sheet`, `Markdown`)**: Tra cứu theo mã học phần và thẻ tag.
- [x] 👁️ **Trình xem trước In-App (`PdfViewer` & `DocumentPreviewModal`)**: Xem trực tiếp file PDF với thanh công cụ phóng to/thu nhỏ, mở tab mới và tải về.
- [x] 📤 **Thêm & chia sẻ tài liệu**: Form tạo tài liệu lưu trữ động trực tiếp vào cơ sở dữ liệu PostgreSQL.

### 🎓 Học Phần & Ghép Nhóm Đồ Án (Courses & PBL Matchmaking)
- [x] 🏛️ **Danh mục học phần theo Khoa/Viện (`FIT`, `FEE`, `FBA`, `FAE`...)**: Đánh giá môn học, số tín chỉ, tài liệu và bài thảo luận liên quan.
- [x] 👥 **Ghép nhóm đồ án PBL (`Study Groups`)**: Đăng tin tuyển thành viên theo đề tài, kỹ năng công nghệ (React Native, NestJS, AI...), quản lý số lượng thành viên.

---

## 2. Tính Năng Dự Định Làm (Planned Features / Backlog)

### 💬 Trò Chuyện & Nhóm Đồ Án Thời Gian Thực (PBL Realtime Chat)
- [ ] 👥 **Phân hệ nhóm đồ án chuyên sâu (`/groups`)**: Xem chi tiết nhóm PBL, gửi yêu cầu xin gia nhập kèm lời nhắn, trưởng nhóm duyệt/từ chối.
- [ ] 💬 **Phòng chat nhóm đồ án nội bộ (`WebSocket / Socket.io`)**: Trao đổi tin nhắn, chia sẻ link GitHub/Figma và tài liệu nội bộ trong nhóm đồ án.

### 📱 Ứng Dụng Di Động (Mobile Application)
- [ ] 📲 **Khởi tạo App Mobile Đa Nền Tảng (`apps/mobile` - Expo / React Native)**: Kết nối NestJS API, chia sẻ `@pu/schemas` và `@pu/ui`.
- [ ] 🧭 **Hệ thống điều hướng Bottom Tabs (`Feed`, `Courses`, `Vault`, `Groups`, `Profile`)**: Trải nghiệm native mượt mà trên iOS và Android.
- [ ] 🔔 **Push Notifications qua Expo Push Service**: Nhận thông báo khi có bình luận mới, tài liệu mới theo môn hoặc có người xin vào nhóm đồ án.

### 🤖 Trí Tuệ Nhân Tạo & Tìm Kiếm Thông Minh (AI & Semantic Search)
- [ ] 🧠 **Tìm kiếm ngữ nghĩa với pgvector (`AI Semantic Search`)**: Trích xuất text từ slide/đề thi PDF và tìm kiếm tài liệu theo ngữ cảnh câu hỏi.
- [ ] 🤖 **Trợ lý AI giải đáp học phần (PU AI Tutor - RAG)**: Tự động tổng hợp câu trả lời dựa trên kho đề thi và tài liệu học phần của trường.

### 🏆 Bảng Xếp Hạng Đóng Góp (Top Contributors Leaderboard)
- [ ] 🥇 **Bảng xếp hạng sinh viên đóng góp theo Khoa/Viện**: Vinh danh các sinh viên tích cực chia sẻ tài liệu và giải đáp học tập nhiều nhất tháng.
