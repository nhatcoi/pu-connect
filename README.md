# 🚀 PU Connect — High Performance Social & Document Knowledge Platform

Dự án Monorepo kiến trúc chuẩn công nghiệp (Production-ready) kết hợp **Next.js (Web)**, **NestJS (API)** và sẵn sàng mở rộng **React Native (Mobile)**. 

Toàn bộ hệ thống UI, State Management và Pipeline Render tài liệu kỹ thuật được thiết kế dựa trên tiêu chuẩn kiến trúc hiện đại của **Orca IDE / shadcn / Radix UI**.

---

## 📂 Cấu trúc Monorepo (`Turborepo` + `pnpm`)

```text
pu-connector/
├── apps/
│   ├── web/                     # Frontend Next.js 15+ (App Router, Tailwind v4, shadcn/ui)
│   ├── admin/                   # Admin Console Vite SPA (admin-puc.vnhat.dev, 0 MB RAM)
│   ├── docs/                    # Technical Documentation Vite SPA (docs-puc.vnhat.dev, 0 MB RAM)
│   ├── ai-news/                 # AI News Intelligence Service (ai-news.vnhat.dev)
│   └── api/                     # Backend NestJS 11+ (Modular Architecture, Native PostgreSQL)
│
├── packages/
│   ├── schemas/                 # Shared Zod Schemas & TypeScript Types (DTOs)
│   ├── ui/                      # Shared UI Tokens & Color Theme Constants
│   └── tsconfig/                # Shared TypeScript Configurations
│
├── pnpm-workspace.yaml          # Pnpm workspace definition
├── turbo.json                   # Turborepo task pipeline
└── package.json                 # Monorepo root scripts
```

---

## 🛠️ Thư viện UI & Công nghệ kế thừa từ Orca

| Thành phần | Thư viện / Công nghệ | Vai trò trong hệ thống |
| :--- | :--- | :--- |
| **Core UI Primitives** | `@radix-ui/*`, `shadcn/ui`, `lucide-react` | Accessible, keyboard-navigable UI components |
| **Styling & Theme** | `tailwindcss v4`, `class-variance-authority`, `tailwind-merge` | Utility-first CSS, dark/light theme switching |
| **WYSIWYG Editor** | `@tiptap/react`, `@tiptap/starter-kit`, `@tiptap/markdown` | Trình soạn thảo văn bản phong phú trực quan |
| **Markdown Pipeline** | `react-markdown`, `remark-gfm`, `remark-math`, `rehype-highlight` | Parser văn bản định dạng nhanh, code syntax highlight |
| **Toán học (LaTeX)** | `katex`, `rehype-katex` | Hiển thị công thức toán học inline `$x$` và block `$$x$$` |
| **Sơ đồ (Mermaid)** | `mermaid`, `dompurify` (với Serialized Queue) | Render biểu đồ/sơ đồ động an toàn không bị race-condition |
| **Quản lý State** | `zustand` (Slices pattern) | Global state tối ưu re-render, module hóa từng tính năng |
| **Validation & Types** | `zod` | Xác thực dữ liệu chia sẻ giữa Next.js, React Native và NestJS |
| **Real-time** | `socket.io`, `@nestjs/websockets` | Thông báo, bình luận và cập nhật feed tức thời |

---

## ⚡ Hướng dẫn cài đặt & Khởi chạy

### 1. Cài đặt dependencies (qua pnpm)
```bash
pnpm install
```

