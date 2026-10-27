#!/usr/bin/env bash

# ==============================================================================
# 🚀 PU CONNECTOR - LOCAL FAST DEPLOY SCRIPT (Mac Mini -> VPS puc.vnhat.dev)
# ==============================================================================
# Mô hình tối ưu: Build toàn bộ Monorepo trên Mac Mini (siêu nhanh ~30s),
# sau đó rsync mã nguồn và build artifacts lên VPS rồi chuyển slot Blue/Green.
# VPS không tốn CPU/RAM để biên dịch -> 0% nghẽn tài nguyên, 0% OOM.
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
echo -e "${BLUE}  PU CONNECTOR - FAST DEPLOY (MAC MINI -> VPS)        ${NC}"
echo -e "${BLUE}======================================================${NC}"

# 1. Kiểm tra môi trường Local & Kết nối SSH tới VPS
echo -e "\n${YELLOW}[1/6] Kiểm tra môi trường Local & SSH tới VPS...${NC}"
command -v pnpm >/dev/null 2>&1 || { echo -e "${RED}Lỗi: pnpm chưa được cài đặt trên máy local.${NC}"; exit 1; }
command -v rsync >/dev/null 2>&1 || { echo -e "${RED}Lỗi: rsync chưa được cài đặt trên máy local.${NC}"; exit 1; }

ssh -o BatchMode=yes -o ConnectTimeout=5 "$VPS_HOST" "echo 'SSH Connected Successfully'" || {
  echo -e "${RED}Lỗi: Không thể kết nối SSH tới $VPS_HOST. Vui lòng kiểm tra SSH Key.${NC}"
  exit 1
}

# 2. Xác định Slot Blue/Green & Biên dịch Monorepo tại Local (Mac Mini)
echo -e "\n${YELLOW}[2/6] Xác định slot và biên dịch Monorepo trên Mac Mini...${NC}"
LIVE=$(ssh -o ConnectTimeout=8 "$VPS_HOST" "sed -n 's/^NEXT_DIST_DIR=//p' $VPS_DIR/.web-slot.env 2>/dev/null || true")
LIVE=${LIVE:-.next}
[ "$LIVE" = ".next-a" ] && SLOT=.next-b || SLOT=.next-a
echo -e "Slot hiện tại trên VPS: ${GREEN}$LIVE${NC} -> Slot build mới: ${GREEN}$SLOT${NC}"

# Build API & Packages trên Mac
echo "Đang build API NestJS & Admin Vite trên Mac Mini..."
pnpm exec turbo run build --filter='!@pu/web'

# Smoke check API bundle
(cd apps/api && node -e "require('./dist/apps/api/src/app.module')") || {
  echo -e "${RED}Lỗi: API build không nạp được — dừng deploy.${NC}"
  exit 1
}

# Build Web trên Mac vào .next rồi copy vào slot
echo "Đang build Next.js Web trên Mac Mini..."
NEXT_SKIP_CHECKS=1 pnpm --filter @pu/web build

[ -f "apps/web/.next/BUILD_ID" ] || {
  echo -e "${RED}Lỗi: Web build không tạo được BUILD_ID tại apps/web/.next.${NC}"
  exit 1
}

echo "Chuẩn bị slot $SLOT cho bản build mới..."
rm -rf "apps/web/$SLOT"
cp -R apps/web/.next "apps/web/$SLOT"
echo -e "${GREEN}✓ Build hoàn tất trên Mac Mini!${NC}"

# 3. Đồng bộ mã nguồn & Build Artifacts lên VPS
echo -e "\n${YELLOW}[3/6] Đồng bộ mã nguồn và Build Artifacts lên VPS...${NC}"
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=6 "$VPS_HOST" "mkdir -p $VPS_DIR"

# Rsync mã nguồn (loại trừ artifacts thừa, node_modules, git, env)
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
  --exclude '*.local.md' \
  --exclude 'tools/fb-group-digest' \
  ./ "$VPS_HOST:$VPS_DIR/"

# Đồng bộ trực tiếp các Artifacts đã build trên Mac sang VPS
echo "Đang đẩy Artifacts (API dist, Admin dist, Docs dist, Web $SLOT) lên VPS..."
rsync -avz --delete apps/api/dist/ "$VPS_HOST:$VPS_DIR/apps/api/dist/"
rsync -avz --delete apps/admin/dist/ "$VPS_HOST:$VPS_DIR/apps/admin/dist/"
rsync -avz --delete apps/docs/dist/ "$VPS_HOST:$VPS_DIR/apps/docs/dist/"
rsync -avz --delete --exclude 'cache' "apps/web/$SLOT/" "$VPS_HOST:$VPS_DIR/apps/web/$SLOT/"

# 4. Cấu hình môi trường, CSDL & Dependencies trên VPS
echo -e "\n${YELLOW}[4/6] Cấu hình môi trường và khởi động PostgreSQL Docker trên VPS...${NC}"
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=6 "$VPS_HOST" "bash -s" << 'REMOTE_SETUP'
set -e
cd /var/www/pu-connector

