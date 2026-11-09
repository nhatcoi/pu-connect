#!/usr/bin/env bash
# Deploy đầy đủ: DB → API → Admin → Docs → Nginx → Web → kiểm tra. Một khóa, một lần sync cho cả chuỗi.
# Dùng: bash deploy/all.sh [--skip db,docs]   (hoặc: pnpm run deploy:vps)
source "$(dirname "$0")/lib.sh"
SKIP=","
[ "${1:-}" = "--skip" ] && SKIP=",${2:-},"
begin all
for c in db api admin docs nginx web; do
  case "$SKIP" in *",$c,"*) warn "Bỏ qua: $c"; continue ;; esac
  bash "$DEPLOY_DIR/$c.sh"
done
bash "$DEPLOY_DIR/verify.sh"