### 2. Chạy môi trường phát triển (Dev)
Chạy đồng thời cả **Web Next.js (port 3000)** và **API NestJS (port 4000)** qua Turborepo:
```bash
pnpm dev
```
* **Web Client:** [http://localhost:3000](http://localhost:3000)
* **API Backend:** [http://localhost:4000/api](http://localhost:4000/api)

### 3. Build cho Production
```bash
pnpm build
```

### 4. Khởi chạy môi trường Production cục bộ
Chạy đồng thời cả **Web Next.js (port 3000)** và **API NestJS (port 4000)** ở chế độ Production qua Turborepo:
```bash
pnpm start
```
* **Web Client:** [http://localhost:3000](http://localhost:3000)
* **API Backend:** [http://localhost:4000/api](http://localhost:4000/api)

### 5. Triển khai tự động lên Production VPS (`puc.vnhat.dev`)

Dự án hỗ trợ 2 phương thức deploy linh hoạt:

* **Cách 1: Fast Deploy (Khuyên dùng) — Build trên Mac Mini rồi đẩy lên VPS (~35-45 giây):**
  Tận dụng CPU đa nhân và RAM của máy Mac Mini để biên dịch toàn bộ Web & API trong ~25s, sau đó rsync artifacts sang VPS. VPS 2GB RAM không tốn CPU biên dịch, không bị quá tải.
  ```bash
  pnpm run deploy:mac
  # hoặc: ./deploy-mac-vps.sh
  ```

* **Cách 2: Standard Deploy — Build trực tiếp trên VPS:**
  Đẩy mã nguồn và biên dịch tuần tự trên VPS qua Blue/Green slot với 5GB Swap và 2GB Node Heap.
  ```bash
  pnpm run deploy:vps
  # hoặc: bash scripts/deploy.sh
  ```

* **Production URL:** [https://puc.vnhat.dev](https://puc.vnhat.dev)
* **Admin Console:** [https://admin-puc.vnhat.dev](https://admin-puc.vnhat.dev)
* **Documentation Portal:** [https://docs-puc.vnhat.dev](https://docs-puc.vnhat.dev)
* **REST API:** [https://puc.vnhat.dev/api](https://puc.vnhat.dev/api)
* **GraphQL Endpoint:** [https://puc.vnhat.dev/graphql](https://puc.vnhat.dev/graphql)

### 6. Redis & Web Push
```bash
docker compose up -d postgres redis      # Redis cho hàng đợi BullMQ (chỉ localhost)
npx web-push generate-vapid-keys         # điền VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY vào apps/api/.env
```
Thiếu VAPID ⇒ chỉ có thông báo trong app. Chi tiết: [`docs/core/05`](docs/core/05-notifications-and-realtime.md#7-triển-khai-v2--web-push--bullmq-đang-chạy).

**N7AI** (trợ lý trong `/messages`): gọi API tương thích OpenAI. Điền `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (mặc định `n7ai-fast`) vào `apps/api/.env`; `AI_DAILY_QUOTA` mặc định 30. Gateway dự phòng tùy chọn: `AI_FALLBACK_BASE_URL` / `AI_FALLBACK_API_KEY` / `AI_FALLBACK_MODEL` (gateway chính lỗi ⇒ chuyển sang đó 60s). Thiếu key ⇒ bot trả lời "chưa bật".

**Test tích hợp API** (Jest + supertest, DB riêng `pu_connector_test` được tạo lại mỗi lượt):
```bash
docker compose up -d postgres redis
pnpm --filter @pu/api test
```

### 7. Vận hành: backup & giám sát (VPS)
Cài một lần trên VPS (idempotent): `ssh root@<vps> 'bash /var/www/pu-connector/scripts/ops/setup-ops.sh'`
- **Backup DB** 03:17 hằng ngày (`scripts/ops/backup-db.sh`): `pg_dump` → gzip → mã hóa AES-256 (`BACKUP_PASSPHRASE` trong `.env`, tự sinh) → R2 `backups/db/` (giữ 30 ngày) + `/var/backups/pu-connector` (giữ 7 bản). Bucket R2 là public nên **bắt buộc mã hóa**. **Lưu bản sao `BACKUP_PASSPHRASE` ngoài VPS** — mất khóa = không khôi phục được.
- **Thử khôi phục** (an toàn, vào DB tạm rồi xóa): `bash scripts/ops/restore-db.sh [file | backups/db/<tên>]`. Ghi đè DB thật: thêm `--into-live` (phải gõ tên DB xác nhận).
- **Giám sát** mỗi 5 phút (`scripts/ops/healthcheck.sh`): web 200, API 401, systemd, container, Postgres, đĩa < 85%, RAM, backup < 26 giờ. Chỉ cảnh báo khi trạng thái đổi.
- **Xem dữ liệu cá nhân hóa của 1 user** (chỉ đọc): `pnpm user:insight <username>` (DB stage qua SSH) hoặc thêm `--local`. In hồ sơ, `user_interests`, tín hiệu nguồn, `user_events` gần nhất, câu hỏi N7AI.
- **Cảnh báo Telegram** (tùy chọn): thêm `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` vào `.env` trên VPS (tạo bot qua @BotFather). Không có thì ghi log `/var/log/pu-monitor.log`, `/var/log/pu-backup.log`.

### 7b. Bot (demo / nội dung mồi)
Bot đăng bài sưu tầm theo job và tự trả lời/thả tim bình luận, chạy trong API; điều khiển ở **Admin → Bot** (nhập Excel/JSON → chọn bot → tạo job). `pnpm bot:setup` tạo vài tài khoản bot mẫu. Biến môi trường: `BOT_PASSWORD` (mật khẩu bot), `BOT_INGEST_TOKEN` (tool crawl xin URL ảnh). Chi tiết: [`docs/core/13-admin-console.md`](docs/core/13-admin-console.md#bot-admin--bot).

### 8. Sơ đồ hệ thống
Sơ đồ C4, ERD, sequence, deployment ở [`docs/diagrams/`](docs/diagrams/README.md). Sau mỗi migration, sinh lại ERD từ DB local:
```bash
pnpm docs:erd
```

### 9. Dữ liệu mẫu mạng xã hội (stage / demo)
20 persona (2 admin, 2 giảng viên, 1 trợ giảng, 15 sinh viên với "gu" đăng bài khác nhau) + ~85 bài có ảnh, link, bình luận, cảm xúc, khảo sát, theo dõi. Nguồn: [`apps/api/src/database/seed-social/`](apps/api/src/database/seed-social/).
```bash
pnpm --filter @pu/api seed:social                 # thêm phần còn thiếu (chạy lại không trùng)
pnpm --filter @pu/api seed:social --reset         # xóa bài seed rồi nạp lại (sau khi sửa nội dung)
pnpm --filter @pu/api seed:social --purge-legacy  # xóa 100 tài khoản mẫu cũ (seed-users.sql) + dữ liệu của chúng
```
- Ảnh nằm trên R2 `seed/` (avatars: chân dung tạo bằng AI, không phải người thật; banners/posts: ảnh Picsum/Unsplash). Thêm ảnh mới: `--print-assets` liệt kê id cần có, tải lên bằng `scripts/ops/r2.mjs put`.
- Email persona dùng domain `seed.pu-connector.test` (không gửi được mail thật). Chỉ đăng nhập được khi đặt `SEED_PASSWORD` lúc chạy seed (stage: biến này nằm trong `.env` trên VPS, không commit).

---

## 📱 Hướng dẫn mở rộng Mobile App (React Native) sau này

Khi bạn muốn bổ sung Mobile App:
1. Tạo thư mục `apps/mobile` sử dụng **Expo** hoặc **React Native** (`react-native-reusables` + `NativeWind`).
2. Import trực tiếp `@pu/schemas` để dùng chung 100% Zod validation và TypeScript types.
3. Import `@pu/ui` để đồng bộ toàn bộ bảng màu HSL và design tokens.

---

## 🔐 Xác thực
Email + mật khẩu và Google OAuth (tùy chọn). Biến môi trường `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (xem `.env.example`) và hướng dẫn cấu hình tại [`docs/auth-google.md`](docs/auth-google.md). Connector Google Drive / Calendar / Gmail / Forms / Sheets / Tasks của N7AI gọi MCP server tự host [`workspace-mcp`](https://github.com/taylorwilsdon/google_workspace_mcp) (`127.0.0.1:8765`, service systemd `workspace-mcp`) qua `GOOGLE_WORKSPACE_MCP_URL`; không cần Developer Preview của Google. Cấu hình `CONNECTOR_ENCRYPTION_KEY`, callback `GOOGLE_CONNECTOR_CALLBACK_URL` (mặc định `GOOGLE_CALLBACK_URL`), tùy chọn client riêng `GOOGLE_MCP_CLIENT_ID` / `GOOGLE_MCP_CLIENT_SECRET` (mặc định client đăng nhập), bật Drive / Calendar / Gmail / Forms / Sheets / Tasks API trong Google Cloud. Model/gateway `AI_MODEL` phải hỗ trợ Chat Completions tool calling. Chi tiết: [`docs/core/14-google-mcp-connectors.md`](docs/core/14-google-mcp-connectors.md). Tìm kiếm web cho N7AI: `TAVILY_API_KEY` (tùy chọn). Tìm kiếm bài báo khoa học toàn cầu (Semantic Scholar & arXiv): `SEMANTIC_SCHOLAR_API_KEY` (tùy chọn; tự động dự phòng sang arXiv khi không có key hoặc rate-limit). Kiểm tra mã: `pnpm lint` (ESLint flat config ở `apps/web`, `apps/api`). Tài khoản seed local dùng mật khẩu `password123`.

### PU Connect — dữ liệu tài khoản trường

Connector dùng extension tại [PKA](https://pka.vnhat.dev/extension) và MCP trên service PKA. `PKA_CONNECTOR_URL` mặc định `https://pka.vnhat.dev`; không đưa cookie trường vào PUC. Xem [thiết kế kết nối](docs/core/20-pu-connector-mcp.md).
