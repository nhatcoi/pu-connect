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

---

## 📱 Hướng dẫn mở rộng Mobile App (React Native) sau này

Khi bạn muốn bổ sung Mobile App:
1. Tạo thư mục `apps/mobile` sử dụng **Expo** hoặc **React Native** (`react-native-reusables` + `NativeWind`).
2. Import trực tiếp `@pu/schemas` để dùng chung 100% Zod validation và TypeScript types.
3. Import `@pu/ui` để đồng bộ toàn bộ bảng màu HSL và design tokens.

---

## 🔐 Xác thực
Email + mật khẩu và Google OAuth (tùy chọn). Biến môi trường `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (xem `.env.example`) và hướng dẫn cấu hình tại [`docs/auth-google.md`](docs/auth-google.md). Tài khoản seed local dùng mật khẩu `password123`.
