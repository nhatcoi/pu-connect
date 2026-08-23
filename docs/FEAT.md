# PU Connector — Danh Mục Tính Năng & Lộ Trình Phát Triển

Tài liệu theo dõi trạng thái các tính năng đã hoàn thành và kế hoạch phát triển (Backlog & Roadmap) của hệ thống PU Connector.

---

## 1. Tính Năng Đã Hoàn Thành (Completed Features)

### 🏗️ Kiến Trúc & Nền Tảng (Core & Infrastructure)
- [x] 📦 **Monorepo Turborepo + pnpm (`apps/web`, `apps/api`, `packages/schemas`, `packages/ui`)**: Tách biệt rõ ràng giữa Client, Server và Shared Library.
- [x] ⚡ **Quản lý tiến trình tập trung (`procman.yaml`)**: Chạy toàn bộ hệ thống (`db`, `api`, `web`) chỉ với 1 lệnh `procman up`.
- [x] 🗄️ **Cơ sở dữ liệu chuẩn hóa (`PostgreSQL 16 + pgvector`)**: Thiết kế DDL 11 bảng phân hệ học thuật, môn học, tài liệu, nhóm đồ án, sự kiện và tương tác.
- [x] 🔐 **Xác thực phiên làm việc an toàn (`Session-based Auth & Passport.js`)**: Đăng ký, đăng nhập với cookie HttpOnly (`pu_session`), mã hóa bcrypt và phân quyền theo vai trò (`student`, `lecturer`, `ta`, `admin`).
- [x] 🚪 **Đăng xuất an toàn toàn diện (`Logout Flow & Session Invalidation`)**: Endpoint `POST /api/auth/logout` xóa cookie `pu_session`, hủy session trên server, reset sạch Client State Zustand và điều hướng tức thời về Landing Page (`/`).
- [x] 👥 **Dữ liệu giả lập thực tế (`Database Seeder - 100 Phenikaa Users`)**: Khởi tạo 100 tài khoản sinh viên và giảng viên phân bổ đủ 8 Khoa/Viện đào tạo.
- [x] 🚀 **Kiến Trúc Hybrid (GraphQL + REST API)**: Tích hợp Apollo Server `/graphql` cho dữ liệu quan hệ lồng nhau (Feed, Profile, Documents, PBL Groups) và giữ REST API cho Session Auth & Upload File lớn.

### 🌐 Định Tuyến & Giao Diện Chuẩn X (Routing & Social UI)
- [x] 🌟 **Landing Page phong cách X (`/` - Happening now)**: Giao diện chào đón khi chưa đăng nhập, tự động chuyển tiếp sang `/home` nếu đã có session, tích hợp hộp đăng nhập nhanh với 100 tài khoản mẫu seed.
- [x] 🛡️ **Client Route Guard (`AuthGuard`)**: Bảo vệ toàn bộ các route nội bộ (`/home`, `/courses`...), tự động chuyển hướng khách chưa đăng nhập về trang chủ, tự động khóa `/home` và chuyển hướng sang `/get-started` nếu tài khoản chưa hoàn tất khởi tạo hồ sơ.
- [x] 🚀 **Trang Khởi Tạo Hồ Sơ Tân Sinh Viên Chuyên Biệt (`/get-started` - Standalone No Background)**: Trang toàn màn hình độc lập 100% (không lộ background `/home`), thiết kế giao diện Lucide SVG chuyên nghiệp, 4 bước (Mã SV, Khoa/Viện, Môn học, Kỹ năng, Follows), hiệu ứng Transition nạp bảng tin và thưởng ngay **+100 Điểm danh vọng**.
- [x] 🏛️ **Bảng tin 3 cột chuẩn X (`/home`)**: Sidebar điều hướng $\rightarrow$ Feed học thuật với Tab dính (*Dành cho bạn / Môn học / Kho tài liệu*) $\rightarrow$ Xu hướng & Gợi ý kết nối.
- [x] 👤 **Trang cá nhân sinh viên / giảng viên (`/[username]`)**: Banner ảnh bìa, Avatar, Khoa/Viện, Mã SV, Niên khóa, 4 Tabs chuyển đổi (Bài viết, Tài liệu, Nhóm PBL, Huy hiệu thành tích) truy vấn 100% qua GraphQL `userProfile`.
- [x] 🧠 **Thuật Toán Đề Xuất Bài Viết Cá Nhân Hóa (Hybrid Recommendation Engine)**: Chấm điểm bài viết trên Tab *"Dành cho bạn"* kết hợp Môn học ($+40$), Cùng Khoa ($+20$), Người đang Follow ($+30$), Độ tương tác ($2\times L + 5\times C$) và Hệ số suy giảm thời gian (Time Decay).
- [x] 🤝 **Hệ thống theo dõi & Kết nối bạn bè (`user_follows`)**: Bảng quan hệ theo dõi sinh viên/giảng viên, tự động ưu tiên phân phối bài viết trên Bảng tin.

