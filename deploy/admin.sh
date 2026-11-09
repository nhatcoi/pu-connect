#!/usr/bin/env bash
# Deploy Admin (SPA tĩnh): build apps/admin/dist, nginx phục vụ ngay, không restart gì.  Dùng: bash deploy/admin.sh  (pnpm run deploy:admin)
source "$(dirname "$0")/lib.sh"
begin admin
step "admin" "Build Admin..."
remote static.sh admin
ok "Admin xong"
