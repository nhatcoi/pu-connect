# 🚀 Triển khai & DevOps — PU Connect Deployment & DevOps Guide

Tài liệu này hướng dẫn cách cấu hình môi trường, đóng gói container Docker và triển khai hệ thống **PU Connect** lên môi trường Production (VPS, Cloudflare R2, Vercel, AWS/DigitalOcean).

---

## 1. Biến Môi trường (Environment Variables)

### 1.1. Cấu hình Web (`apps/web/.env.production`)
```bash
# URL của NestJS Backend API
NEXT_PUBLIC_API_URL=https://api.puconnector.com/api

# WebSocket Server URL
NEXT_PUBLIC_WS_URL=wss://api.puconnector.com

# Domain ứng dụng
NEXT_PUBLIC_APP_URL=https://puconnector.com
```

### 1.2. Cấu hình Backend (`apps/api/.env.production`)
```bash
# Port và Host
PORT=4000
HOST=0.0.0.0

# Bảo mật JWT
JWT_SECRET=super_secure_random_jwt_secret_key_change_me_in_prod

# PostgreSQL Database
DATABASE_URL=postgresql://pu_user:pu_password@postgres:5432/pu_connector_db?sslmode=require

# Redis Cache & Queue
REDIS_HOST=redis
REDIS_PORT=6379
REDIS_PASSWORD=pu_redis_password

# Cloudflare R2 / AWS S3 Storage
S3_ENDPOINT=https://<ACCOUNT_ID>.r2.cloudflarestorage.com
S3_ACCESS_KEY_ID=your_r2_access_key
S3_SECRET_ACCESS_KEY=your_r2_secret_key
S3_BUCKET_NAME=pu-connector-storage
S3_PUBLIC_DOMAIN=https://cdn.puconnector.com
```

---

## 2. Đóng gói Docker Container (Production Multi-stage Dockerfile)

### `docker-compose.production.yml`
```yaml
version: '3.8'

services:
  postgres:
    image: pgvector/pgvector:pg16
    container_name: pu_postgres
    restart: always
    environment:
      POSTGRES_USER: pu_user
      POSTGRES_PASSWORD: pu_password
      POSTGRES_DB: pu_connector_db
    volumes:
      - postgres_data:/var/lib/postgresql/data
    ports:
      - "5432:5432"

  redis:
    image: redis:7-alpine
    container_name: pu_redis
    restart: always
    command: redis-server --requirepass pu_redis_password
    ports:
      - "6379:6379"

  api:
    build:
      context: .
      dockerfile: ./apps/api/Dockerfile
    container_name: pu_api
    restart: always
    environment:
      - PORT=4000
      - HOST=0.0.0.0
      - DATABASE_URL=postgresql://pu_user:pu_password@postgres:5432/pu_connector_db
      - REDIS_HOST=redis
    depends_on:
      - postgres
      - redis
    ports:
      - "4000:4000"

  web:
    build:
      context: .
      dockerfile: ./apps/web/Dockerfile
    container_name: pu_web
    restart: always
    ports:
      - "3000:3000"

volumes:
  postgres_data:
```

---

## 3. Cấu hình Nginx Reverse Proxy & SSL (Certbot Let's Encrypt)

```nginx
# /etc/nginx/sites-available/puconnector.com

# 1. Frontend Next.js Web
server {
    server_name puconnector.com www.puconnector.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}

# 2. Backend NestJS API & WebSocket
server {
    server_name api.puconnector.com;

    location / {
        proxy_pass http://127.0.0.1:4000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection "Upgrade";
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

---

## 4. Kiểm tra sức khỏe hệ thống (Health Check & Monitoring)

* **Web Health:** `curl -I https://puconnector.com` $\rightarrow$ `HTTP/2 200`
* **API Health:** `curl -I https://api.puconnector.com/api/posts` $\rightarrow$ `HTTP/2 200`
* **Log kiểm tra thời gian thực:** `docker logs -f pu_api` hoặc `pm2 logs`


---

# Phụ lục: cấu hình và vận hành (chuyển từ README)

## 6. Redis & Web Push
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

