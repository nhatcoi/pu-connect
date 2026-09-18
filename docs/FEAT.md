# PU Connector — Danh Mục Tính Năng & Lộ Trình Phát Triển (14 Domains Architecture)

Tài liệu theo dõi trạng thái các tính năng đã hoàn thành và kế hoạch phát triển (Roadmap) của hệ thống Mạng xã hội Sinh viên PU Connection.  
*Hệ thống tập trung 100% vào giá trị học thuật và kết nối sinh viên thực chất, loại bỏ hoàn toàn các yếu tố điểm thưởng/gamification và nhóm đồ án PBL rườm rà.*

---

## 1. Tính Năng Đã Hoàn Thành (Completed Features)

### 👤 Domain 1: Identity & Profile (Định Danh & Hồ Sơ Sinh Viên — Hoàn Thành 100%)
- [x] 🪪 **Hồ sơ sinh viên chuẩn hóa**: Mã SV (MSSV), Họ tên hiển thị, Username, Email, Bio, Avatar, Khoa/Viện (`faculty`), Niên khóa (`academic_year`), Trường (`school`), Ngành (`major`), Lớp (`class_name`).
- [x] 🏛️ **Cây Tổ chức Học thuật Đại học Phenikaa Chuẩn hóa (PU Academic Master Data & Constants)**: 7 Trường thành viên (`School`), các Khoa trực thuộc, Khoa độc lập (`Khoa Luật`, `Khoa Khoa học cơ bản`), 3 Viện nghiên cứu (PIAS, PHENA, PRATI), 4 Trung tâm và toàn bộ các Ngành đào tạo (`Major`), Niên khóa chuẩn hóa K14 - K19.
- [x] ⚡ **Bộ chọn học thuật thông minh 1 chạm ([`AcademicUnitSelector`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/profile/academic-unit-selector.tsx))**: Tìm kiếm tức thời theo tên/mã viết tắt, tự động suy luận phân cấp (`inferAcademicHierarchy`: chọn Ngành tự động điền Trường & Khoa), hỗ trợ chuyển đổi chế độ nhập tùy chỉnh (Custom Mode).
- [x] 🎓 **Chuyên ngành (`major`) & Lớp sinh hoạt (`class_name`)**: CSDL PostgreSQL bổ sung các cột chuyên sâu kèm B-Tree Index, hiển thị trực quan trên Header cá nhân.
- [x] 🔵 **Huy hiệu Tích Xanh chính quy (University Verification)**: Tự động cấp Tích Xanh cho sinh viên sử dụng email trường (`@phenikaa-uni.edu.vn` hoặc `@st.phenikaa-uni.edu.vn`), endpoint `POST /api/users/verify-university`.
- [x] ⚙️ **Cài đặt quyền riêng tư sinh viên ([`PrivacySettingsDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/profile/privacy-settings-dialog.tsx))**: Cho phép sinh viên chủ động bật/tắt hiển thị Email công khai, hiển thị MSSV, hiển thị Lớp sinh hoạt và Chế độ hồ sơ riêng tư.
- [x] 🛡️ **Lọc bảo mật dữ liệu phía Server**: Endpoint `GET /api/users/:username` và GraphQL `userProfile` tự động ẩn Email, MSSV, Lớp của sinh viên khi người xem không phải chính chủ và sinh viên đã tắt hiển thị.
- [x] ✏️ **Hộp thoại chỉnh sửa hồ sơ thích ứng Theme & Quản lý Ảnh Bìa Toàn diện ([`EditProfileDialog`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/profile/edit-profile-dialog.tsx))**: Endpoint `PATCH /api/users/profile`, 100% Theme Adaptive (Light/Dark mode bằng CSS semantic tokens `bg-card`, `border-border`, `bg-foreground text-background`), tải lên ảnh bìa R2 (`/api/upload/file?folder=banners`), bộ sưu tập 4 ảnh bìa campus mẫu (`Palette`), đặt lại ảnh bìa (`RotateCcw`), avatar camera overlay, thẻ *"Edit your photo with Imagine"* sinh avatar AI đa phong cách, tích hợp bộ chọn học thuật và `Birth date`.
- [x] 🤝 **Mạng lưới kết nối sinh viên & giảng viên (`user_follows`)**: Bảng quan hệ theo dõi, cơ chế `toggleFollow`, modal danh sách Followers & Following.
- [x] 🚫 **Loại bỏ triệt để Gamification & PBL Clutter**: Xóa bỏ vĩnh viễn việc cộng `reputation_points`, xóa nhãn "Điểm danh vọng" trên Header, PostCard, ProfileHeader, Onboarding và Comments; loại bỏ tab Nhóm PBL và tab Huy hiệu trên trang cá nhân `/[username]`.

### 🏗️ Kiến Trúc & Nền Tảng (Core & Infrastructure)
- [x] 📦 **Monorepo Turborepo + pnpm (`apps/web`, `apps/api`, `packages/schemas`)**: Tách biệt rõ ràng giữa Client, Server và Shared Library.
- [x] ⚡ **Quản lý tiến trình tập trung (`procman.yaml`)**: Chạy toàn bộ hệ thống (`db`, `api`, `web`) chỉ với 1 lệnh `procman up`.
- [x] 🗄️ **Cơ sở dữ liệu chuẩn hóa (`PostgreSQL 16 + pgvector`)**: Thiết kế DDL 12 bảng phân hệ học thuật, môn học, tài liệu, diễn đàn cộng đồng và tương tác.
- [x] 🛡️ **Quản lý ACID Transaction ([`DatabaseService.transaction`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/api/src/database/database.service.ts))**: Bọc mọi luồng ghi dữ liệu quan trọng trong atomic transaction với row-level lock (`FOR UPDATE`), tự động rollback khi có lỗi và cảnh báo `Slow Transaction [>300ms]`.
- [x] 🚀 **Chỉ mục hiệu năng cao**: Đánh chỉ mục **GIN Index** cho `tags`, `interests`, `skills` và Composite B-Tree Index cho `created_at DESC`, `major`, `class_name`, `is_verified`.
- [x] 🔐 **Xác thực phiên làm việc an toàn (`Session-based Auth & Passport.js`)**: Đăng ký, đăng nhập với cookie HttpOnly (`pu_session`), mã hóa bcrypt và phân quyền theo vai trò (`student`, `lecturer`, `ta`, `admin`).
- [x] 🚪 **Đăng xuất an toàn toàn diện (`Logout Flow & Session Invalidation`)**: Endpoint `POST /api/auth/logout` xóa cookie `pu_session`, hủy session trên server, reset sạch Client State Zustand và điều hướng tức thời về Landing Page (`/`).
- [x] 👥 **Dữ liệu giả lập thực tế (`Database Seeder - 100 Phenikaa Users`)**: Khởi tạo 100 tài khoản sinh viên và giảng viên phân bổ đủ 8 Khoa/Viện đào tạo.
- [x] 🚀 **Kiến Trúc Hybrid (GraphQL + REST API)**: Tích hợp Apollo Server `/graphql` cho dữ liệu quan hệ lồng nhau và REST API cho Session Auth, Profile updates, Upload File lớn.
- [x] 🌐 **Triển khai Máy chủ Production VPS & Domain Thực ([`https://puc.vnhat.dev`](https://puc.vnhat.dev))**:
  - Đóng gói toàn bộ hệ sinh thái qua kịch bản [`scripts/deploy.sh`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/scripts/deploy.sh) và lệnh `pnpm run deploy:vps`.
  - Cấu hình Nginx Reverse Proxy phân tách rõ ràng: `/` cho Next.js 15 SSR (port 3000), `/api/` & `/graphql` cho NestJS (port 4001), `/socket.io/` cho WebSocket và cache tĩnh 1 năm cho `/_next/static/`.
  - Tự động cấp và gia hạn chứng chỉ SSL Let's Encrypt qua Certbot đạt chuẩn bảo mật tối ưu (TLS 1.3, auto HTTP $\rightarrow$ HTTPS redirect).
  - Quản trị tiến trình qua Debian Systemd (`pu-web.service` và `pu-api.service`) tự động khởi động cùng hệ thống và tự phục hồi khi gặp sự cố.
  - Cơ sở dữ liệu Docker PostgreSQL 16 tích hợp extension `pgvector` với persistent volume `postgres_data`.

### 🎨 Chuyển Đổi Toàn Diện Sang Animate UI (Animate UI Migration & Motion Design)
- [x] 🎭 **Tích Hợp Toàn Diện Bộ Thư Viện Animate UI Chuẩn Hóa (`motion/react` + Radix UI Primitives)**:
  - Hiệu ứng vật lý lò xo (Spring Physics), tương tác mượt mà và Zero Layout Shift (CLS).
  - Đầy đủ bộ Primitives: `Button`, `Highlight`, `AutoHeight`, `Dialog`, `DropdownMenu`, `Tabs`, `Tooltip`, `Popover`, `Switch`.
  - Tái cấu trúc consumer components trong `src/components/ui/` đạt 100% Backward Compatibility.

### ☁️ Lưu Trữ Đám Mây & Tệp Tin (Cloudflare R2 Storage)
- [x] ☁️ **Tích hợp Cloudflare R2 Object Storage (`@aws-sdk/client-s3`)**: Lưu trữ media, ảnh đính kèm bài viết và tệp tài liệu học phần bảo mật với Zero Egress Fee.
- [x] 📤 **Endpoints Tải Lên Đa Năng (`/api/storage/upload` & `/api/storage/presigned-url`)**: Hỗ trợ upload ảnh bài viết, avatar, file slide/đề thi PDF kèm kiểm tra định dạng và kích thước.

### 🌐 Định Tuyến & Giao Diện Chuẩn X (Routing & Social UI)
- [x] 🌟 **Landing Page phong cách X (`/` - Happening now)**: Giao diện chào đón khi chưa đăng nhập, tự động chuyển tiếp sang `/home` nếu đã có session.
- [x] 📱 **Kiến Trúc Responsive Chuẩn X & Điều Hướng Di Động Hoàn Hảo**:
  - Tablet: Sidebar tự động thu gọn về dạng cột icon (`w-16`), loại bỏ 100% horizontal scroll.
  - Mobile (< 768px): Header chuẩn X tinh gọn, Tab bar dính chuẩn, Mobile Bottom Navigation Bar (5 phân hệ chính).
- [x] 🛡️ **Client Route Guard (`AuthGuard`)**: Bảo vệ toàn bộ các route nội bộ (`/home`, `/courses`, `/communities`...).
- [x] 🏛️ **Bảng tin 3 cột chuẩn X (`/home`)**: Sidebar điều hướng $\rightarrow$ Feed học thuật với Tab dính (*Dành cho bạn / Môn học / Kho tài liệu*) $\rightarrow$ Xu hướng & Gợi ý kết nối.
- [x] 🎨 **Tối Giản Hóa UI/UX Chuẩn X & Threads (Seamless Minimalist Stream & Widgets)**: Loại bỏ triệt để viền hộp 4 cạnh quanh từng bài viết, chuyển sang luồng liên tục phân cách bằng divider kẻ ngang mảnh (`border-b border-border/40`); hộp tạo bài viết phẳng trên đầu feed stream; thiết kế lại sidebar phải với 2 widget bo cong nhẹ (*Xu hướng cho bạn* và *Gợi ý theo dõi*) loại bỏ các đoạn mô tả dài dòng và ô vuông số liệu thô; search bar dạng viên thuốc (`rounded-full`); hashtags inline xanh tự nhiên; rút gọn nhãn khoa/viện và loại bỏ viền xám dày trên badges.
- [x] 👤 **Trang cá nhân sinh viên / giảng viên (`/[username]`)**: Banner ảnh bìa, Avatar kèm Tích Xanh, Chuyên ngành, Lớp sinh hoạt, Khoa/Viện, 3 Tabs học thuật chuẩn mực: **Bài viết**, **Tài liệu**, **Hỏi đáp Q&A**.
- [x] 🧠 **Thuật Toán Đề Xuất Bài Viết Cá Nhân Hóa (Hybrid Recommendation Engine)**: Chấm điểm bài viết trên Tab *"Dành cho bạn"* kết hợp Môn học ($+40$), Cùng Khoa ($+30$), Cùng Niên khóa ($+15$), Người đang Follow ($+35$), Độ tương tác và Hệ số suy giảm thời gian.

### 📝 Bảng Tin Học Thuật & Soạn Thảo (Academic Feed & Q&A)
- [x] ✍️ **Trình Soạn Thảo Độc Lập Chuẩn X ([`AcademicPostComposer`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/composer/academic-post-composer.tsx))**: Soạn thảo trực tiếp trên đỉnh feed, vòng đo độ dài ký tự SVG (Progress Ring), bộ chọn phạm vi người xem và bộ chọn môn học.
- [x] 📊 **Khảo Sát Biểu Quyết Sinh Viên (Post Polls & Voting)**: Tạo câu hỏi khảo sát 2-4 lựa chọn ngay trong Composer, hiển thị thanh tiến trình % bình chọn thời gian thực.
- [x] 🔔 **Trung Tâm Thông Báo Nổi Realtime (Notification Hub Popover)**: Gắn icon Chuông trên Header, phân loại 9 loại sự kiện học tập, nút "Đã đọc tất cả".
- [x] 🎖️ **Huy Hiệu Vai Trò Học Thuật Chính Thống ([`AcademicBadge`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/ui/academic-badge.tsx))**: 🎓 Giảng viên, 🌟 Trợ giảng (TA), 👑 Ban Quản trị, 👥 Chủ nhiệm CLB, 🎓 Cựu sinh viên.
- [x] 🎛️ **Menu Tùy Chọn 3 Chấm Chuẩn X**: Theo dõi tác giả, Ẩn bài viết không quan tâm, Báo cáo vi phạm, Ghim bài, Chỉnh sửa, Xóa an toàn.
- [x] 🎯 **Hàng Nút Tương Tác Chuẩn Hóa**: Tym (Like) → Bình luận (Comment) → Lưu (Bookmark) → Thống kê (Views) → Chia sẻ (Share).
- [x] 🔗 **Phân Tích Cú Pháp Mentions `@` & Hashtags `#`**: Tự động chuyển đổi `@username` đến trang cá nhân và `#tag` đến tìm kiếm.
- [x] 🖼️ **Lưới Hiển Thị Ảnh Chuẩn X ([`PostMediaGallery`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/post-media-gallery.tsx))**: Hiển thị 1-4 ảnh dạng mosaic grid với xem ảnh toàn màn hình.
- [x] 🔖 **Hệ Thống Lưu Bài Viết (Bookmarks & Saved Posts)**: Tab *"Đã lưu"* trên Bảng tin, lưu trữ PostgreSQL.

### 🔍 Hệ Thống Tìm Kiếm & Khám Phá Chuẩn X (Search & Explore Engine)
- [x] 🧭 **Tích Hợp Tìm Kiếm Trực Tiếp Vào Navigation**: Truy cập 1 chạm trên Bottom Nav và Sidebar.
- [x] 🌟 **Trang Khám Phá & Xu Hướng (Mode A)**: 5 Tabs danh mục, Tin nổi bật Phenikaa và Bảng xếp hạng từ khóa thịnh hành.
- [x] 📑 **Trang Kết Quả Tìm Kiếm Chuyên Sâu (Mode B)**: Kết hợp bài viết, tài liệu, môn học, người dùng và cộng đồng.
- [x] 🚀 **Backend Full-Text Search Engine ([`SearchService`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/api/src/modules/search/search.service.ts))**: Truy vấn song song PostgreSQL $<10\text{ms}$.

### 💬 Hệ Thống Bình Luận & Duyệt Lời Giải (Academic Comments & Q&A)
- [x] 💬 **Bình luận phân cấp & Phân trang ([`PostCommentsSection`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/components/social/comments/post-comments-section.tsx))**: Tải trước 3 bình luận, trả lời lồng nhau và thu gọn phản hồi.
- [x] 🎯 **Cơ Chế Duyệt Lời Giải Chính Xác (Accepted Solution)**: Tác giả bài viết Q&A có quyền chọn và ghim câu trả lời chính xác lên đầu, hiển thị huy hiệu xanh lá và đánh dấu bài viết `[Đã giải quyết]`.

### 📚 Kho Tài Liệu & Đề Thi Học Phần (Knowledge Vault)
- [x] 📑 **Phân loại tài liệu đa định dạng (`PDF`, `Code`, `Sheet`, `Markdown`)**: Tra cứu theo mã học phần và thẻ tag.
- [x] 👁️ **Trình xem trước In-App (`PdfViewer` & `DocumentPreviewModal`)**: Xem trực tiếp file PDF với thanh công cụ phóng to/thu nhỏ.
- [x] 📤 **Thêm & chia sẻ tài liệu**: Upload và lưu trữ Cloudflare R2 + PostgreSQL.

### 🏛️ Diễn Đàn & Tiểu Cộng Đồng (Reddit-style Sub-Communities)
- [x] 🏛️ **Cơ sở dữ liệu Sub-Communities (`communities` & `community_members`)**: 5 cộng đồng cốt lõi Phenikaa (`c/phenikaa`, `c/fit`, `c/do-an-tot-nghiep`, `c/tim-phong-tro`, `c/clb-hoat-dong`).
- [x] ⚡ **Endpoints Backend Sub-Communities**: `GET /api/communities`, `GET /api/communities/:slug`, `POST /api/communities/:slug/join`, `GET /api/communities/:slug/posts` (`hot`, `new`, `top`).
- [x] 🌐 **Trang Diễn Đàn Sinh Viên Chuyên Sâu ([`/c/[slug]`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/app/c/[slug]/page.tsx))**: Banner, Avatar, Thống kê, Nút gia nhập đàn hồi, 4 tabs nội dung.
- [x] 🧭 **Trang Danh Bạ Cộng Đồng Toàn Trường ([`/communities`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/apps/web/src/app/communities/page.tsx))**: Duyệt theo 6 danh mục, tìm kiếm, nút tham gia nhanh.

---

## 2. Kế Hoạch Triển Khai Tiếp Theo Theo 14 Domains (Roadmap)

1. **Domain 5: Study / Academic (Nâng Cấp Knowledge Vault & GPA Tool)**: Tra cứu lịch thi, đánh giá môn học & giảng viên, công cụ dự báo điểm GPA tốt nghiệp.
2. **Domain 6: Student Marketplace (`/marketplace`)**: Mua bán giáo trình cũ, đồ dùng ký túc xá/phòng trọ, tìm bạn ở ghép, mục việc làm freelance/gia sư.
3. **Domain 7: Career & Alumni (`/career`)**: Bảng tin thực tập, CV/Portfolio số sinh viên, Mạng lưới Cựu sinh viên (Alumni Mentorship).
4. **Domain 8: Events (`/events`)**: Form đăng ký tham gia sự kiện campus, vé mã QR Check-in.
5. **Domain 9: Clubs & Organizations (`/clubs/[slug]`)**: Hub riêng cho CLB, quản lý thành viên ban/đội, đợt tuyển quân.
6. **Domain 10: Realtime Messaging (`/messages`)**: Chat 1-1 giữa sinh viên, chat kênh cộng đồng, trạng thái online.
7. **Domain 13: AI Layer (PU AI Study Assistant - RAG)**: Hỏi đáp dựa trên kho slide và đề thi của trường qua `pgvector`.
