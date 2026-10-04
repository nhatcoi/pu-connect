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
- [x] 🔌 **Messaging & AI — P0 Nền tảng** ([thiết kế](./core/06-messaging-and-ai.md)):
  - Session lưu PostgreSQL (`connect-pg-simple`, bảng `user_sessions`) dùng chung cho HTTP & Socket.IO ⇒ restart/deploy không còn đăng xuất người dùng. `SESSION_SECRET` bắt buộc ở production.
  - CORS có credentials chỉ cho `APP_URL` / `CORS_ORIGINS` (+ localhost khi dev) thay vì mọi origin.
  - `RealtimeGateway` (`/api/socket.io`): xác thực bằng cookie `pu_session`, từ chối socket ẩn danh, chặn Cross-Site WebSocket Hijacking (`allowRequest` kiểm tra Origin), room do server cấp (`user:{id}`). Gỡ `join_room` / `send_message` / broadcast toàn cục cũ (cho phép nghe lén & giả mạo người gửi).
  - Thông báo đẩy realtime: `NotificationsService.createNotification` emit `notification` vào `user:{id}`; chuông thông báo (`useRealtimeEvent`) tải lại ngay, polling chỉ còn dự phòng 120 s.
  - `users.account_type` (`human`/`bot`/`system`) + tài khoản bot **`@puai`** (không thể đăng nhập bằng mật khẩu/Google, không xuất hiện trong "Gợi ý theo dõi"). Username dành riêng (`puai`, `pu_*`, `admin`, route…) không thể đăng ký.
  - `@mention` dùng chung (bảng `mentions`, `MentionsService`): ghi trong cùng transaction tạo/sửa post & comment, chỉ thông báo người **mới** được nhắc, bỏ qua email/URL; mention bot để dành cho AI layer (P3).
  - Migration `messaging-upgrade.sql` (idempotent, chạy trong `deploy.sh`).