## 7. Vận hành: backup & giám sát (VPS)
Cài một lần trên VPS (idempotent): `ssh root@<vps> 'bash /var/www/pu-connector/scripts/ops/setup-ops.sh'`
- **Backup DB** 03:17 hằng ngày (`scripts/ops/backup-db.sh`): `pg_dump` → gzip → mã hóa AES-256 (`BACKUP_PASSPHRASE` trong `.env`, tự sinh) → R2 `backups/db/` (giữ 30 ngày) + `/var/backups/pu-connector` (giữ 7 bản). Bucket R2 là public nên **bắt buộc mã hóa**. **Lưu bản sao `BACKUP_PASSPHRASE` ngoài VPS** — mất khóa = không khôi phục được.
- **Thử khôi phục** (an toàn, vào DB tạm rồi xóa): `bash scripts/ops/restore-db.sh [file | backups/db/<tên>]`. Ghi đè DB thật: thêm `--into-live` (phải gõ tên DB xác nhận).
- **Giám sát** mỗi 5 phút (`scripts/ops/healthcheck.sh`): web 200, API 401, systemd, container, Postgres, đĩa < 85%, RAM, backup < 26 giờ. Chỉ cảnh báo khi trạng thái đổi.
- **Xem dữ liệu cá nhân hóa của 1 user** (chỉ đọc): `pnpm user:insight <username>` (DB stage qua SSH) hoặc thêm `--local`. In hồ sơ, `user_interests`, tín hiệu nguồn, `user_events` gần nhất, câu hỏi N7AI.
- **Cảnh báo Telegram** (tùy chọn): thêm `TELEGRAM_BOT_TOKEN`, `TELEGRAM_CHAT_ID` vào `.env` trên VPS (tạo bot qua @BotFather). Không có thì ghi log `/var/log/pu-monitor.log`, `/var/log/pu-backup.log`.

## 7b. Bot (demo / nội dung mồi)
Bot đăng bài sưu tầm theo job và tự trả lời/thả tim bình luận, chạy trong API; điều khiển ở **Admin → Bot** (nhập Excel/JSON → chọn bot → tạo job). `pnpm bot:setup` tạo vài tài khoản bot mẫu. Biến môi trường: `BOT_PASSWORD` (mật khẩu bot), `BOT_INGEST_TOKEN` (tool crawl xin URL ảnh). Chi tiết: [`docs/core/13-admin-console.md`](docs/core/13-admin-console.md#bot-admin--bot).

## 🔐 Xác thực
Email + mật khẩu và Google OAuth (tùy chọn). Biến môi trường `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET`, `GOOGLE_CALLBACK_URL` (xem `.env.example`) và hướng dẫn cấu hình tại [`docs/auth-google.md`](docs/auth-google.md). Connector Google Drive / Calendar / Gmail / Forms / Sheets / Tasks của N7AI gọi MCP server tự host [`workspace-mcp`](https://github.com/taylorwilsdon/google_workspace_mcp) (`127.0.0.1:8765`, service systemd `workspace-mcp`) qua `GOOGLE_WORKSPACE_MCP_URL`; không cần Developer Preview của Google. Cấu hình `CONNECTOR_ENCRYPTION_KEY`, callback `GOOGLE_CONNECTOR_CALLBACK_URL` (mặc định `GOOGLE_CALLBACK_URL`), tùy chọn client riêng `GOOGLE_MCP_CLIENT_ID` / `GOOGLE_MCP_CLIENT_SECRET` (mặc định client đăng nhập), bật Drive / Calendar / Gmail / Forms / Sheets / Tasks API trong Google Cloud. Model/gateway `AI_MODEL` phải hỗ trợ Chat Completions tool calling. Chi tiết: [`docs/core/14-google-mcp-connectors.md`](docs/core/14-google-mcp-connectors.md). Tìm kiếm web cho N7AI: `TAVILY_API_KEY` (tùy chọn). Tìm kiếm bài báo khoa học toàn cầu (Semantic Scholar & arXiv): `SEMANTIC_SCHOLAR_API_KEY` (tùy chọn; tự động dự phòng sang arXiv khi không có key hoặc rate-limit). Kiểm tra mã: `pnpm lint` (ESLint flat config ở `apps/web`, `apps/api`). Tài khoản seed local dùng mật khẩu `password123`.

## PU Connect — dữ liệu tài khoản trường

Connector dùng extension tại [PKA](https://pka.vnhat.dev/extension) và MCP trên service PKA. `PKA_CONNECTOR_URL` mặc định `https://pka.vnhat.dev`; không đưa cookie trường vào PUC. Xem [thiết kế kết nối](docs/core/20-pu-connector-mcp.md).
