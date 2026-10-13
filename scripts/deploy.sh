#!/usr/bin/env bash

# ==============================================================================
# 🚀 PU CONNECTOR - PRODUCTION DEPLOY SCRIPT (VPS puc.vnhat.dev)
# ==============================================================================

set -e

# Configuration
VPS_HOST="root@103.195.237.112"
VPS_DIR="/var/www/pu-connector"
DOMAIN="puc.vnhat.dev"

# Colors
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

echo -e "${BLUE}======================================================${NC}"
echo -e "${BLUE}  PU CONNECTOR - DEPLOYING TO VPS (puc.vnhat.dev)     ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Check SSH Connection
echo -e "\n${YELLOW}[1/6] Kiểm tra kết nối SSH tới VPS...${NC}"
ssh -o BatchMode=yes -o ConnectTimeout=5 "$VPS_HOST" "echo 'SSH Connected Successfully'" || {
  echo -e "${RED}Lỗi: Không thể kết nối SSH tới $VPS_HOST. Vui lòng kiểm tra SSH Key.${NC}"
  exit 1
}

# 2. Sync codebase via Rsync
echo -e "\n${YELLOW}[2/6] Đồng bộ mã nguồn lên VPS (/var/www/pu-connector)...${NC}"
ssh "$VPS_HOST" "mkdir -p $VPS_DIR"

rsync -avz --delete \
  --exclude 'node_modules' \
  --exclude '.next' \
  --exclude '.next-*' \
  --exclude '.web-slot.env*' \
  --exclude 'dist' \
  --exclude '.turbo' \
  --exclude '.git' \
  --exclude '.env' \
  --exclude '.env.local' \
  --exclude 'puc-client-secret*.json' \
  --exclude 'client_secret*.json' \
  --exclude '*.log' \
  --exclude '.DS_Store' \
  ./ "$VPS_HOST:$VPS_DIR/"

# 3. Setup Remote Environment & Docker PostgreSQL
echo -e "\n${YELLOW}[3/6] Cấu hình môi trường và khởi động PostgreSQL Docker...${NC}"
ssh "$VPS_HOST" "bash -s" << 'REMOTE_SETUP'
set -e
cd /var/www/pu-connector

# Setup .env if not exists (secret sinh ngẫu nhiên; R2_* điền tay sau — không commit key)
if [ ! -f .env ]; then
  cat << EOF > .env
PORT=4001
HOST=0.0.0.0
DATABASE_URL=postgresql://pu_user:pu_password@localhost:5432/pu_connector_db
SESSION_SECRET=$(openssl rand -hex 32)
WEB_PORT=3000
NEXT_PUBLIC_API_URL=/api
INTERNAL_API_URL=http://localhost:4001
APP_URL=https://puc.vnhat.dev
R2_ACCOUNT_ID=
R2_ACCESS_KEY_ID=
R2_SECRET_ACCESS_KEY=
R2_ENDPOINT=
R2_BUCKET_NAME=pu-connector
R2_PUBLIC_URL=
EOF
  echo "Đã tạo file .env mới trên VPS."
fi

# Ensure Docker Compose Postgres is running
echo "Đang khởi động PostgreSQL pgvector container..."
docker compose up -d postgres redis

# Wait for Postgres
echo "Đang chờ PostgreSQL sẵn sàng..."
for i in {1..20}; do
  if docker exec pu_postgres pg_isready -U pu_user -d pu_connector_db > /dev/null 2>&1; then
    echo "PostgreSQL đã sẵn sàng!"
    break
  fi
  sleep 1
done

# Run idempotent migrations and ensure all tables & columns exist
echo "Đang kiểm tra và áp dụng cập nhật CSDL (Schema & Upgrades)..."
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/schema.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/domain1-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/add-communities.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/add-indexes.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/auth-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/messaging-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/notifications-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/push-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/search-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/admin-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-v2-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-study-group-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-push-clear-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/user-blocks-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/presence-upgrade.sql

# Seed initial users if empty
USER_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "$USER_COUNT" -eq "0" ]; then
  echo "Phát hiện bảng users trống. Đang nạp 100 tài khoản mẫu..."
  docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/seed-users.sql
fi

# Seed initial posts & courses if empty
POST_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM posts;" 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "$POST_COUNT" -eq "0" ]; then
  echo "Phát hiện bảng posts trống. Đang nạp các môn học, khoa và bài viết mẫu..."
  pnpm --filter @pu/api seed:posts
fi
REMOTE_SETUP

# 4. Install Dependencies & Build on VPS
echo -e "\n${YELLOW}[4/6] Cài đặt dependencies và Build Monorepo trên VPS...${NC}"
ssh "$VPS_HOST" "bash -s" << 'REMOTE_BUILD'
set -e
cd /var/www/pu-connector
echo "Đang chạy pnpm install..."
pnpm install

