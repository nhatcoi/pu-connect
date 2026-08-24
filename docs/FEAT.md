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
- [x] 🛠️ **Đồng bộ hóa Enum & Truy vấn SQL Bảng tin (`post_type_enum`)**: Chuẩn hóa map hai chiều giữa kiểu bài viết Client (`qa`, `document`, `group_recruit`, `review`) và PostgreSQL Enum (`question`, `resource_share`, `pbl_recruitment`, `review`), khắc phục triệt để lỗi 500 khi lọc tab môn học (`feedType=courses`).
- [x] 🗄️ **Tích hợp PostgreSQL Client cho Courses & Documents**: Chuyển đổi `CoursesService` và `DocumentsService` sang truy vấn trực tiếp từ bảng cơ sở dữ liệu PostgreSQL.

### ☁️ Lưu Trữ Đám Mây & Tệp Tin (Cloudflare R2 Storage)
- [x] ☁️ **Tích hợp Cloudflare R2 Object Storage (`@aws-sdk/client-s3`)**: Lưu trữ media, ảnh đính kèm bài viết và tệp tài liệu học phần bảo mật với Zero Egress Fee.
- [x] 📤 **Endpoints Tải Lên Đa Năng (`/api/storage/upload` & `/api/storage/presigned-url`)**: Hỗ trợ upload ảnh bài viết, avatar, file slide/đề thi PDF kèm kiểm tra định dạng và kích thước.

### 🌐 Định Tuyến & Giao Diện Chuẩn X (Routing & Social UI)
- [x] 🌟 **Landing Page phong cách X (`/` - Happening now)**: Giao diện chào đón khi chưa đăng nhập, tự động chuyển tiếp sang `/home` nếu đã có session, tích hợp hộp đăng nhập nhanh với 100 tài khoản mẫu seed.
- [x] 📱 **Kiến Trúc Responsive Chuẩn X & Điều Hướng Di Động Hoàn Hảo**:
  - **Giao diện hẹp / Tablet (768px – 1200px)**: Sidebar tự động thu gọn về dạng cột icon tinh gọn (`w-16`), nút đăng bài icon tròn, avatar người dùng ở chân trang, loại bỏ 100% hiện tượng tràn ngang (Horizontal Scrollbar).
  - **Giao diện Mobile (< 768px)**: Header chuẩn X (Avatar góc trái, Logo PU ở giữa, Search + Notif + Theme góc phải), Tab bar dính liền mạch, thanh điều hướng đáy màn hình (**Mobile Bottom Navigation Bar** - 5 phân hệ chính), và nút tạo bài viết nổi (**Floating Action Button - FAB** góc dưới bên phải).
  - **Cơ Chế UI Scroll Chuẩn X (Hide-on-Scroll & Dim-on-Scroll)**: Tự động trượt ẩn Header & Tab Bar (`-translate-y-full`) khi cuộn xuống, đồng thời tự động làm mờ thanh điều hướng đáy màn hình (**Mobile Bottom Nav** & **FAB** mờ `opacity-25 blur-xs`) khi đang cuộn để người dùng tập trung 100% vào nội dung bài viết, tự động khôi phục độ rõ nét khi dừng cuộn hoặc cuộn ngược lên trên.
- [x] 🛡️ **Client Route Guard (`AuthGuard`)**: Bảo vệ toàn bộ các route nội bộ (`/home`, `/courses`...), tự động chuyển hướng khách chưa đăng nhập về trang chủ, tự động khóa `/home` và chuyển hướng sang `/get-started` nếu tài khoản chưa hoàn tất khởi tạo hồ sơ.
- [x] 🚀 **Trang Khởi Tạo Hồ Sơ Tân Sinh Viên Chuyên Biệt (`/get-started` - Standalone No Background)**: Trang toàn màn hình độc lập 100% (không lộ background `/home`), thiết kế giao diện Lucide SVG chuyên nghiệp, 4 bước (Mã SV, Khoa/Viện, Môn học, Kỹ năng, Follows), hiệu ứng Transition nạp bảng tin và thưởng ngay **+100 Điểm danh vọng**.
- [x] 🏛️ **Bảng tin 3 cột chuẩn X (`/home`)**: Sidebar điều hướng $\rightarrow$ Feed học thuật với Tab dính (*Dành cho bạn / Môn học / Kho tài liệu*) $\rightarrow$ Xu hướng & Gợi ý kết nối.
- [x] 👤 **Trang cá nhân sinh viên / giảng viên (`/[username]`)**: Banner ảnh bìa, Avatar, Khoa/Viện, Mã SV, Niên khóa, 4 Tabs chuyển đổi (Bài viết, Tài liệu, Nhóm PBL, Huy hiệu thành tích) truy vấn 100% qua GraphQL `userProfile`.
- [x] 🧠 **Thuật Toán Đề Xuất Bài Viết Cá Nhân Hóa (Hybrid Recommendation Engine)**: Chấm điểm bài viết trên Tab *"Dành cho bạn"* kết hợp Môn học ($+40$), Cùng Khoa ($+30$), Cùng Niên khóa ($+15$), Người đang Follow ($+35$), Độ tương tác ($2\times L + 5\times C$) và Hệ số suy giảm thời gian (Time Decay $-2.0 / 24\text{h}$).
- [x] 📜 **Cuộn vô hạn bảng tin (Infinite Scroll Feed)**: Tải dữ liệu phân trang mượt mà qua `IntersectionObserver`, tự động lọc trùng ID (Deduplication) và bảo toàn vị trí cuộn.
- [x] 🤝 **Hệ thống theo dõi & Kết nối bạn bè (`user_follows`)**: Bảng quan hệ theo dõi sinh viên/giảng viên, tự động ưu tiên phân phối bài viết trên Bảng tin.

