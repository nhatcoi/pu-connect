# 🚀 Hướng Dẫn Bắt Đầu & Bản Đồ Nghiệp Vụ — PU Connector Get Started

Tài liệu này cung cấp hướng dẫn từng bước để cài đặt, khởi chạy, phát triển dự án **PU Connector** cùng với bản đồ tóm lược **Logic nghiệp vụ cốt lõi** của toàn bộ hệ thống.

---

## 📑 Mục Lục
1. [Yêu cầu Môi trường](#1-yêu-cầu-môi-trường-prerequisites)
2. [Khởi Động Nhanh Trong 3 Bước](#2-khởi-động-nhanh-trong-3-bước-quick-start)
3. [Kiến Trúc Đa Giao Thức (Hybrid Protocols)](#3-kiến-trúc-đa-giao-thức-hybrid-protocols)
4. [Bản Đồ Logic Nghiệp Vụ Cốt Lõi](#4-bản-đồ-logic-nghiệp-vụ-cốt-lõi-core-business-logic)
   * [4.1. Xác thực Phiên & Phân Quyền (Session-based Auth)](#41-xác-thực-phiên--phân-quyền-session-based-auth)
   * [4.2. Khởi Tạo Hồ Sơ Tân Sinh Viên (Onboarding Wizard)](#42-khởi-tạo-hồ-sơ-tân-sinh-viên-onboarding-wizard)
   * [4.3. Thuật Toán Đề Xuất Bài Viết (Hybrid Recommendation Engine)](#43-thuật-toán-đề-xuất-bài-viết-hybrid-recommendation-engine)
   * [4.4. Trang Cá Nhân Học Thuật `/[username]` (Profile Page)](#44-trang-cá-nhân-học-thuật-username-profile-page)
   * [4.5. Kho Tài Liệu & Trình Xem In-App (Knowledge Vault)](#45-kho-tài-liệu--trình-xem-in-app-knowledge-vault)
5. [Danh Sách Tài Khoản Mẫu Thử Nghiệm](#5-danh-sách-tài-khoản-mẫu-thử-nghiệm-test-accounts)
6. [Các Lệnh Phát Triển Thường Dùng (CLI Commands)](#6-các-lệnh-phát-triển-thường-dùng-cli-commands)

---

## 1. Yêu Cầu Môi Trường (Prerequisites)

* **Node.js:** `>= 20.0.0` (Khuyến nghị Node.js v22 hoặc v24)
* **Package Manager:** `pnpm >= 9.0.0`
* **Docker & Docker Compose:** Để chạy PostgreSQL 16 tích hợp extension `pgvector`
* **Procman:** Quản lý tiến trình tập trung (đã cấu hình sẵn file `procman.yaml`)

---

## 2. Khởi Động Nhanh Trong 3 Bước (Quick Start)

### Bước 1: Cài đặt dependencies
```bash
pnpm install
```

### Bước 2: Khởi động Cơ sở dữ liệu PostgreSQL
```bash
docker compose up -d
```
*(Nếu là lần đầu chạy, database sẽ tự động nạp DDL từ `apps/api/src/database/schema.sql` và seed dữ liệu 100 tài khoản mẫu)*.

### Bước 3: Khởi chạy toàn bộ hệ thống với Procman
```bash
procman up
```
Hoặc khởi chạy thông qua lệnh pnpm:
```bash
pnpm dev
```

### 🌐 Địa chỉ các cổng dịch vụ:
* **Web Client (Next.js 15):** [http://localhost:3000](http://localhost:3000)
* **API Backend (NestJS 11):** [http://localhost:4000/api](http://localhost:4000/api)
* **GraphQL Playground & Schema:** [http://localhost:4000/graphql](http://localhost:4000/graphql)

---

## 3. Kiến Trúc Đa Giao Thức (Hybrid Protocols)

PU Connector sử dụng kết hợp thông minh 3 giao thức theo đúng bản chất của từng loại nghiệp vụ:

```
                      ┌─────────────────────────────────────────┐
                      │           PU CONNECTOR CLIENT           │
                      └────┬────────────────┬──────────────┬────┘
                           │                │              │
                     HTTP / REST        GraphQL        WebSocket
                           │                │              │
                           ▼                ▼              ▼
                     ┌───────────┐    ┌───────────┐  ┌───────────┐
                     │ Auth, Me, │    │ Feed,     │  │ Realtime  │
                     │ File Presign   │ Profile,  │  │ Chat PBL, │
                     │ & Upload  │    │ Relations │  │ Live Notif│
                     └───────────┘    └───────────┘  └───────────┘
```

1. **REST API (`/api/...`):**
   * Quản lý phiên đăng nhập/đăng xuất an toàn bằng cookie HttpOnly `pu_session`.
   * Luồng khởi tạo hồ sơ tân sinh viên (`POST /api/auth/onboarding`).
   * Upload tài liệu dung lượng lớn (Multipart / S3 Presigned URL).
2. **GraphQL (`/graphql`):**
   * Truy vấn dữ liệu mạng xã hội lồng ghép phức tạp chỉ trong **1 round-trip duy nhất**:
     * `feed`: Lấy bài viết kèm thông tin tác giả, trạng thái like, tags.
     * `userProfile`: Lấy toàn bộ bài viết, tài liệu chia sẻ, nhóm đồ án và huy hiệu.
3. **WebSocket (`ws://...`):**
   * Phòng chat thời gian thực trong nhóm đồ án PBL (`apps/api/src/modules/realtime`).
   * Bắn thông báo đẩy tức thời khi có tương tác mới.

---

## 4. Bản Đồ Logic Nghiệp Vụ Cốt Lõi (Core Business Logic)

### 4.1. Xác thực Phiên & Phân Quyền (Session-based Auth)
* **Cơ chế:** Sử dụng Passport.js Session kết hợp mã hóa bcrypt (`apps/api/src/modules/auth`).
* **Bảo mật:** Cookie `pu_session` với cờ `HttpOnly`, `SameSite=Lax`, ngăn chặn triệt để tấn công XSS đánh cắp token.
* **Phân quyền vai trò (`Role`):**
  * `student`: Sinh viên các khoa (đăng bài, hỏi đáp, tải tài liệu, ghép nhóm đồ án).
  * `lecturer`: Giảng viên các bộ môn (được gắn badge xác thực tím, ghim bài viết môn học).
  * `ta`: Trợ giảng bộ môn (hỗ trợ giải đáp thắc mắc bài tập lớn).
  * `admin`: Quản trị viên diễn đàn trường Phenikaa.

---

### 4.2. Trang Khởi Tạo Hồ Sơ Tân Sinh Viên (`/get-started` - Standalone No Background)
Khi sinh viên đăng ký mới hoặc đăng nhập lần đầu (`user.isOnboarded === false`), hệ thống tự động nhận diện và **chuyển hướng trực tiếp sang trang toàn màn hình riêng biệt `/get-started`** (hoàn toàn không tải trước hay để lộ background `/home` phía sau):

* **Bước 1: Danh tính học thuật (Bắt buộc):** Nhập Mã SV/Cán bộ, chọn Khoa/Viện (`FIT`, `FEE`, `FCS`, `FBA`...), Niên khóa (`K15`, `K16`, `K17`, `K18`...).
* **Bước 2: Môn học kỳ này (Khuyến khích - Có thể Skip):** Chọn các môn học đang học (`IT101`, `MATH201`, `AI302`...) $\rightarrow$ *Giải quyết bài toán Bảng tin bị rỗng (Cold-Start)*.
* **Bước 3: Kỹ năng & Đồ án PBL (Tùy chọn - Có thể Skip):** Chọn các tags công nghệ sở trường (`React Native`, `Next.js`, `Python AI`, `Matlab`...) $\rightarrow$ *Phục vụ thuật toán AI Ghép nhóm đồ án*.
* **Bước 4: Kích hoạt mạng xã hội & Nhận thưởng:** Gợi ý theo dõi Giảng viên và bạn học cùng khoa, tặng ngay **+100 Điểm danh vọng** và mở khóa huy hiệu *Tân Binh Phenikaa*.
* **Chuyển tiếp `/home`:** Chỉ khi người dùng hoàn tất Bước 4, hệ thống mới lưu thông tin vào Database, cập nhật `is_onboarded = true` và chuyển tiếp sang `/home` để hiển thị Bảng tin đã được cá nhân hóa 100%.

---

### 4.3. Thuật Toán Đề Xuất Bài Viết (Hybrid Recommendation Engine)
Được triển khai trực tiếp bên trong [`FeedResolver`](file:///home/nhatcoi/Documents/personal/pu-connector/apps/api/src/modules/graphql/resolvers/feed.resolver.ts):

* **Công thức chấm điểm xếp hạng (Ranking Score $S(u, p)$):**
  $$S(u, p) = \text{Pinned}(1000) + \text{CourseMatch}(+40) + \text{FacultyMatch}(+20) + \text{FollowMatch}(+30) + (2\times \text{Likes} + 5\times \text{Comments}) - (\text{TimeDecay} \times 1.5)$$
* **Ưu điểm:**
  * Sinh viên luôn thấy bài tập, đề thi và câu hỏi của đúng môn học mình quan tâm ở đầu bảng tin.
  * Tối ưu truy vấn SQL với toán tử mảng PostgreSQL (`&&`), phản hồi cực nhanh dưới 50ms.

---

### 4.4. Trang Cá Nhân Học Thuật `/[username]` (Profile Page)
* **Giao diện chuẩn X:** Cover banner Phenikaa Campus, Avatar nổi bật, Mã SV, Khoa/Viện, Niên khóa, Huy hiệu Điểm danh vọng, Nút Theo dõi/Chỉnh sửa.
* **4 Tabs nội dung:**
  1. 📝 **Bài viết:** Toàn bộ câu hỏi, bài chia sẻ của user.
  2. 📑 **Tài liệu:** Kho đề thi, slide bài giảng đã đóng góp (kèm kích thước, lượt xem, nút xem trước PDF).
  3. 👥 **Nhóm PBL:** Các đề tài đồ án sinh viên đang tham gia.
  4. 🏅 **Huy hiệu:** Bảng vinh danh huy hiệu thành tích học thuật.

---

### 4.5. Kho Tài Liệu & Trình Xem In-App (Knowledge Vault)
* Hỗ trợ lưu trữ đa định dạng: `PDF`, `Code`, `Sheet`, `Markdown`.
* **In-App PDF Viewer:** Tích hợp trình xem trước PDF trực tiếp trong modal với thanh công cụ phóng to/thu nhỏ, mở tab mới và tải về máy.

---

## 5. Danh Sách Tài Khoản Mẫu Thử Nghiệm (Test Accounts)

> 🔑 **Mật khẩu mặc định cho toàn bộ 100 tài khoản mẫu:** `password123`

| Username | Họ và Tên | Vai Trò & Khoa | Email Đăng Nhập |
|---|---|---|---|
| `pu_admin_lead` | Ban Quản Trị PU Connector | **Admin** (Quản trị viên) | `mod.phenikaa@phenikaa-uni.edu.vn` |
| `gv_nguyenvanha` | TS. Nguyễn Văn Hà | **Giảng viên** Khoa CNTT (FIT) | `gv.nguyenvanha@phenikaa-uni.edu.vn` |
| `gv_tranthithu` | PGS.TS Trần Thị Thu | **Giảng viên** Khoa học Máy tính (FCS) | `gv.tranthithu@phenikaa-uni.edu.vn` |
| `gv_lequangthang` | TS. Lê Quang Thắng | **Giảng viên** Điện tử & Robot (FEE) | `gv.lequangthang@phenikaa-uni.edu.vn` |
| `nguyenvanan` | Nguyễn Văn An | **Sinh viên** K16 CNTT (AI & Deep Learning) | `22010001@phenikaa-uni.edu.vn` |
| `tranminhduc` | Trần Minh Đức | **Sinh viên** K16 CNTT (Fullstack Dev) | `22010002@phenikaa-uni.edu.vn` |
| `lethimai` | Lê Thị Mai | **Sinh viên** K16 CNTT (CLB Tin học) | `22010003@phenikaa-uni.edu.vn` |
| `hoangthuytrang` | Hoàng Thùy Trang | **Sinh viên** K16 CNTT (Data Science) | `22010005@phenikaa-uni.edu.vn` |

*(Xem danh sách đầy đủ 100 tài khoản tại [`docs/seed.md`](./seed.md))*.

---

## 6. Các Lệnh Phát Triển Thường Dùng (CLI Commands)

```bash
# Xem trạng thái các tiến trình đang chạy (API, Web, DB)
procman status

# Khởi động lại một tiến trình cụ thể khi sửa code backend/frontend
procman restart api
procman restart web

# Kiểm tra kiểu dữ liệu và build toàn bộ Monorepo
pnpm build

# Kiểm tra format và linting
pnpm lint
```
