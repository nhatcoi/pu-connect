#!/usr/bin/env bash
# Deploy Web (Next.js, blue/green): build vào slot rảnh, chuyển slot, restart pu-web; lỗi thì tự về slot cũ.
# Bước chậm nhất (3-8 phút trên VPS 2GB). Dùng: bash deploy/web.sh  (pnpm run deploy:web)
source "$(dirname "$0")/lib.sh"
begin web
step "web" "Build Web vào slot rảnh và chuyển slot..."
remote web.sh
ok "Web xong"