# Setup .env if not exists
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
ADMIN_URL=https://admin-puc.vnhat.dev
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
docker compose up -d postgres redis

# Wait for Postgres
for i in {1..20}; do
  if docker exec pu_postgres pg_isready -U pu_user -d pu_connector_db > /dev/null 2>&1; then
    break
  fi
  sleep 1
done

# Run idempotent migrations
echo "Đang kiểm tra và áp dụng cập nhật CSDL (Schema & Upgrades)..."
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/schema.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/domain1-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/add-communities.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-v2-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-study-group-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-push-clear-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/user-blocks-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/presence-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/post-summary-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/personalization-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/post-title-cleanup.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/preferences-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/comments-edit-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/chat-mention-ai-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-connectors-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-skills-share-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/puai-settings-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-skills-seed.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/admin-users-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/admin-lists-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/admin-sanctions-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/admin-security-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/profile-views-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/comment-reactions-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/study-tools-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-thread-share-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-folders-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-sources-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-study-connector-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-agent-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-model-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/rag-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/anonymous-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/quiz-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/bot-simulator-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/bot-governance-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/bot-actions-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/bot-soul-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/bot-jobs-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/comment-reports-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/academic-units-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-models-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-providers-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-llm-upgrade.sql
docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/ai-services-upgrade.sql

# Bot Simulator
grep -q '^BOT_PASSWORD=' .env || echo "BOT_PASSWORD=$(openssl rand -hex 12)" >> .env
grep -q '^BOT_INGEST_TOKEN=' .env || echo "BOT_INGEST_TOKEN=$(openssl rand -hex 24)" >> .env
BOT_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM users WHERE is_bot;" | tr -d '[:space:]')
if [ "$BOT_COUNT" -eq "0" ]; then
  echo "Chưa có tài khoản bot. Đang tạo..."
  node --env-file=.env tools/bot-simulator/setup-bots.mjs
fi

# Seed initial users if empty
USER_COUNT=$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -t -c "SELECT count(*) FROM users;" 2>/dev/null | tr -d '[:space:]' || echo "0")
if [ "$USER_COUNT" -eq "0" ]; then
  echo "Phát hiện bảng users trống. Đang nạp 100 tài khoản mẫu..."
  docker exec -i pu_postgres psql -U pu_user -d pu_connector_db < apps/api/src/database/seed-users.sql
fi

# Cài đặt / cập nhật dependencies (nếu có thay đổi lockfile)
echo "Đang kiểm tra dependencies trên VPS..."
pnpm install --frozen-lockfile --prefer-offline 2>/dev/null || pnpm install
REMOTE_SETUP

# 5. Đổi Slot Blue/Green & Khởi động lại Systemd Services
echo -e "\n${YELLOW}[5/6] Cập nhật static chunks, chuyển slot và khởi động lại dịch vụ...${NC}"
ssh -o ServerAliveInterval=15 -o ServerAliveCountMax=6 "$VPS_HOST" "bash -s -- \"$LIVE\" \"$SLOT\"" << 'REMOTE_SERVICES'
set -e
LIVE="$1"
SLOT="$2"
cd /var/www/pu-connector

# Giữ chunk JS của bản trước 7 ngày để tránh ChunkLoadError
if [ -d "apps/web/$LIVE/static" ]; then
  cp -Rnp "apps/web/$LIVE/static/." "apps/web/$SLOT/static/" 2>/dev/null || true
  find "apps/web/$SLOT/static" -type f -mtime +7 -delete 2>/dev/null || true
fi

# Chuyển slot
echo "NEXT_DIST_DIR=$SLOT" > .web-slot.env

# Drop-in config cho pu-web đọc slot
mkdir -p /etc/systemd/system/pu-web.service.d
cat > /etc/systemd/system/pu-web.service.d/slot.conf << 'UNIT'
[Service]
EnvironmentFile=-/var/www/pu-connector/.web-slot.env
UNIT

# Bot chạy trong API (Admin → Bot → Job); daemon pu-bot cũ đã bỏ
systemctl disable --now pu-bot 2>/dev/null || true
rm -f /etc/systemd/system/pu-bot.service

systemctl daemon-reload
systemctl enable pu-api pu-web
systemctl restart pu-api
systemctl restart pu-web

# Đợi 5s cho API và Web khởi động hoàn toàn
sleep 5

# Verify services
systemctl is-active --quiet pu-api && echo "pu-api (NestJS): ACTIVE" || { echo "pu-api: FAILED"; exit 1; }
systemctl is-active --quiet pu-web && echo "pu-web (Next.js): ACTIVE" || { echo "pu-web: FAILED"; exit 1; }

