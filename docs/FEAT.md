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
- [x] 📲 **Web Push + BullMQ/Redis** ([đặc tả mục 7](./core/05-notifications-and-realtime.md#7-triển-khai-v2--web-push--bullmq-đang-chạy)): hàng đợi `notification-push` (delay 30s, retry/backoff, hoãn theo giờ yên tĩnh, ≤ 20 push/giờ, bỏ qua khi đã đọc hoặc tab đang hiển thị), VAPID + `web-push`, bảng `push_subscriptions` (tự xóa đăng ký hết hạn), `public/sw.js`, cài đặt **loại × kênh** + giờ yên tĩnh, nút Bật/Gửi thử trong `/notifications`, hủy push khi đăng xuất. Redis chạy localhost-only trong `docker-compose`.
- [x] 🔑 **Quên mật khẩu** (`/forgot-password`, `/reset-password`): `POST /auth/forgot-password` luôn trả `{sent:true}` dù email có tồn tại hay không (chống dò tài khoản), gửi email nền; token 256-bit lưu **SHA-256**, hết hạn 30 phút, dùng một lần (UPDATE nguyên tử). Giới hạn 5/15 phút/IP + 3/giờ/email, cách nhau ≥ 60s/tài khoản. `POST /auth/reset-password` đổi mật khẩu, **đăng xuất mọi phiên** (xóa `user_sessions`), gửi email cảnh báo đổi mật khẩu. Tài khoản Google-only có thể đặt mật khẩu qua luồng này. Migration trong `auth-upgrade.sql` (`reset_token_*`, `password_changed_at`). Link "Quên mật khẩu?" ở bước nhập mật khẩu của form đăng nhập.
- [x] ⚡ **Chuyển trang tức thì — quản lý state chuẩn** ([ADR](./core/08-web-state.md)): route group `app/(app)` với `AppLayout` dựng **một lần** (Header, Sidebar, RightSidebar, socket, hộp thoại toàn cục; cột phải riêng qua `PageAside`). Dữ liệu server chuyển sang **TanStack Query** (feed theo tab, bài viết, bình luận, hồ sơ, cộng đồng, gợi ý, search, thông báo); `/auth/me` chỉ gọi 1 lần (`useSession`). Cập nhật lạc quan đồng bộ một bài ở mọi danh sách (`patchPostEverywhere`), tải trước khi rê chuột (tab feed, hồ sơ, cộng đồng). Feed & cộng đồng **ảo hóa** (`VirtualPostList`: chỉ ~10 bài trong DOM, lưu kích thước đo để Back về đúng bài). Đo: quay lại home/search/communities/profile **0 request, không spinner**, Back giữ vị trí cuộn.
- [x] 🔎 **Search chuẩn** ([thiết kế & quy tắc](./core/07-search.md)): full-text Postgres (`unaccent` + `simple`) khớp tiền tố, bỏ dấu tiếng Việt (`giai tich` = `Giải tích`), lọc từ nối, `#tag` / `@username`, **gõ sai** bằng trigram (`overfiting` → Overfitting), xếp hạng (chữ A>B>C + khớp tên + phổ biến + mới). **Sửa lỗi quyền xem**: tài liệu/bài riêng tư không còn lộ qua search; ẩn tài khoản bị khóa và tài khoản hệ thống. Cột `search_tsv` generated + chỉ mục GIN/trigram (`search-upgrade.sql`); bảng `search_logs` (không lưu người dùng, giữ 180 ngày) để biết từ khóa **không có kết quả**. Đo 50.000 bài: ~20 ms.
- [x] 💾 **Backup & giám sát vận hành** (`scripts/ops/`): backup Postgres hằng ngày (dump → gzip → AES-256 → R2 + local, xoay vòng 30 ngày/7 bản), `restore-db.sh` kiểm tra khôi phục vào DB tạm (đã thử thật: 23 bảng, 108 users), `healthcheck.sh` mỗi 5 phút (web/API/systemd/Docker/Postgres/đĩa/RAM/tuổi backup) chỉ báo khi đổi trạng thái; cảnh báo Telegram tùy chọn. Cài bằng `setup-ops.sh`.
- [x] 💬 **Bình luận 2 cấp** (fix phản hồi của phản hồi không hiển thị): hiển thị kiểu Facebook/YouTube — bình luận gốc + 1 luồng phản hồi phẳng. Trả lời một phản hồi ⇒ lưu `parent_id` = bình luận gốc (recursive CTE), `@username` tự chèn giữ ngữ cảnh, thông báo `comment_reply` vẫn gửi tác giả phản hồi được trả lời. `GET /posts/:id/comments` phân trang theo **bình luận gốc** và trả kèm toàn bộ phản hồi (`nextOffset`); dữ liệu cũ sâu > 2 cấp được web gom về gốc. Xóa bình luận trừ `comments_count` đúng số dòng bị CASCADE; bộ đếm trên PostCard đồng bộ với danh sách.
- [x] 🖼️ **Chặn lưu ảnh blob**: upload ảnh đại diện/ảnh bìa lỗi ⇒ giữ ảnh cũ + báo lỗi (bỏ fallback `blob:` chỉ tồn tại trên máy người dùng); API `PATCH /users/profile` chỉ nhận `https://` hoặc đường dẫn nội bộ.
- [x] 🍞 **Quy ước toast** (fix toast trùng khi theo dõi): `FollowButton` gọi `onFollowChange` 2 lần (optimistic + xác nhận server) nên toast trong callback hiện 2 lần. Quy ước: **toast = phản hồi hành động của chính mình khi kết quả không tự hiện trên UI** (sao chép link, báo cáo, lưu, xóa, lỗi); **notification = việc người khác làm với mình**. Thao tác đã đổi trạng thái tại chỗ (nút Theo dõi) không toast thành công, chỉ toast khi lỗi/rollback. Đã bỏ toast thừa (bình chọn, ghim, chọn/tải ảnh trong hộp thoại hồ sơ) và rút gọn câu chữ ("Đã đăng bài viết" thay "…vào cơ sở dữ liệu thành công!"); upload ảnh lỗi ⇒ cảnh báo đang dùng ảnh xem trước.
- [x] 🔒 **Hạ tầng**: Postgres chỉ bind `127.0.0.1` (trước đó mở ra Internet qua Docker, bị dò mật khẩu hàng nghìn lần), đổi mật khẩu DB production, build tuần tự khi deploy (VPS 2GB).
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
- [x] Logo `PuMark`/`PuLogo` (`components/brand/pu-logo.tsx`): logo **PU** (chữ P xanh + U/i cam, node kết nối) thay logo cũ; render bằng `<img src="/brand/pu-mark.svg">` (không inline SVG để gradient id không xung đột khi một bản bị `display:none`). Dùng ở landing, header, auth, skeleton, thông báo hệ thống.
- [x] Logo trợ lý AI **N7AI** (`N7AiMark`, `/brand/n7ai-mark.svg`): avatar hội thoại PU AI, avatar bot `@puai` trong tin nhắn & danh sách reaction, thẻ "Học cùng PU AI", nút mở PU AI ở `/messages`.
- [x] Bộ asset `apps/web/public/brand/`: `pu-mark.svg`, `pu-logo-full(-dark).svg`, `n7ai-mark.svg`, `n7ai-logo-full(-dark).svg` (vector hoá từ ảnh gốc, chữ đã chuyển thành path), `icon-192.png`/`icon-512.png` (nền trắng), `badge-96.png` (nền trong suốt cho badge Web Push). Favicon = `app/icon.svg` + `public/favicon.ico`; `app/apple-icon.png` 180px thay route `icon.tsx`/`apple-icon.tsx`; `sw.js` dùng `/brand/icon-192.png` + `/brand/badge-96.png`.
- [x] Palette chủ đạo: `--primary` navy `#0b3d91`, `--brand-orange` `#f7941d` (dark mode sáng hơn) trong `globals.css`, thay màu đen.
- [x] Landing (`app/page.tsx`): headline mới, nút dùng animate-ui `Button`, khối tài khoản seed chỉ hiện ở `NODE_ENV=development`.
- [x] Cột phải landing: chỉ logo `PuMark` lớn, tĩnh (ẩn dưới `lg` vì đã có logo nhỏ); bỏ vector mạng lưới động `hero-network.tsx`.
- [x] Home gọn mắt: nền `--surface` + bài viết dạng thẻ (`PostCard variant="card"`), bỏ viền cột/header; chữ nhỏ hơn (13–15px); sidebar 224px chỉ nav + môn sôi nổi (bỏ chip khoa, bỏ CTA trùng); cột phải phẳng, 3 gợi ý, `FollowButton variant="outline"`; bài dài thu gọn ~5 dòng + "Xem thêm".
- [x] Bố cục surface + thẻ áp đồng bộ cho `/communities`, `/[username]`, `/c/[slug]`, `/search` (bỏ `border-x`, header sticky nền surface, nội dung/section dạng thẻ, PostCard `variant="card"`, banner hồ sơ navy).
- [x] Feature flags `apps/web/src/lib/features.ts`: tạm ẩn tính năng chưa có backend/dữ liệu thật (SSO, QR app, footer link chết, lối tắt Học phần/Tài liệu/Hỏi đáp, Môn học sôi nổi, Xu hướng/Tin nổi bật, sub-tab Khám phá, lượt xem & phân tích bài, nhắn tin/chia sẻ chat, chọn đối tượng xem). Thông báo bỏ dữ liệu giả khi lỗi. Bật lại = đổi flag sang `true`.
- [x] Onboarding `/get-started` rút gọn 4 bước → 1 màn hình: vai trò, khóa, mã SV/cán bộ (đều tùy chọn), tự theo dõi gợi ý, nút "Bỏ qua". Bỏ chọn Khoa/Viện, môn học, kỹ năng.
- [x] Animation nav chính theo animate-ui `Highlight`: sidebar có pill hover trượt (như menu dropdown); `SlidingTabs` (`components/navigation/sliding-tabs.tsx`) gạch chân trượt cho tab Bảng tin, Hồ sơ, Tìm kiếm.
- [x] Auth thật: đăng nhập/đăng ký Email + mật khẩu (validate zod, bcrypt cost 12, username tự sinh) và Google OAuth (`GET /auth/google`, callback, liên kết theo email đã xác thực). Nút Google tự ẩn khi chưa cấu hình `GOOGLE_*`. Bỏ nút "Tiếp tục với Email sinh viên", khối tài khoản seed và mật khẩu điền sẵn. Xem `docs/auth-google.md`.
- [x] Đăng nhập nhập-email-trước (animation hiện mật khẩu / họ tên), xác thực email sau đăng ký (`/verify-email`, thanh nhắc, gửi lại), chặn chiếm tài khoản khi liên kết Google, tiêu đề landing "Mạng xã hội học thuật cộng đồng". Cần cấu hình SMTP để gửi mail thật (xem `docs/auth-google.md`).
- [x] Bỏ bước `/get-started` bắt buộc: vào `/home` ngay sau đăng ký; mã SV/khóa tự suy từ email trường; thẻ "Hoàn thiện hồ sơ" không chặn (`?edit=1` mở hộp chỉnh sửa). Không còn dữ liệu giả điền sẵn trong hộp chỉnh sửa hồ sơ. Đăng ký email + mật khẩu không còn tự cấp tích xanh (chỉ Google).
- [x] Trang pháp lý công khai `/terms` (Điều khoản dịch vụ) và `/privacy-policy` (Chính sách bảo mật): route group `app/(legal)` + `components/legal/legal-document.tsx` (mục lục, anchor), link dùng chung `lib/legal.ts` ở footer landing, lời đồng ý dưới form đăng nhập và cột phải. Nội dung bám dữ liệu hệ thống thực sự lưu (hồ sơ, R2, push, PU AI, Google OAuth), dẫn chiếu Nghị định 13/2023/NĐ-CP. Bỏ flag `legalPages` và các link footer chết.
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

### 🎓 Trang Học Phần (Course Hub — 2026-10-13)
- [x] 🧭 **[`/courses`](../apps/web/src/app/(app)/courses/page.tsx)**: danh mục học phần, tìm theo mã/tên không dấu; mục "Học phần" ở sidebar & bottom nav.
- [x] 📘 **[`/courses/[code]`](../apps/web/src/app/(app)/courses/[code]/page.tsx)**: 3 tab *Thảo luận & Hỏi đáp* (composer gắn sẵn mã môn), *Tài liệu & Đề thi*, *Nhóm học* (tham gia trực tiếp); số liệu câu hỏi / đã giải / tài liệu / nhóm đang tuyển; cột phải "Đóng góp nhiều nhất". Endpoint `GET /api/courses/:code/overview`, bộ lọc `course=` cho `GET /api/posts`, `GET /api/documents`.
- [x] 🔗 Mã môn trên PostCard, CourseCard, kết quả tìm kiếm dẫn tới trang học phần.
- [x] 💾 **Nhóm học lưu PostgreSQL** (trước đây giữ trong bộ nhớ, mất khi restart): tạo nhóm + trưởng nhóm và tham gia nhóm là transaction có `FOR UPDATE` (không vượt sĩ số).
- [x] 💬 **Nhóm học ↔ nhóm chat** (migration `chat-study-group-upgrade.sql`, `conversations.study_group_id` UNIQUE): nút *Mở nhóm chat* trên thẻ nhóm học (`POST conversations/study-groups/:groupId`) tạo lười nhóm chat với toàn bộ thành viên (trưởng nhóm học = trưởng nhóm chat, khóa `FOR UPDATE` chống tạo trùng); ai tham gia nhóm học sau được tự thêm vào chat (`StudyGroupChatService.onStudyGroupJoined`); rời chat vẫn mở lại được khi còn trong nhóm học.
- [x] 🔔 **Web Push cho tin nhắn** (queue `chat-push`, `chat/notify/`): tin mới (kể cả PU AI trả lời xong) ⇒ push sau 15s nếu chưa đọc và không mở app; gộp nhiều tin thành 1 thông báo/hội thoại ("Nhóm X · 3 tin mới"), tôn trọng tắt tiếng hội thoại, giờ yên tĩnh và công tắc **Tin nhắn mới** trong cài đặt thông báo (kênh `chat_message`). Đọc hội thoại ở một thiết bị ⇒ thông báo đã hiện ở thiết bị khác tự đóng (push im lặng `kind: close`, migration `chat-push-clear-upgrade.sql`; trừ Safari/iOS).

### 🛡️ Quản Trị Tối Giản (Admin — 2026-10-13)
- [x] 🔒 **Chặn tài khoản `suspended`**: đăng nhập mật khẩu trả 403 (chỉ sau khi đúng mật khẩu ⇒ không lộ trạng thái), Google OAuth về `/?auth_error=suspended`, phiên cũ hết hiệu lực ở `deserializeUser` (HTTP lẫn socket).
- [x] 🧑‍⚖️ **[`/admin`](../apps/web/src/app/(app)/admin/page.tsx)** (role `admin`, `AdminGuard`): báo cáo gom theo bài (ẩn bài / hiện lại / bỏ qua), tìm & khóa / mở khóa tài khoản (hủy session + ngắt socket ngay), từ khóa tìm kiếm không có kết quả, nhật ký thao tác `admin_audit_logs`. Migration `admin-upgrade.sql`.
- [x] 🙈 Bài bị ẩn không xuất hiện ở feed, cộng đồng, tìm kiếm, GraphQL; tác giả vẫn xem được bài của mình.

### 💬 Nhắn Tin & PU AI (Domain 10 + 13 — 2026-10-13)
- [x] 💬 **[`/messages`](../apps/web/src/app/(app)/messages/page.tsx)**: DM 1-1, nhóm (≤ 50), tin nhắn lạc quan + `clientMsgId` idempotent, đã đọc, đang nhập, thu hồi, badge chưa đọc ở sidebar/bottom nav, nút Nhắn tin trên hồ sơ. Realtime qua `message.*` / `typing`.
- [x] ✨ **PU AI** (`POST /api/conversations/ai`): trả lời streaming qua API tương thích OpenAI (`AI_BASE_URL`, `AI_MODEL` mặc định `v9`), truy xuất bài viết & tài liệu liên quan bằng full-text và trích nguồn, quota `AI_DAILY_QUOTA`/ngày. Thiết kế & phần còn thiếu: [`core/06-messaging-and-ai.md` §12](./core/06-messaging-and-ai.md).
- [x] 📎 **Chat P2 — tệp, trả lời, cảm xúc, ghim, sửa tin** (migration `chat-v2-upgrade.sql`): đính kèm ≤ 10 ảnh/tệp mỗi tin (tải lên R2 `chat/{userId}/` có thanh tiến trình, dán ảnh, kéo thả; server chỉ nhận tệp đúng thư mục của người gửi), lưới ảnh + xem lớn, thẻ tệp; trả lời trích dẫn (bấm để nhảy tới tin), 6 cảm xúc (`POST messages/:id/reactions`) + hộp thoại **ai đã thả cảm xúc** theo tab emoji, gỡ cảm xúc của mình (`GET messages/:id/reactions`), ghim tin + thanh tin ghim (`POST messages/:id/pin`), sửa tin trong 15 phút (`PATCH messages/:id`), "Đã xem"/"N người đã xem" (`conv.read` gửi mọi thành viên), vạch ngày & gộp tin liên tiếp.
- [x] 👥 **Nhóm chat**: đổi tên & **ảnh nhóm** (`PATCH conversations/:id` nhận `avatarKey` — ảnh do chính người đổi tải lên `avatars/{userId}/`, server tự suy URL R2; tin hệ thống "đã đổi ảnh nhóm"), thêm thành viên (mọi người) / xóa (trưởng nhóm) (`POST/DELETE conversations/:id/members`), chuyển quyền trưởng nhóm thủ công (`POST conversations/:id/owner`, menu `⋯` có xác nhận) hoặc tự động khi trưởng nhóm rời, tin hệ thống "A đã thêm B…". Cài đặt riêng: tắt thông báo 1h/8h/24h/vô hạn (không tính vào badge), ghim hội thoại lên đầu (`PATCH conversations/:id/settings`). Bảng thông tin (cột phải / hộp thoại mobile): thành viên, kho Ảnh/Tệp (`GET conversations/:id/attachments`), Đã ghim, tìm tin không dấu (`GET conversations/:id/messages/search`). Danh sách lọc Tất cả / Chưa đọc / Nhóm.
- [x] 🎓 **PU AI học tập**: 6 chế độ (Hỏi đáp, Giải thích, Quiz, Flashcard, Tóm tắt, Lộ trình ôn) — chế độ đổi chỉ dẫn hệ thống (`puai.prompts.ts`); Quiz/Flashcard trả JSON trong khối ```` ```quiz ```` / ```` ```flashcards ```` ⇒ web dựng **quiz chấm điểm** và **bộ thẻ lật** tương tác. PU AI đọc **ảnh đính kèm** (vision, base64 ≤ 4 ảnh) và **nội dung tệp PDF / DOCX / .txt/.md/.csv** (`pdf-parse` ≤ 40 trang, `mammoth`; ≤ 40k ký tự/tệp, cache theo key R2), hỏi tiếp tự dùng lại tài liệu gần nhất trong chủ đề; gọi **`@puai` trong nhóm chat** (trả lời trích tin người hỏi, tính quota người hỏi); "Chủ đề mới" (`POST ai/conversations/:id/reset`) làm mới ngữ cảnh; hiện lượt còn lại. Chi tiết: [`core/06` §13](./core/06-messaging-and-ai.md).

### 🎯 Cá Nhân Hóa & Gợi Ý PU AI (2026-10-14)
- [x] Ghi hành vi ngầm `user_events` (bài xem ≥ 2s, mở bài/tài liệu, tải tài liệu, tìm kiếm, bấm kết quả, bấm gợi ý) qua `POST /api/events` theo lô (`lib/track.ts`), giữ 90 ngày.
- [x] Hồ sơ quan tâm `user_interests` (môn / tag / từ khóa) tính bằng SQL từ đăng bài, lưu, bình luận, cảm xúc, nhóm học, câu hỏi PU AI và sự kiện; suy giảm nửa đời 14 ngày; worker BullMQ làm mới mỗi giờ (`modules/personalization/`).
- [x] `GET /api/ai/suggestions?mode=`: gợi ý PU AI theo chủ đề quan tâm × mẫu câu từng chế độ (thay thẻ viết cứng ở client); chọn chế độ giữa hội thoại mở bảng gợi ý trên ô soạn.
- [x] PU AI trả kèm 3 câu hỏi tiếp theo trong cùng lượt gọi (`meta.followUps`), hiện thành chip dưới câu trả lời.
- [x] Bảng tin For You cộng điểm bài khớp hồ sơ quan tâm.
- [x] Công tắc "Cá nhân hóa gợi ý" (`privacySettings.personalization`): tắt ⇒ ngừng ghi, xóa dữ liệu hành vi & hồ sơ. Test `apps/api/test/personalization.e2e-spec.ts`. Chi tiết: [`core/06` §19](./core/06-messaging-and-ai.md).

### ⚡ Hiệu Năng Chat (2026-10-14)
- [x] Danh sách hội thoại phân trang keyset 20/trang, lọc Tất cả/Chưa đọc/Nhóm ở server, cuộn xuống tải thêm.
- [x] Tin mới / đã đọc vá cache danh sách & badge từ sự kiện socket thay vì tải lại; mở hội thoại dùng lại dữ liệu danh sách; đồng bộ lại khi socket nối lại.
- [x] Tin nhắn cũ tự tải khi cuộn lên, giữ vị trí đang đọc. Chi tiết: [`core/06` §18](./core/06-messaging-and-ai.md).

### 🔗 Liên Kết N7AI (2026-10-14)
- [x] "Mở trong N7AI" (`components/chat/ai/open-in-n7ai.tsx`): nút ở đầu hội thoại PU AI + thẻ ở màn chào PU AI, mở `n7ai.vnhat.dev/#/ai` ở tab mới. PU AI lo nội dung trên PU Connector; N7AI lo dữ liệu trường (lịch học, lịch thi, Canvas qua extension). URL đổi bằng `NEXT_PUBLIC_N7AI_URL` (`lib/n7ai.ts`).

### ✨ Tóm Tắt Bài Viết Bằng PU AI (2026-10-14)
- [x] `POST /api/posts/:id/summary`: tóm tắt 3–5 ý; lưu `post_summaries` theo hash nội dung ⇒ người sau xem lại không tốn lượt, bài sửa thì tóm tắt lại. Bài ngắn (< 300 ký tự) từ chối; hết lượt 429; AI tắt/lỗi 503.
- [x] Web: nút "✨ Tóm tắt" cạnh "Xem thêm" trên bài dài, khung tóm tắt có skeleton và "Thử lại". Chi tiết: [`core/06` §17](./core/06-messaging-and-ai.md).

### 🤖 `@puai` Trong Bình Luận (2026-10-14)
- [x] Gõ `@puai` trong bình luận ⇒ PU AI trả lời thành bình luận con (`posts/post-ai.service.ts`), ngữ cảnh = bài viết + nhánh bình luận + nguồn liên quan; dùng chung quota/ngày với chat; người hỏi nhận thông báo "đã trả lời bình luận của bạn" và bình luận tự tải lại (socket `comments.changed`). Avatar N7AI cho bình luận của PU AI.
- [x] Tách lõi AI dùng chung `modules/ai/` (`LlmService`, `AiRetrieval`, prompts) cho chat và bài viết. Chi tiết: [`core/06` §16](./core/06-messaging-and-ai.md).

### 🟢 Trạng Thái Hoạt Động (2026-10-14)
- [x] Gateway đếm socket theo user; `PresenceService` (`modules/presence/`) báo `presence.update` khi mở tab đầu / đóng tab cuối (chờ 15s để reload không nháy), lưu `users.last_seen_at` (migration `presence-upgrade.sql`). `GET /api/presence` nạp trạng thái lần đầu.
- [x] Chỉ người **cùng hội thoại** thấy nhau; ẩn khi chặn nhau; cài đặt `privacySettings.showActivityStatus` (mặc định bật, tắt ⇒ cũng không thấy người khác).
- [x] Web: chấm xanh ở avatar DM & danh sách thành viên, tiêu đề "Đang hoạt động" / "Hoạt động 5 phút trước", nhóm "K đang hoạt động".
- [x] Sửa lỗi hộp Cài đặt quyền riêng tư luôn hiện giá trị mặc định và lưu đè cài đặt cũ; `PATCH /api/users/privacy` có kiểm tra Zod; mặc định gom về `resolvePrivacySettings` (`@pu/schemas`).

### 🚫 Chặn Người Dùng (2026-10-14)
- [x] Bảng `user_blocks` (migration `user-blocks-upgrade.sql`), API `GET /api/blocks` · `PUT/DELETE /api/blocks/:userId` (`modules/blocks/`). Chặn ⇒ hủy theo dõi 2 chiều.
- [x] Chính sách 2 chiều dùng chung `blocks.sql.ts` (`blockExistsSql`, `blockStateSql`): ẩn bài ở bảng tin, cộng đồng, tìm kiếm; ẩn bình luận (cả nhánh trả lời); không bình luận/trả lời được bài của nhau; không theo dõi; bỏ khỏi gợi ý theo dõi; không nhận thông báo do người kia gây ra; hồ sơ trả `blockState` và ẩn bài/tài liệu.
- [x] Nhắn tin: không mở DM mới, DM cũ khóa gửi tin cả 2 phía (`ConversationSummary.blockState`), không thêm được vào nhóm (bỏ qua lặng lẽ). Nhóm chat sẵn có vẫn giữ nguyên.
- [x] Web: menu ⋯ "Chặn @user" có xác nhận trên hồ sơ, nút "Bỏ chặn", thông báo thay nội dung hồ sơ, danh sách đã chặn trong Cài đặt quyền riêng tư, thanh "Bạn đã chặn…" thay ô soạn tin. Event `block.changed` làm mới 2 phía ngay.
- [x] Test tích hợp `apps/api/test/blocks.e2e-spec.ts`; sửa jest để chạy được với `@nestjs/bullmq` (ESM).

### ⏳ Skeleton Loading (2026-10-13)
- [x] Primitive `components/ui/skeleton.tsx` (`Skeleton`, `LoadingRegion` hiện sau 150ms, `SkeletonRepeat`), giữ chỗ đúng kích thước thật ⇒ không CLS. Skeleton chỉ cho lần tải đầu; spinner chỉ cho thao tác.
- [x] Khung app (`AppShellSkeleton`) khi đang xác thực phiên, thay spinner toàn màn hình.
- [x] Bảng tin & bài viết: `FeedSkeleton`/`PostListSkeleton` (home, `/c/[slug]` kèm `CommunityHeaderSkeleton`, `/post/[id]`), `CommentListSkeleton` (bình luận), `UserListSkeleton` (gợi ý theo dõi; dùng lại cho thành viên/danh sách follow).
- [x] Tin nhắn: `ConversationListSkeleton` (`/messages`), `MessageThreadSkeleton` (bong bóng xen kẽ hai phía), tiêu đề hội thoại giữ chỗ avatar + tên, `MediaPanelSkeleton` (ảnh/tệp), danh sách thành viên, người thả cảm xúc, bộ chọn người dùng.
- [x] Hồ sơ & thông báo: `ProfileSkeleton` (banner, avatar, tab, bài viết) + tiêu đề trang giữ chỗ, danh sách người theo dõi, `NotificationListSkeleton` (trang `/notifications` và popover).
- [x] Còn lại: `/communities` (`CommunityCardsSkeleton`), `/courses` (`CourseListSkeleton`), `/courses/[code]` (`CourseHeaderSkeleton` + bài, tài liệu/nhóm học `CardListSkeleton`), kết quả `/search`, `/admin`, cài đặt thông báo (`SettingsListSkeleton`). Spinner còn lại chỉ cho thao tác (gửi, lưu, theo dõi, tải thêm) và khung xem PDF.

### 🧪 Kiểm Thử Tích Hợp (Integration Tests)
- [x] Jest + supertest ([`apps/api/test`](../apps/api/test)) chạy trên DB riêng `pu_connector_test` (tự tạo lại + chạy migration): auth (khóa tài khoản, đặt lại mật khẩu), đăng bài & duyệt lời giải, admin, nhắn tin. Chạy: `docker compose up -d && pnpm --filter @pu/api test`.

---

## 2a. Backlog vai trò & quản trị (ghi chú quyết định)

Role trong DB: `student`, `lecturer`, `ta`, `club_lead`, `admin` (prod: 1 admin, ~3 giảng viên, 1 trợ giảng). Hiện role chỉ dùng để giới hạn tạo học phần / sự kiện; người dùng báo cáo bài viết được (`post_reports`) nhưng **chưa có nơi xử lý**.

| Việc | Làm khi | Ghi chú |
|---|---|---|
| ~~Trang admin tối giản~~ · ~~từ khóa tìm không có kết quả~~ | ✅ 2026-10-13 | Xem mục "Quản Trị Tối Giản" ở trên |
| `lecturer` / `ta`: nhãn **"giảng viên xác nhận"** cho lời giải | Khi Kho tài liệu & Hỏi đáp có người dùng | Tăng độ tin cậy câu trả lời |
| `club_lead`: quản lý CLB / sự kiện | Khi làm Domain Clubs/Events | Chưa cần |
| Moderator theo từng cộng đồng (duyệt bài, ẩn bình luận) | Khi có cộng đồng đông | Giảm tải cho admin hệ thống |

## 2. Kế Hoạch Triển Khai Tiếp Theo Theo 14 Domains (Roadmap)

1. **Domain 5: Study / Academic (Nâng Cấp Knowledge Vault & GPA Tool)**: Tra cứu lịch thi, đánh giá môn học & giảng viên, công cụ dự báo điểm GPA tốt nghiệp.
2. **Domain 6: Student Marketplace (`/marketplace`)**: Mua bán giáo trình cũ, đồ dùng ký túc xá/phòng trọ, tìm bạn ở ghép, mục việc làm freelance/gia sư.
3. **Domain 7: Career & Alumni (`/career`)**: Bảng tin thực tập, CV/Portfolio số sinh viên, Mạng lưới Cựu sinh viên (Alumni Mentorship).
4. **Domain 8: Events (`/events`)**: Form đăng ký tham gia sự kiện campus, vé mã QR Check-in.
5. **Domain 9: Clubs & Organizations (`/clubs/[slug]`)**: Hub riêng cho CLB, quản lý thành viên ban/đội, đợt tuyển quân.
6. **Domain 10: Realtime Messaging (phần còn lại)**: chat tự tạo cho cộng đồng. Thiết kế: [`core/06-messaging-and-ai.md`](./core/06-messaging-and-ai.md).
7. **Domain 13: AI Layer (phần còn lại)**: RAG bằng `pgvector` (cần chọn model embedding + trích text PDF) — xem [`core/06-messaging-and-ai.md` §12](./core/06-messaging-and-ai.md).