### 📝 Bảng Tin Học Thuật & Soạn Thảo (Academic Feed & Q&A)
- [x] ✍️ **Trình soạn thảo WYSIWYG (`Tiptap 3 / ProseMirror`)**: Hỗ trợ đầy đủ định dạng văn bản, tiêu đề, danh sách, trích dẫn, code block và bảng biểu.
- [x] 🧮 **Render công thức toán học (`KaTeX`)**: Hiển thị công thức toán ($x$, $\frac{a}{b}$) trực quan và sắc nét.
- [x] 📊 **Render biểu đồ & sơ đồ (`Mermaid.js`)**: Tự động chuyển đổi mã nguồn mermaid thành sơ đồ tuần tự và lưu đồ thuật toán.
- [x] 💬 **Tương tác thời gian thực (`Like / Comment / Tag`)**: Đăng bài trực tiếp vào Database, thả tim, đính kèm tài liệu học phần.

### 📚 Kho Tài Liệu & Đề Thi Học Phần (Knowledge Vault)
- [x] 📑 **Phân loại tài liệu đa định dạng (`PDF`, `Code`, `Sheet`, `Markdown`)**: Tra cứu theo mã học phần và thẻ tag.
- [x] 👁️ **Trình xem trước In-App (`PdfViewer` & `DocumentPreviewModal`)**: Xem trực tiếp file PDF với thanh công cụ phóng to/thu nhỏ, mở tab mới và tải về.
- [x] 📤 **Thêm & chia sẻ tài liệu**: Form tạo tài liệu lưu trữ động trực tiếp vào cơ sở dữ liệu PostgreSQL.

### 🎓 Học Phần & Ghép Nhóm Đồ Án (Courses & PBL Matchmaking)
- [x] 🏛️ **Danh mục học phần theo Khoa/Viện (`FIT`, `FEE`, `FBA`, `FAE`...)**: Đánh giá môn học, số tín chỉ, tài liệu và bài thảo luận liên quan.
- [x] 👥 **Ghép nhóm đồ án PBL (`Study Groups`)**: Đăng tin tuyển thành viên theo đề tài, kỹ năng công nghệ (React Native, NestJS, AI...), quản lý số lượng thành viên.

### 🎨 Trải Nghiệm Giao Diện & Tiện Ích (Modern UI/UX)
- [x] 🔤 **Font chữ Inter Việt Hóa 100% + JetBrains Mono**: Tích hợp từ Google Fonts với `subsets: ['vietnamese', 'latin']`, không lỗi dấu câu.
- [x] 🔍 **Command Palette (`cmdk` / Phím tắt `Ctrl+K` & `⌘K`)**: Tìm kiếm nhanh môn học, đề thi và điều hướng tức thời toàn hệ thống.
- [x] 🎭 **Hiệu ứng Micro-animations (`tw-animate-css`)**: Chuyển động mượt mà khi mở dialog, modal, hover thẻ card và thả tim.
- [x] 🗃️ **Quản lý State hiện đại (`Zustand v5 Slice Pattern`)**: Tối ưu re-render thông qua các slice độc lập (`feed`, `document`, `course`, `study-group`, `campus`, `auth`).