### 📝 Bảng Tin Học Thuật & Soạn Thảo (Academic Feed & Q&A)
- [x] ✍️ **Trình Soạn Thảo Độc Lập Chuẩn X ([`AcademicPostComposer`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/academic-post-composer.tsx))**: Soạn thảo trực tiếp trên đỉnh feed (không dùng popup modal thô cứng), tự động mở rộng, vòng đo độ dài ký tự SVG (Progress Ring), bộ chọn phạm vi người xem (Audience Menu) và bộ chọn môn học ([`ComposerCoursePicker`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/composer-course-picker.tsx)).
- [x] 📊 **Khảo Sát Biểu Quyết Sinh Viên (Post Polls & Voting)**: Bảng `post_polls`, `post_poll_options`, `post_poll_votes`, cho phép tạo câu hỏi khảo sát 2-4 lựa chọn ngay trong Composer, hiển thị thanh tiến trình % bình chọn sinh động thời gian thực ([`PostPollCard`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-poll-card.tsx)), endpoint `POST /api/posts/:id/vote-poll`.
- [x] 🔔 **Trung Tâm Thông Báo Nổi Realtime (Notification Hub Popover)**: Gắn icon Chuông trên Header ([`NotificationsPopover`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/notifications-popover.tsx)), hiển thị huy hiệu đếm chưa đọc, phân loại 9 loại sự kiện (like, comment, duyệt lời giải đúng, xin vào nhóm), nút "Đã đọc tất cả", endpoint `GET /api/notifications`, `PATCH /api/notifications/:id/read`, `PATCH /api/notifications/read-all`.
- [x] 🎖️ **Hệ Thống Huy Hiệu Định Danh Học Thuật Trực Quan ([`AcademicBadge`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/ui/academic-badge.tsx))**: Phân định rõ ràng vai trò người đăng bài/bình luận: 🎓 Giảng viên (Verified Lecturer), 🌟 Trợ giảng (TA), 👑 Ban Quản trị (Admin), 🏆 Top Contributor (Sinh viên có $\ge 300$ điểm danh vọng).
- [x] 🛠️ **Quản Lý Bài Viết Của Tôi & Báo Cáo Vi Phạm (Post Owner Actions & Moderation)**: Menu `...` trên `PostCard` cho phép tác giả chỉnh sửa nội dung/tiêu đề ([`EditPostDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/edit-post-dialog.tsx)), xóa bài viết kèm hoàn trừ post count môn học trong ACID transaction (`DELETE /api/posts/:id`), và hộp thoại báo cáo vi phạm nội dung ([`ReportPostDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/report-post-dialog.tsx), `POST /api/posts/:id/report`).
- [x] 🔗 **Phân Tích Cú Pháp Clickable Mentions `@` & Hashtags `#` ([`MarkdownPreview`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/renderer/markdown-preview.tsx))**: Tự động chuyển đổi `@username` thành liên kết đến trang cá nhân `/[username]` và `#tag` thành liên kết tìm kiếm chủ đề `/search?q=tag`.
- [x] 🎨 **Bộ Nhận Diện Mục Đích Học Thuật ([`ComposerIntentSelector`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/composer-intent-selector.tsx))**: Chọn phân loại: Thảo luận chung (`general`), Hỏi đáp (`qa`), Chia sẻ tài liệu (`document`), Tuyển nhóm PBL (`group_recruit`).
- [x] 🖼️ **Lưới Hiển Thị Ảnh Chuẩn X ([`PostMediaGallery`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-media-gallery.tsx))**: Hiển thị 1, 2, 3 hoặc 4 ảnh dạng mosaic grid với bo góc chuẩn $16\text{px}$, lớp phủ số lượng ảnh thừa `+N` và xem ảnh toàn màn hình.
- [x] 🔗 **Tính Năng Chia Sẻ Đa Dạng ([`PostCard`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-card.tsx))**: Dropdown menu: Sao chép liên kết (`Copy Link` + Toast), Gửi qua tin nhắn nhóm đồ án (`Via Chat`), Chia sẻ lên X (Twitter).
- [x] 🔖 **Hệ Thống Lưu Bài Viết & Yêu Thích (Bookmarks & Saved Posts)**: Bảng `saved_posts` trong PostgreSQL, endpoint `POST /api/posts/:id/bookmark`, tab *"Đã lưu"* trên Bảng tin (`feedType=bookmarks`), nút bấm Bookmark trực quan trên `PostCard` với phản hồi Toast tức thời.
- [x] 🏛️ **Bộ Tài Liệu Chuẩn Hóa Phân Hệ Core ([`/docs/core/`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/docs/core/README.md))**: 5 tài liệu phân tích và đặc tả kỹ thuật chi tiết 13 trụ cột của mạng xã hội học thuật PU Connection.
- [x] ⏰ **Định Dạng Thời Gian Tương Đối Chuẩn Tiếng Việt ([`formatRelativeTime`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/lib/utils.ts))**: Hiển thị "Vừa xong", "X phút trước", "X giờ trước", "X ngày trước" cho toàn bộ bài viết và bình luận.
- [x] 🏷️ **Hiển Thị Mã Môn Học Chuẩn Xác**: Thay thế toàn bộ mã UUID thô bằng mã môn học người dùng đọc được (ví dụ `📘 IT101`, `🏛️ FIT`).