- [x] 🔔 **Notification v1** ([đặc tả](./core/05-notifications-and-realtime.md#6-triển-khai-v1-đang-chạy)):
  - `NotificationsService.dispatch()`: lọc (không tự báo, bot, cài đặt người nhận), mỗi người 1 thông báo/sự kiện theo ưu tiên `comment_reply > user_mention > post_comment`, ghi sau commit.
  - Loại: `post_like`, `post_comment`, `comment_reply`, `user_mention`, `user_follow`, `accepted_solution`, `account_verified` (+ enum `ai_reply` cho P3).
  - Gộp *"A và N người khác…"* bằng upsert nguyên tử (`group_key`, `actor_ids`, unique index một phần) — bỏ thích rồi thích lại không báo lại.
  - API cursor pagination, `unread-count`, `settings`; socket `notification` + `notification.read` (đồng bộ đã đọc giữa các tab); xóa thông báo đã đọc > 90 ngày.
  - Web: store dùng chung, toast có nút **Xem**, trang **`/notifications`** (Tất cả/Chưa đọc/Nhắc đến, cài đặt theo loại), trang **`/post/[id]`** (mở sẵn bình luận, highlight `?comment=`), mục Thông báo ở sidebar.
- [x] 🛡️ **Vá lỗ hổng mạo danh**: controller không còn fallback sang user đầu tiên khi chưa đăng nhập (`requireUserId`); tạo học phần/sự kiện giới hạn theo vai trò; study group lấy danh tính từ session. Upload (`/api/upload/*`) bắt buộc đăng nhập + chỉ nhận thư mục/MIME cho phép; giới hạn đăng nhập sai (10 lần/15 phút/IP+tài khoản); tắt GraphQL playground/introspection ở production.
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

### 🎨 Brand Phenikaa (Navy + Cam) & Landing Mới
- [x] Logo `PuMark`/`PuLogo` (`components/brand/pu-logo.tsx`): chữ U + vòm cam kết nối; dùng ở landing, header, favicon (`app/icon.tsx`).
- [x] Palette chủ đạo: `--primary` navy `#0b3d91`, `--brand-orange` `#f7941d` (dark mode sáng hơn) trong `globals.css`, thay màu đen.
- [x] Landing (`app/page.tsx`): headline mới, nút dùng animate-ui `Button`, khối tài khoản seed chỉ hiện ở `NODE_ENV=development`.
- [x] Vector động bên phải (`components/brand/hero-network.tsx`): mạng lưới nút, cạnh nét đứt chạy, gói dữ liệu, sóng lan, chip nổi (motion/react).
- [x] Home gọn mắt: nền `--surface` + bài viết dạng thẻ (`PostCard variant="card"`), bỏ viền cột/header; chữ nhỏ hơn (13–15px); sidebar 224px chỉ nav + môn sôi nổi (bỏ chip khoa, bỏ CTA trùng); cột phải phẳng, 3 gợi ý, `FollowButton variant="outline"`; bài dài thu gọn ~5 dòng + "Xem thêm".
- [x] Bố cục surface + thẻ áp đồng bộ cho `/communities`, `/[username]`, `/c/[slug]`, `/search` (bỏ `border-x`, header sticky nền surface, nội dung/section dạng thẻ, PostCard `variant="card"`, banner hồ sơ navy).
- [x] Feature flags `apps/web/src/lib/features.ts`: tạm ẩn tính năng chưa có backend/dữ liệu thật (SSO, QR app, footer link chết, lối tắt Học phần/Tài liệu/Hỏi đáp, Môn học sôi nổi, Xu hướng/Tin nổi bật, sub-tab Khám phá, lượt xem & phân tích bài, nhắn tin/chia sẻ chat, chọn đối tượng xem). Thông báo bỏ dữ liệu giả khi lỗi. Bật lại = đổi flag sang `true`.
- [x] Onboarding `/get-started` rút gọn 4 bước → 1 màn hình: vai trò, khóa, mã SV/cán bộ (đều tùy chọn), tự theo dõi gợi ý, nút "Bỏ qua". Bỏ chọn Khoa/Viện, môn học, kỹ năng.
- [x] Animation nav chính theo animate-ui `Highlight`: sidebar có pill hover trượt (như menu dropdown); `SlidingTabs` (`components/navigation/sliding-tabs.tsx`) gạch chân trượt cho tab Bảng tin, Hồ sơ, Tìm kiếm.
- [x] Auth thật: đăng nhập/đăng ký Email + mật khẩu (validate zod, bcrypt cost 12, username tự sinh) và Google OAuth (`GET /auth/google`, callback, liên kết theo email đã xác thực). Nút Google tự ẩn khi chưa cấu hình `GOOGLE_*`. Bỏ nút "Tiếp tục với Email sinh viên", khối tài khoản seed và mật khẩu điền sẵn. Xem `docs/auth-google.md`.
- [x] Đăng nhập nhập-email-trước (animation hiện mật khẩu / họ tên), xác thực email sau đăng ký (`/verify-email`, thanh nhắc, gửi lại), chặn chiếm tài khoản khi liên kết Google, tiêu đề landing "Mạng xã hội học thuật cộng đồng". Cần cấu hình SMTP để gửi mail thật (xem `docs/auth-google.md`).
- [x] Bỏ bước `/get-started` bắt buộc: vào `/home` ngay sau đăng ký; mã SV/khóa tự suy từ email trường; thẻ "Hoàn thiện hồ sơ" không chặn (`?edit=1` mở hộp chỉnh sửa). Không còn dữ liệu giả điền sẵn trong hộp chỉnh sửa hồ sơ. Đăng ký email + mật khẩu không còn tự cấp tích xanh (chỉ Google).
- [x] Seed local rút gọn: 12 user, 24 bài, 16 bình luận (backup trước khi xóa). Chỉ ảnh hưởng DB local `pu_postgres`.

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
6. **Domain 10: Realtime Messaging (`/messages`)**: Chat 1-1 giữa sinh viên, chat kênh cộng đồng, trạng thái online. Thiết kế: [`core/06-messaging-and-ai.md`](./core/06-messaging-and-ai.md).
7. **Domain 13: AI Layer (PU AI Study Assistant - RAG)**: Hỏi đáp dựa trên kho slide và đề thi của trường qua `pgvector`. `@puai` là bot user, dùng chung pipeline nhắn tin — xem [`core/06-messaging-and-ai.md`](./core/06-messaging-and-ai.md).