---

## 2. Tính Năng Dự Định Làm (Planned Features / Backlog)

### 👤 Hồ Sơ Cá Nhân & Tương Tác (Profile & Social Graph)
- [x] 👤 **Trang cá nhân sinh viên / giảng viên (`/[username]`)**: Ảnh bìa, Avatar, Khoa/Viện, Niên khóa, Tabs xem bài viết đã đăng, tài liệu đã chia sẻ, nhóm đồ án đã tham gia.
- [x] 🤝 **Hệ thống theo dõi & Kết nối bạn bè (`Follow / Following`)**: Theo dõi bạn học cùng lớp, nhận thông báo khi giảng viên đăng bài mới (Mutation `toggleFollow`, GraphQL social graph, `FollowButton` với Optimistic UI, `UserListDialog` xem danh sách Followers/Following).

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

### ☁️ Lưu Trữ File Lớn & Hạ Tầng (Storage & Direct Upload)
- [ ] ☁️ **Tải file trực tiếp lên Cloud (`S3 / Cloudflare R2 Direct Upload`)**: Tạo Presigned URL để client upload trực tiếp file đề thi dung lượng lớn mà không nghẽn server.
- [ ] 🛡️ **Quét virus & kiểm duyệt tệp tin (`File Quarantine & Antivirus`)**: Tự động kiểm tra an toàn trước khi công khai tài liệu lên kho chung.

### 🏷️ Phân Loại Học Thuật & Trực Quan Hóa Chia Sẻ (Academic Sharing & Visual Taxonomy)
- [ ] 🎯 **Mô hình phân loại 3 tầng (`Layered Taxonomy`)**: Tầng 1 (Khoa / Mã học phần) $\rightarrow$ Tầng 2 (Mục đích bài viết: Q&A, Đề thi, Tuyển PBL, Review) $\rightarrow$ Tầng 3 (Custom Tags linh hoạt). *(Xem chi tiết tại [`docs/academic-sharing-and-taxonomy-spec.md`](file:///Volumes/NVME_NHAT/Documents/Dev/Projects/PROJECT/pu-connector/docs/academic-sharing-and-taxonomy-spec.md))*.
- [ ] 🎨 **Bộ nhận diện trực quan trên Feed (`Visual Intent Badges`)**: Phù hiệu màu sắc đặc trưng (Vàng: Hỏi đáp, Xanh lục: Đề thi, Tím: Ghép nhóm PBL, Xanh dương: Review), thẻ trạng thái `[Chưa giải quyết]` / `[✅ Đã giải quyết]`.
- [ ] ✍️ **Trình tạo bài viết thông minh (`Smart Composer`)**: Chọn nhanh loại bài viết, tự động gợi ý tag môn học theo ngữ cảnh tiêu đề.
- [ ] 🔍 **Thanh lọc nhanh đa chiều (`Smart Filter Bar`)**: Lọc 1-click trên đầu feed (*Môn tôi đang học*, *Câu hỏi chưa có lời giải*, *Chỉ tài liệu & đề thi*, *Tuyển nhóm còn slot*).
- [ ] ✅ **Cơ chế duyệt câu trả lời đúng (`Accepted Answer`)**: Tác giả bài viết Q&A có quyền chọn câu trả lời chính xác để ghim lên đầu và cộng điểm danh vọng cho người giải đáp.

### 🏆 Danh Vọng & Động Lực Học Tập (Gamification & Reputation)
- [ ] 🏅 **Hệ thống điểm danh vọng & Huy hiệu (`Reputation Points & Badges`)**: Tích điểm khi chia sẻ đề thi hay, đạt huy hiệu Top Contributor.
- [ ] 🥇 **Bảng xếp hạng sinh viên đóng góp (`Top Contributors Leaderboard`)**: Vinh danh các sinh viên tích cực theo từng Khoa/Viện.

