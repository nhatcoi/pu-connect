# 02 · Containers (C4 Level 2)

> Các ứng dụng/tiến trình và giao thức giữa chúng. Cập nhật lần cuối: **2026-10-04**.

```mermaid
flowchart LR
  browser(["🌐 Trình duyệt<br/>desktop / mobile web"])

  subgraph PUC["PU Connector (monorepo pnpm + Turborepo)"]
    direction LR
    web["<b>apps/web</b><br/>Next.js 15 App Router<br/>React 19 · Tailwind v4 · animate-ui<br/>Zustand store"]
    api["<b>apps/api</b><br/>NestJS 11<br/>REST /api · GraphQL /graphql<br/>Socket.IO /api/socket.io<br/>Passport session"]
    schemas[["<b>packages/schemas</b><br/>zod schemas + TS types<br/>(dùng chung web ↔ api)"]]
    db[("<b>PostgreSQL 16 + pgvector</b><br/>dữ liệu nghiệp vụ<br/>user_sessions (session store)")]
    mobile["apps/mobile<br/>Expo (planned)"]
  end

  google["Google OAuth"]
  gmail["Gmail SMTP"]
  r2["Cloudflare R2"]

  browser -->|"HTTPS: trang SSR/CSR"| web
  browser -->|"HTTPS fetch /api/* · /graphql<br/>cookie pu_session"| web
  web -->|"rewrite /api/* · /graphql → INTERNAL_API_URL"| api
  browser <-->|"WebSocket /api/socket.io<br/>event: notification"| api
  browser -->|"tải ảnh/tài liệu (public URL)"| r2

  api -->|"SQL · pg.Pool (max 20)<br/>ACID transaction"| db
  api -->|OAuth 2.0| google
  api -->|SMTP| gmail
  api -->|S3 PutObject| r2
  web -. import type .-> schemas
  api -. import type .-> schemas
  mobile -.->|REST/GraphQL · planned| api

  classDef app fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef store fill:#ffedd5,stroke:#f97316,color:#7c2d12
  classDef lib fill:#e0e7ff,stroke:#6366f1,color:#312e81
  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
  classDef planned fill:#fff,stroke:#94a3b8,color:#64748b,stroke-dasharray:5 5
  class web,api app
  class db store
  class schemas lib
  class google,gmail,r2 external
  class mobile planned
```

## Giao thức theo mục đích

| Giao thức | Đường dẫn | Dùng cho | Xác thực |
|---|---|---|---|
| REST | `/api/*` | Auth, posts, comments, communities, upload, notifications, search | Cookie `pu_session` (Passport) |
| GraphQL (Apollo) | `/graphql` | Hồ sơ, follow, gợi ý theo dõi, feed/document lồng nhau | Cookie `pu_session` |
| WebSocket (Socket.IO) | `/api/socket.io` | Đẩy thông báo realtime (`notification`) | Cookie ở handshake; room `user:{id}` do server cấp |
| SQL | `pg.Pool` | Toàn bộ dữ liệu, session store `user_sessions` | `DATABASE_URL` |

## Ghi chú kiến trúc

- **Web gọi API cùng origin** qua rewrite của Next.js (`/api/*`, `/graphql`) ⇒ cookie first-party, không cần CORS ở trình duyệt. Production: nginx route `/api/` và `/graphql` thẳng vào API (xem [06](./06-deployment.md)).
- **`packages/schemas` là mã TS nguồn**: API chỉ được `import type` lúc runtime (validate phía server khai báo lại trong `dto/`).
- **Session lưu Postgres** (`connect-pg-simple`) ⇒ restart/deploy không đăng xuất; dùng chung cho HTTP và Socket.IO.

**Changelog:**
- 2026-10-04 — tạo mới; Socket.IO chuyển sang `/api/socket.io` có xác thực; session store Postgres.
