#!/usr/bin/env bash
# Xem trạng thái VPS (CHỈ ĐỌC): dịch vụ, slot web, tài nguyên, deploy đang chạy, health.  Dùng: bash deploy/status.sh  (pnpm run deploy:status)
source "$(dirname "$0")/lib.sh"
check_ssh
rssh "cd $VPS_DIR && bash -s" < "$DEPLOY_DIR/remote/status.sh"  # đọc từ máy dev: chạy được cả khi VPS chưa có thư mục deploy/
echo "── Health"
bash "$DEPLOY_DIR/verify.sh" || true
