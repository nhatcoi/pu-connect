# 📚 PU Connector — Tài liệu Kỹ thuật (Technical Documentation)

Chào mừng bạn đến với trung tâm tài liệu kỹ thuật của dự án **PU Connector** — Nền tảng Mạng xã hội & Kho chia sẻ tài liệu kỹ thuật thế hệ mới.

---

## 📑 Mục lục tài liệu

| Tài liệu | Nội dung chính |
| :--- | :--- |
| [**🗺️ Sơ Đồ Hệ Thống (Diagrams — đúng theo code đang chạy)**](./diagrams/README.md) | C4 Context/Container/Component, ERD tự sinh (`pnpm docs:erd`), sequence các luồng chính, deployment, route map web. |
| [**🎓 0. Kế Hoạch 14 Domains Mạng Xã Hội Sinh Viên (Master Plan)**](./STUDENT_SOCIAL_NETWORK_MASTER_PLAN.md) | Đặc tả 14 phân hệ nghiệp vụ, 8 miền kiến trúc, lộ trình 4 giai đoạn và Product Moat. |
| [**🚀 1. Hướng Dẫn Bắt Đầu & Bản Đồ Nghiệp Vụ (Get Started)**](./get-started.md) | Cài đặt 3 bước, sơ đồ đa giao thức, phân tích logic nghiệp vụ cốt lõi, danh sách tài khoản mẫu. |
| [**🎯 2. Danh Mục Tính Năng & Lộ Trình (Features & Roadmap)**](./FEAT.md) | Theo dõi trạng thái các tính năng đã hoàn thành và kế hoạch phát triển (Backlog). |
| [**🏗️ 3. Tổng quan Kiến trúc (Architecture)**](./architecture.md) | Cấu trúc Monorepo, 5 tầng kỹ thuật, 7 phân hệ nghiệp vụ, Hybrid GraphQL + REST. |
| [**📡 4. Đặc tả API (API Specification)**](./api-specification.md) | Danh sách REST endpoints, tham số Request/Response DTOs, WebSocket Events Gateway. |
| [**🗄️ 5. Thiết kế Cơ sở dữ liệu (Database Schema)**](./database-schema.md) | Sơ đồ ERD, thiết kế bảng PostgreSQL 16, quan hệ thực thể, pgvector Search. |
| [**🎨 6. Hướng dẫn Frontend & UI (Frontend Guide)**](./frontend-guide.md) | Quy chuẩn shadcn/ui, Tailwind CSS tokens, tích hợp bộ soạn thảo Tiptap và Zustand slices. |
| [**📱 7. Hướng dẫn Mở rộng Mobile App (Mobile Expansion)**](./mobile-expansion.md) | Hướng dẫn tích hợp React Native (Expo) + `react-native-reusables`, chia sẻ schemas. |
| [**🚢 8. Triển khai & DevOps (Deployment & DevOps)**](./deployment-and-devops.md) | Hướng dẫn Docker, cấu hình biến môi trường, Cloudflare R2 Presigned URL, Nginx, CI/CD. |

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