echo "Đang build API & packages..."
pnpm exec turbo run build --concurrency=1 --filter='!@pu/web'  # tuần tự: VPS 2GB RAM, build song song dễ hết bộ nhớ

# Smoke check: nạp toàn bộ module API đã build (bắt lỗi import runtime) TRƯỚC khi restart
(cd apps/api && node -e "require('./dist/apps/api/src/app.module')") || {
  echo "Lỗi: API build không nạp được — dừng deploy, bản đang chạy giữ nguyên."
  exit 1
}

# Web blue/green: build vào slot rảnh, server cũ vẫn phục vụ slot đang chạy ⇒ không lỗi chunk giữa lúc build
# (gọi thẳng next build: cache output của turbo gắn với .next/**)
LIVE=$(sed -n 's/^NEXT_DIST_DIR=//p' .web-slot.env 2>/dev/null || true)
LIVE=${LIVE:-.next}
[ "$LIVE" = ".next-a" ] && SLOT=.next-b || SLOT=.next-a
echo "Đang build Web vào apps/web/$SLOT (đang chạy: $LIVE)..."
# Mồi cache chung từ cache thật của slot đang chạy (lần đầu chuyển sang slot)
if [ ! -d apps/web/.next-cache ] && [ -d "apps/web/$LIVE/cache" ] && [ ! -L "apps/web/$LIVE/cache" ]; then
  mv "apps/web/$LIVE/cache" apps/web/.next-cache
fi
rm -rf "apps/web/$SLOT" && mkdir -p "apps/web/$SLOT" apps/web/.next-cache
ln -s ../.next-cache "apps/web/$SLOT/cache"  # 2 slot dùng chung cache webpack ⇒ build ấm, ít RAM
# Ưu tiên thấp (nice/ionice): site đang chạy vẫn được CPU/IO trong lúc build
NEXT_DIST_DIR=$SLOT NEXT_SKIP_CHECKS=1 nice -n 15 ionice -c3 pnpm --filter @pu/web build

# Giữ chunk JS của bản trước 7 ngày: tab đang mở HTML cũ chuyển trang vẫn tải được (tránh ChunkLoadError)
if [ -d "apps/web/$LIVE/static" ]; then
  cp -Rnp "apps/web/$LIVE/static/." "apps/web/$SLOT/static/"
  find "apps/web/$SLOT/static" -type f -mtime +7 -delete
fi
echo "NEXT_DIST_DIR=$SLOT" > .web-slot.env.next
REMOTE_BUILD

# 5. Restart Systemd Services & Reload Nginx
echo -e "\n${YELLOW}[5/6] Khởi động lại dịch vụ Systemd và Nginx...${NC}"
ssh "$VPS_HOST" "bash -s" << 'REMOTE_SERVICES'
set -e
# pu-web đọc slot web từ .web-slot.env (drop-in, ghi đè .env)
mkdir -p /etc/systemd/system/pu-web.service.d
cat > /etc/systemd/system/pu-web.service.d/slot.conf << 'UNIT'
[Service]
EnvironmentFile=-/var/www/pu-connector/.web-slot.env
UNIT
cd /var/www/pu-connector
mv .web-slot.env.next .web-slot.env  # chuyển slot (rollback: ghi lại slot cũ rồi restart pu-web)

systemctl daemon-reload
systemctl enable pu-api pu-web
systemctl restart pu-api
systemctl restart pu-web

# Wait 3s for API and Web to start
sleep 3

# Verify services running
systemctl is-active --quiet pu-api && echo "pu-api (NestJS): ACTIVE" || { echo "pu-api: FAILED"; exit 1; }
systemctl is-active --quiet pu-web && echo "pu-web (Next.js): ACTIVE" || { echo "pu-web: FAILED"; exit 1; }

# Reload Nginx
nginx -t && systemctl reload nginx

# Dọn thư mục build cũ trước khi có slot (chỉ khi không còn là slot đang chạy)
if grep -q '^NEXT_DIST_DIR=.next-' .web-slot.env; then rm -rf apps/web/.next; fi
REMOTE_SERVICES

# 6. Verify Deployment Health
echo -e "\n${YELLOW}[6/6] Kiểm tra tình trạng hoạt động (Health Check)...${NC}"
sleep 2

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN")
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/auth/me")

echo -e "Web (https://$DOMAIN): HTTP Status ${GREEN}$HTTP_STATUS${NC}"
echo -e "API (https://$DOMAIN/api/auth/me): HTTP Status ${GREEN}$API_STATUS${NC} (Session Check)"

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "\n${GREEN}======================================================${NC}"
  echo -e "${GREEN}  🎉 DEPLOY THÀNH CÔNG LÊN: https://$DOMAIN          ${NC}"
  echo -e "${GREEN}======================================================${NC}"
else
  echo -e "\n${YELLOW}Lưu ý: Web trả về mã $HTTP_STATUS, vui lòng kiểm tra logs: ssh $VPS_HOST 'journalctl -u pu-web -n 50'${NC}"
fi
