# 🚀 PU Connector — High Performance Social & Document Knowledge Platform

Dự án Monorepo kiến trúc chuẩn công nghiệp (Production-ready) kết hợp **Next.js (Web)**, **NestJS (API)** và sẵn sàng mở rộng **React Native (Mobile)**. 

Toàn bộ hệ thống UI, State Management và Pipeline Render tài liệu kỹ thuật được thiết kế dựa trên tiêu chuẩn kiến trúc hiện đại của **Orca IDE / shadcn / Radix UI**.

---

## 📂 Cấu trúc Monorepo (`Turborepo` + `pnpm`)

```text
pu-connector/
├── apps/
│   ├── web/                     # Frontend Next.js 15+ (App Router, Tailwind v4, shadcn/ui)
│   │   ├── src/
│   │   │   ├── app/             # Next.js App Router (Layout, Providers, Pages)
│   │   │   ├── components/
│   │   │   │   ├── ui/          # Radix UI + CVA + Tailwind components (Button, Dialog, etc.)
│   │   │   │   ├── renderer/    # Document Renderer (Markdown, LaTeX KaTeX, Mermaid Diagrams, Code)
│   │   │   │   ├── editor/      # Tiptap WYSIWYG & Markdown Editor
│   │   │   │   └── social/      # PostCard, DocumentCard, Composer, Header, Sidebar
│   │   │   ├── lib/             # Utilities (cn), Serialized Mermaid Queue, API Client
│   │   │   ├── store/           # Zustand Store (Slice-based pattern)
│   │   │   └── styles/          # Global styles & Markdown typography theme
│   │   └── package.json
│   │
│   └── api/                     # Backend NestJS 11+ (Modular Architecture)
│       ├── src/
│       │   ├── common/          # Global Exception Filters & Transform Interceptors
│       │   ├── modules/
│       │   │   ├── auth/        # JWT Auth, Passport Strategy, User Service
│       │   │   ├── posts/       # Social Feed API, Likes & Comments
│       │   │   ├── documents/   # Document Sharing, Download Tracker, Search
│       │   │   └── realtime/    # WebSocket Gateway (Socket.io)
│       │   ├── app.module.ts
│       │   └── main.ts
│       └── package.json
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
Triển khai toàn bộ hệ thống (Web, API, Docker PostgreSQL `pgvector`, Nginx Reverse Proxy và SSL Let's Encrypt) lên VPS chỉ với 1 lệnh:
```bash
pnpm run deploy:vps
```
* **Production URL:** [https://puc.vnhat.dev](https://puc.vnhat.dev)
* **REST API:** [https://puc.vnhat.dev/api](https://puc.vnhat.dev/api)
* **GraphQL Endpoint:** [https://puc.vnhat.dev/graphql](https://puc.vnhat.dev/graphql)

### 6. Redis & Web Push
```bash
docker compose up -d postgres redis      # Redis cho hàng đợi BullMQ (chỉ localhost)
npx web-push generate-vapid-keys         # điền VAPID_PUBLIC_KEY / VAPID_PRIVATE_KEY vào apps/api/.env
```
Thiếu VAPID ⇒ chỉ có thông báo trong app. Chi tiết: [`docs/core/05`](docs/core/05-notifications-and-realtime.md#7-triển-khai-v2--web-push--bullmq-đang-chạy).

**PU AI** (trợ lý trong `/messages`): gọi API tương thích OpenAI. Điền `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` (mặc định `v9`) vào `apps/api/.env`; `AI_DAILY_QUOTA` mặc định 30. Thiếu key ⇒ bot trả lời "chưa bật".

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
- **Xem dữ liệu cá nhân hóa của 1 user** (chỉ đọc): `pnpm user:insight <username>` (DB stage qua SSH) hoặc thêm `--local`. In hồ sơ, `user_interests`, tín hiệu nguồn, `user_events` gần nhất, câu hỏi PU AI.
- **Cảnh báo Telegram** (tùy chọn): thêm `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` vào `.env` trên VPS (tạo bot qua @BotFather). Không có thì ghi log `/var/log/pu-monitor.log`, `/var/log/pu-backup.log`.

### 8. Sơ đồ hệ thống
Sơ đồ C4, ERD, sequence, deployment ở [`docs/diagrams/`](docs/diagrams/README.md). Sau mỗi migration, sinh lại ERD từ DB local:
```bash
pnpm docs:erd
```

---

## 📱 Hướng dẫn mở rộng Mobile App (React Native) sau này

Khi bạn muốn bổ sung Mobile App:
1. Tạo thư mục `apps/mobile` sử dụng **Expo** hoặc **React Native** (`react-native-reusables` + `NativeWind`).
2. Import trực tiếp `@pu/schemas` để dùng chung 100% Zod validation và TypeScript types.
3. Import `@pu/ui` để đồng bộ toàn bộ bảng màu HSL và design tokens.

---

## 🔐 Xác thực
Email + mật khẩu và Google OAuth (tùy chọn). Biến môi trường `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (xem `.env.example`) và hướng dẫn cấu hình tại [`docs/auth-google.md`](docs/auth-google.md). Tài khoản seed local dùng mật khẩu `password123`.
