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
      pg[("<b>pu_postgres</b><br/>pgvector/pg16 127.0.0.1:5432<br/>volume postgres_data")]
      redis[("<b>pu_redis</b><br/>redis:7 127.0.0.1:6379<br/>AOF · noeviction")]
    end
  end

  r2["Cloudflare R2<br/>uploads + backups/db (mã hóa)"]
  google["Google OAuth"]
  gmail["Gmail SMTP :465"]

  user -->|HTTPS| nginx
  nginx -->|"/  ·  /_next/static (cache 1y)"| web
  nginx -->|"/api/  ·  /graphql"| api
  nginx -->|"/api/socket.io (Upgrade: websocket)"| api
  web -->|"rewrite (SSR) INTERNAL_API_URL=:4001"| api
  api -->|SQL| pg
  api -->|BullMQ| redis
  api --> r2 & google & gmail
  cron["<b>cron</b><br/>03:17 backup-db.sh<br/>*/5 healthcheck.sh"]
  cron -->|"pg_dump (docker exec)"| pg
  cron -->|"AES-256 .enc"| r2
  cron -.->|"cảnh báo (tùy chọn)"| tg["Telegram Bot"]

  dev -->|"1. rsync (trừ .env, secret json)"| VPS
  dev -->|"2. ssh: migrations · pnpm build · restart"| VPS

  classDef app fill:#1e3a8a,stroke:#1e3a8a,color:#fff
  classDef store fill:#ffedd5,stroke:#f97316,color:#7c2d12
  classDef external fill:#f1f5f9,stroke:#94a3b8,color:#334155
  class web,api,nginx app
  class pg,redis store
  class r2,google,gmail,tg,cron external
```

## Các bước `scripts/deploy.sh`

```mermaid
flowchart LR
  s1["1 · Kiểm tra SSH"] --> s2["2 · rsync --delete<br/>(giữ .env, bỏ secret json)"] --> s3["3 · docker compose up postgres redis<br/>+ migrations idempotent"] --> s4["4 · pnpm install<br/>+ turbo build API/packages<br/>+ next build vào slot rảnh .next-a|b"] --> s5["5 · đổi slot (.web-slot.env)<br/>restart pu-api, pu-web · reload nginx"] --> s6["6 · Health check<br/>web 200 · /api/auth/me 401"]
```

Migration chạy **mỗi lần deploy** theo thứ tự: `schema.sql` → `domain1-upgrade.sql` → `add-communities.sql` → `add-indexes.sql` → `auth-upgrade.sql` → `messaging-upgrade.sql` → `notifications-upgrade.sql` → `push-upgrade.sql`. ⇒ Mọi file phải **idempotent** và **không bao giờ UPDATE hàng loạt dữ liệu người dùng thật**.

**Web blue/green (không lỗi giữa lúc deploy):** trước đây `next build` ghi đè `.next` trong khi `next start` vẫn phục vụ từ đó ⇒ HTML trỏ tới chunk đã bị xóa, trình duyệt báo *"Application error: a client-side exception"* suốt thời gian build. Nay web build vào slot rảnh (`apps/web/.next-a` hoặc `.next-b`, qua `NEXT_DIST_DIR`), server cũ chạy tiếp tới lúc restart; slot đang chạy ghi trong `/var/www/pu-connector/.web-slot.env`, systemd drop-in `pu-web.service.d/slot.conf` nạp file này. Chunk JS bản trước được chép sang slot mới (giữ 7 ngày) ⇒ tab đang mở chuyển trang không gặp ChunkLoadError. Rollback: ghi lại slot cũ vào `.web-slot.env` rồi `systemctl restart pu-web`.

## Vận hành: backup & giám sát

| Việc | Lịch | Script | Kết quả |
|---|---|---|---|
| Backup Postgres | 03:17 hằng ngày | `scripts/ops/backup-db.sh` | `pu-YYYYmmdd-HHMMSS.sql.gz.enc` → R2 `backups/db/` (30 ngày) + `/var/backups/pu-connector` (7 bản) |
| Giám sát | mỗi 5 phút | `scripts/ops/healthcheck.sh` | Chỉ báo khi trạng thái đổi; Telegram nếu có `TELEGRAM_*` |
| Thử khôi phục | thủ công / định kỳ | `scripts/ops/restore-db.sh` | Nạp vào DB tạm, đếm bảng/users, xóa DB tạm |

Bucket R2 public ⇒ backup luôn mã hóa bằng `BACKUP_PASSPHRASE` (`.env`, giữ bản sao ngoài VPS).

## Secret & cấu hình

| Ở đâu | Chứa | Ghi chú |
|---|---|---|
| `/var/www/pu-connector/.env` | `DATABASE_URL`, `SESSION_SECRET`, `APP_URL`, `GOOGLE_*`, `SMTP_*`, `R2_*`, `REDIS_URL`, `VAPID_*`, `BACKUP_PASSPHRASE`, `TELEGRAM_*` (tùy chọn) | Không bị rsync ghi đè; backup `.env.bak.*` |
| `apps/web/.env` (VPS) | `INTERNAL_API_URL=http://localhost:4001` | Port API production là **4001** |
| `/etc/nginx/sites-available/pu-connector.conf` | Routing + SSL | Backup `/root/pu-connector.conf.bak.*` |

**Changelog:**
- 2026-10-13 — Web build blue/green (`.next-a`/`.next-b`), giữ chunk cũ 7 ngày; gián đoạn chỉ còn lúc restart.
- 2026-10-04 — thêm cron backup DB mã hóa lên R2, healthcheck 5 phút, restore-db.sh.
- 2026-10-04 — Postgres/Redis chỉ bind localhost (Docker bỏ qua firewall), thêm pu_redis, build tuần tự, migration push.
- 2026-10-04 — tạo mới; thêm `location /api/socket.io` (websocket), `messaging-upgrade.sql`, session lưu Postgres.