### 🔍 Hệ Thống Tìm Kiếm & Khám Phá Chuẩn X (Search & Explore Engine)
- [x] 🧭 **Tích Hợp Tìm Kiếm Trực Tiếp Vào Navigation (Nav Search Item)**: Đặt tab Tìm kiếm / Khám phá (`/search`) tại vị trí thứ 2 trên cả **Mobile Bottom Nav** và **Desktop Sidebar**, truy cập 1 chạm tức thì.
- [x] 🌟 **Trang Khám Phá & Xu Hướng (Explore & Trending Hub - Mode A)**: Giao diện khi chưa nhập từ khóa:
  - Header với Avatar + Thanh tìm kiếm + Nút cài đặt tìm kiếm ⚙️.
  - 5 Tabs danh mục (*Khám phá, Xu hướng, Môn học hot, Đề thi & Slide, Nhóm PBL*).
  - Tin nổi bật Phenikaa (*Today's Academic Highlights*) và Bảng xếp hạng từ khóa thịnh hành (*Trending Topics*) với số lượng bài viết.
- [x] 📑 **Trang Kết Quả Tìm Kiếm Chuyên Sâu Chuẩn X (Active Search Stream - Mode B)**: Giao diện khi tìm kiếm từ khóa:
  - Header với Nút Back $\leftarrow$, Input từ khóa (kèm nút xóa $X$), và Menu tùy chọn 3 chấm $\cdots$.
  - 6 Tabs kết quả (*Hàng đầu, Mới nhất, Môn học, Tài liệu, Mọi người, Nhóm PBL*).
  - Luồng kết quả kết hợp bài viết, tài liệu, môn học, người dùng và nhóm đồ án.
- [x] ⚙️ **Cài Đặt & Bộ Lọc Tìm Kiếm Nâng Cao (Search Settings & Advanced Filter)**:
  - Bottom Action Sheet (`...`) mở Cài đặt tìm kiếm, Bộ lọc và Tìm kiếm nâng cao.
  - Dialog Cài đặt tìm kiếm ([`SearchSettingsDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/search/search-settings-dialog.tsx)) lưu trạng thái vào LocalStorage: Ẩn nội dung nhạy cảm, Loại bỏ tài khoản đã chặn, Ưu tiên môn học cùng Khoa/Viện.
  - Dialog Tìm kiếm nâng cao ([`AdvancedSearchDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/search/advanced-search-dialog.tsx)): Tìm theo cụm từ chính xác, hashtag, phân loại và khoa.
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
