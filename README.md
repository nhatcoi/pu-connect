# PU Connect

Mạng xã hội học thuật cho sinh viên Phenikaa: bảng tin và hỏi đáp, kho tài liệu theo môn, nhóm học, nhắn tin, công cụ ôn tập (flashcard, quiz) và **N7AI**, trợ lý học tập AI đọc được tài liệu, ghi chú của bạn và luôn trích nguồn.

| | |
|---|---|
| Ứng dụng | https://puc.vnhat.dev |
| Hướng dẫn sử dụng và tài liệu | https://docs-puc.vnhat.dev |
| Admin Console | https://admin-puc.vnhat.dev |
| REST API | https://puc.vnhat.dev/api |

## Cấu trúc

Monorepo `pnpm` + Turborepo.

| Thư mục | Nội dung |
|---|---|
| `apps/web` | Web: Next.js 15 (App Router), Tailwind v4, shadcn/ui |
| `apps/api` | API: NestJS 11, PostgreSQL, Redis, Socket.IO |
| `apps/admin` | Admin Console (Vite SPA) |
| `apps/docs` | Cổng tài liệu (Vite SPA), nội dung từ thư mục `docs/` |
| `apps/ai-news` | Dịch vụ tin tức AI |
| `packages/schemas` | Zod schema và kiểu dùng chung |
| `packages/ui`, `packages/tsconfig` | Design token, cấu hình TypeScript |
| `docs/` | Tài liệu: hướng dẫn, sản phẩm, kỹ thuật |
| `scripts/` | Deploy, migration, vận hành |

## Chạy cục bộ

Cần Node 22, pnpm, Docker.

```bash
pnpm install
docker compose up -d postgres redis
cp apps/api/.env.example apps/api/.env      # điền biến cần thiết
cp apps/web/.env.example apps/web/.env
pnpm dev                                     # Web :3000, API :4000/api
```

| Lệnh | Việc |
|---|---|
| `pnpm dev:fe` / `dev:api` / `dev:admin` / `dev:docs` | Chạy riêng từng app |
| `pnpm typecheck` / `pnpm lint` / `pnpm build` | Kiểm tra trước khi deploy |
| `pnpm --filter @pu/api test` | Test tích hợp API (cần Postgres, Redis) |
| `pnpm docs:erd` | Sinh lại ERD sau migration |
| `pnpm bot:setup` | Tạo tài khoản bot mẫu |

## Deploy

```bash
pnpm run deploy:vps     # build trên VPS, chuyển slot web, kiểm tra sức khỏe
pnpm run deploy:mac     # build trên Mac rồi đẩy lên VPS
```

Script đồng bộ cả thư mục làm việc, không theo commit. Chi tiết và vận hành (backup, giám sát, Web Push, Google, seed): [Triển khai và vận hành](docs/deployment-and-devops.md).

## Tài liệu

| Cần | Xem |
|---|---|
| Dùng sản phẩm | [Hướng dẫn sử dụng](docs/guide/bat-dau.md) |
| Hiểu sản phẩm | [Tổng quan](docs/product/overview.md), [N7AI](docs/product/n7ai/overview.md) |
| Bắt đầu phát triển | [Get started](docs/get-started.md), [Kiến trúc](docs/architecture.md), [Frontend](docs/frontend-guide.md) |
| API và dữ liệu | [API](docs/api-specification.md), [Cơ sở dữ liệu](docs/database-schema.md), [Sơ đồ C4 và ERD](docs/diagrams/README.md) |
| Đăng nhập Google | [auth-google](docs/auth-google.md) |
| Tính năng đã làm | [FEAT](docs/FEAT.md) |
| Quy tắc làm việc | [AGENTS.md](AGENTS.md) |

Mục lục đầy đủ: [docs/README.md](docs/README.md).
