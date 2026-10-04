# 06 · Deployment (Production)

> Hạ tầng chạy `https://puc.vnhat.dev`. Cập nhật lần cuối: **2026-10-04**.

```mermaid
flowchart LR
  user(["🌐 Người dùng"])
  dev(["💻 Dev máy local<br/>bash scripts/deploy.sh"])

  subgraph VPS["VPS Debian · 103.195.237.112 · /var/www/pu-connector"]
    direction LR
    nginx["<b>nginx</b> :443 (Let's Encrypt)<br/>:80 → 301 HTTPS"]
    subgraph systemd["systemd"]
      web["<b>pu-web.service</b><br/>next start :3000"]
      api["<b>pu-api.service</b><br/>node dist/main.js :4001<br/>NODE_ENV=production<br/>EnvironmentFile=.env"]
    end
    subgraph docker["Docker Compose"]
      pg[("<b>pu_postgres</b><br/>pgvector/pg16 :5432<br/>volume postgres_data")]
    end
  end

  r2["Cloudflare R2"]
  google["Google OAuth"]
  gmail["Gmail SMTP :465"]

  user -->|HTTPS| nginx
  nginx -->|"/  ·  /_next/static (cache 1y)"| web
  nginx -->|"/api/  ·  /graphql"| api
  nginx -->|"/api/socket.io (Upgrade: websocket)"| api
  web -->|"rewrite (SSR) INTERNAL_API_URL=:4001"| api
  api -->|SQL| pg
  api --> r2 & google & gmail

  dev -->|"1. rsync (trừ .env, secret json)"| VPS
  dev -->|"2. ssh: migrations · pnpm build · restart"| VPS

  classDef app fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef store fill:#ffedd5,stroke:#f97316,color:#7c2d12
  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
  class web,api,nginx app
  class pg store
  class r2,google,gmail external
```

## Các bước `scripts/deploy.sh`

```mermaid
flowchart LR
  s1["1 · Kiểm tra SSH"] --> s2["2 · rsync --delete<br/>(giữ .env, bỏ secret json)"] --> s3["3 · docker compose up postgres<br/>+ migrations idempotent"] --> s4["4 · pnpm install<br/>+ turbo build"] --> s5["5 · restart pu-api, pu-web<br/>reload nginx"] --> s6["6 · Health check<br/>web 200 · /api/auth/me 401"]
```

Migration chạy **mỗi lần deploy** theo thứ tự: `schema.sql` → `domain1-upgrade.sql` → `add-communities.sql` → `add-indexes.sql` → `auth-upgrade.sql` → `messaging-upgrade.sql`. ⇒ Mọi file phải **idempotent** và **không bao giờ UPDATE hàng loạt dữ liệu người dùng thật**.

## Secret & cấu hình

| Ở đâu | Chứa | Ghi chú |
|---|---|---|
| `/var/www/pu-connector/.env` | `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `GOOGLE_*`, `SMTP_*`, `R2_*` | Không bị rsync ghi đè; backup `.env.bak.*` |
| `apps/web/.env` (VPS) | `INTERNAL_API_URL=http://localhost:4001` | Port API production là **4001** |
| `/etc/nginx/sites-available/pu-connector.conf` | Routing + SSL | Backup `/root/pu-connector.conf.bak.*` |

**Changelog:**
- 2026-10-04 — tạo mới; thêm `location /api/socket.io` (websocket), `messaging-upgrade.sql`, session lưu Postgres.
