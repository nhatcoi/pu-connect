# 📚 PU Connector — Tài liệu Kỹ thuật (Technical Documentation)

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật của dự án **PU Connector** — Nền tảng Mạng xã hội & Kho chia sẻ tài liệu kỹ thuật thế hệ mới.

---

## 📑 Mục lục tài liệu

| Tài liệu | Nội dung chính |
| :--- | :--- |
| [**1. Tổng quan Kiến trúc (Architecture)**](./architecture.md) | Cấu trúc Monorepo, luồng dữ liệu, Pipeline render Markdown/LaTeX/Mermaid, thiết kế hệ thống. |
| [**2. Đặc tả API (API Specification)**](./api-specification.md) | Danh sách REST endpoints, tham số Request/Response DTOs, WebSocket Events Gateway. |
| [**3. Thiết kế Cơ sở dữ liệu (Database Schema)**](./database-schema.md) | Sơ đồ ERD, thiết kế bảng PostgreSQL, quan hệ thực thể, chiến lược index và Vector Search. |
| [**4. Hướng dẫn Frontend & UI (Frontend Guide)**](./frontend-guide.md) | Quy chuẩn shadcn/ui, Tailwind v4 tokens, tích hợp bộ soạn thảo Tiptap và Zustand slices. |
| [**5. Hướng dẫn Mở rộng Mobile App (Mobile Expansion)**](./mobile-expansion.md) | Hướng dẫn tích hợp React Native (Expo) + `react-native-reusables`, chia sẻ schemas và tokens. |
| [**6. Triển khai & DevOps (Deployment & DevOps)**](./deployment-and-devops.md) | Hướng dẫn Docker, cấu hình biến môi trường, Cloudflare R2 Presigned URL, Nginx, CI/CD. |

---

## ⚡ Bắt đầu nhanh (Quick Start)

```bash
# 1. Clone repository & cài đặt dependencies
pnpm install

# 2. Khởi động toàn bộ dịch vụ (Web + API)
pnpm dev

# 3. Build kiểm thử Production
pnpm build
```

* **Web UI (Next.js):** [http://localhost:3000](http://localhost:3000) (hoặc `http://0.0.0.0:3000`)
* **API Backend (NestJS):** [http://localhost:4000/api](http://localhost:4000/api)
