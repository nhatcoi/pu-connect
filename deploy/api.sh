#!/usr/bin/env bash
# Deploy API (NestJS): build + smoke check nạp module + restart pu-api. Không đụng DB/Web/Admin.
# Cần migration mới thì chạy db.sh TRƯỚC.  Dùng: bash deploy/api.sh  (pnpm run deploy:api)
source "$(dirname "$0")/lib.sh"
begin api
step "api" "Build và restart pu-api..."
remote api.sh
ok "API xong"