# Cấu hình Nginx Admin Console
cp scripts/ops/nginx-admin-puc.conf /etc/nginx/sites-available/admin-puc.vnhat.dev.conf 2>/dev/null || true
ln -sf /etc/nginx/sites-available/admin-puc.vnhat.dev.conf /etc/nginx/sites-enabled/admin-puc.vnhat.dev.conf

# Cấu hình Nginx Documentation Portal (docs-puc.vnhat.dev)
cp scripts/ops/nginx-docs-puc.conf /etc/nginx/sites-available/docs-puc.vnhat.dev.conf 2>/dev/null || true
ln -sf /etc/nginx/sites-available/docs-puc.vnhat.dev.conf /etc/nginx/sites-enabled/docs-puc.vnhat.dev.conf

if [ -f /etc/letsencrypt/live/admin-puc.vnhat.dev/fullchain.pem ]; then
  CERT_DIR="/etc/letsencrypt/live/admin-puc.vnhat.dev"
else
  CERT_DIR="/etc/letsencrypt/live/puc.vnhat.dev"
fi

mkdir -p /etc/nginx/snippets
cp scripts/ops/nginx-cloudflare-realip.conf /etc/nginx/snippets/pu-cloudflare-realip.conf 2>/dev/null || true
if ! grep -q 'pu-cloudflare-realip' /etc/nginx/sites-available/pu-connector.conf; then
  sed -i '0,/server_name puc.vnhat.dev;/s//server_name puc.vnhat.dev;\n    include \/etc\/nginx\/snippets\/pu-cloudflare-realip.conf;/' /etc/nginx/sites-available/pu-connector.conf
fi

cat > /etc/nginx/sites-available/admin-puc.vnhat.dev.conf << EOF
server {
    listen 80;
    listen [::]:80;
    server_name admin-puc.vnhat.dev;
    return 301 https://\$host\$request_uri;
}

server {
    listen 443 ssl;
    listen [::]:443 ssl;
    server_name admin-puc.vnhat.dev;
    include /etc/nginx/snippets/pu-cloudflare-realip.conf;

    ssl_certificate $CERT_DIR/fullchain.pem;
    ssl_certificate_key $CERT_DIR/privkey.pem;
    include /etc/letsencrypt/options-ssl-nginx.conf;
    ssl_dhparam /etc/letsencrypt/ssl-dhparams.pem;

    root /var/www/pu-connector/apps/admin/dist;
    index index.html;

    gzip on;
    gzip_types text/plain text/css application/json application/javascript image/svg+xml;

    add_header X-Robots-Tag "noindex, nofollow" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-Content-Type-Options "nosniff" always;

    location /assets/ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location /api/ {
        proxy_pass http://127.0.0.1:4001/api/;
        proxy_http_version 1.1;
        proxy_set_header Host \$host;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_read_timeout 90s;
    }

    location / {
        add_header Cache-Control "no-cache" always;
        add_header X-Frame-Options "DENY" always;
        add_header X-Content-Type-Options "nosniff" always;
        add_header X-Robots-Tag "noindex, nofollow" always;
        try_files \$uri \$uri/ /index.html;
    }
}
EOF

nginx -t && systemctl reload nginx
REMOTE_SERVICES

# 6. Kiểm tra tình trạng hoạt động (Health Check)
echo -e "\n${YELLOW}[6/6] Kiểm tra tình trạng hoạt động (Health Check)...${NC}"
sleep 2

HTTP_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN")
ADMIN_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://admin-$DOMAIN")
DOCS_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://docs-$DOMAIN")
API_STATUS=$(curl -s -o /dev/null -w "%{http_code}" "https://$DOMAIN/api/auth/me")

echo -e "Web (https://$DOMAIN): HTTP Status ${GREEN}$HTTP_STATUS${NC}"
echo -e "Admin (https://admin-$DOMAIN): HTTP Status ${GREEN}$ADMIN_STATUS${NC}"
echo -e "Docs (https://docs-$DOMAIN): HTTP Status ${GREEN}$DOCS_STATUS${NC}"
echo -e "API (https://$DOMAIN/api/auth/me): HTTP Status ${GREEN}$API_STATUS${NC} (Session Check)"

# Dọn dẹp artifact slot local sau khi push xong
rm -rf "apps/web/$SLOT"

if [ "$HTTP_STATUS" -eq 200 ]; then
  echo -e "\n${GREEN}======================================================${NC}"
  echo -e "${GREEN}  🎉 FAST DEPLOY THÀNH CÔNG: https://$DOMAIN          ${NC}"
  echo -e "${GREEN}  🛡️  ADMIN CONSOLE:        https://admin-$DOMAIN    ${NC}"
  echo -e "${GREEN}======================================================${NC}"
else
  echo -e "\n${YELLOW}Lưu ý: Web trả về mã $HTTP_STATUS, vui lòng kiểm tra logs: ssh $VPS_HOST 'journalctl -u pu-web -n 50'${NC}"
fi
