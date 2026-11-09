#!/usr/bin/env bash
# Cấu hình lại Nginx (Admin, Docs, IP thật Cloudflare), nginx -t rồi reload.  Dùng: bash deploy/nginx.sh  (pnpm run deploy:nginx)
source "$(dirname "$0")/lib.sh"
begin nginx
step "nginx" "Cấu hình và reload Nginx..."
remote nginx.sh
ok "Nginx xong"
