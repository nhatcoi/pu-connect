#!/usr/bin/env bash
# Chạy trên VPS: môi trường (.env), Postgres/Redis, migration, tài khoản bot, dữ liệu mẫu lần đầu.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."

# .env lần đầu (secret sinh ngẫu nhiên; R2_* điền tay sau — không commit key)
if [ ! -f .env ]; then
  cat << EOF2 > .env
PORT=4001
HOST=0.0.0.0
DATABASE_URL=postgresql://pu_user:pu_password@localhost:5432/pu_connector_db
SESSION_SECRET=$(openssl rand -hex 32)
WEB_PORT=3000
NEXT_PUBLIC_API_URL=/api
INTERNAL_API_URL=http://localhost:4001
APP_URL=https://puc.vnhat.dev
ADMIN_URL=https://admin-puc.vnhat.dev
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=
R2_BUCKET_NAME=pu-connector
R2_PUBLIC_URL=
EOF2
  echo "Đã tạo file .env mới trên VPS."
fi

echo "Khởi động PostgreSQL (pgvector) và Redis..."
docker compose up -d postgres redis
for i in $(seq 1 20); do
  docker exec pu_postgres pg_isready -U pu_user -d pu_connector_db >/dev/null 2>&1 && break
  sleep 1
done
docker exec pu_postgres pg_isready -U pu_user -d pu_connector_db >/dev/null 2>&1 || { echo "PostgreSQL không sẵn sàng."; exit 1; }

bash deploy/remote/migrate.sh

# Bot Simulator: mật khẩu bot ngẫu nhiên trong .env (không dùng mật khẩu mặc định trong repo), tạo tài khoản bot lần đầu
grep -q '^BOT_PASSWORD=' .env || echo "BOT_PASSWORD=$(openssl rand -hex 12)" >> .env
grep -q '^BOT_INGEST_TOKEN=' .env || echo "BOT_INGEST_TOKEN=$(openssl rand -hex 24)" >> .env  # tool crawl đẩy bài qua POST /api/bots/ingest
BOT_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM users WHERE is_bot;" | tr -d '[:space:]')
if [ "$BOT_COUNT" -eq "0" ]; then
  echo "Chưa có tài khoản bot. Đang tạo..."
  node --env-file=.env tools/bot-simulator/setup-bots.mjs  # không source .env: file có thể chứa ký tự đặc biệt của shell
fi

# Dữ liệu mẫu khi DB còn trống
USER_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "$USER_COUNT" -eq "0" ]; then
  echo "Bảng users trống. Nạp 100 tài khoản mẫu..."
  docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/seed-users.sql
fi
POST_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM posts;" 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "$POST_COUNT" -eq "0" ]; then
  echo "Bảng posts trống. Nạp môn học, khoa và bài viết mẫu..."
  pnpm --filter @pu/api seed:posts
fi
echo "DB: xong."
