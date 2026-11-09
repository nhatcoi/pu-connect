#!/usr/bin/env bash
# Chạy trên VPS: build API (+ packages), smoke check nạp module TRƯỚC khi restart, restart pu-api.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
bash deploy/remote/build.sh '@pu/api...'

# Smoke check: nạp toàn bộ module API đã build (bắt lỗi import runtime) TRƯỚC khi restart
(cd apps/api && node -e "require('./dist/apps/api/src/app.module')") || {
  echo "Lỗi: API build không nạp được — dừng deploy, bản đang chạy giữ nguyên."
  exit 1
}

# Bot chạy trong API (Admin → Bot → Job); daemon pu-bot cũ đã bỏ
systemctl disable --now pu-bot 2>/dev/null || true
rm -f /etc/systemd/system/pu-bot.service
systemctl daemon-reload
systemctl enable pu-api >/dev/null 2>&1
systemctl restart pu-api
for i in $(seq 1 20); do
  [ "$(curl -s -o /dev/null -m 3 -w '%{http_code}' http://127.0.0.1:4001/api/auth/me)" = 401 ] && { echo "pu-api: ACTIVE (401 /api/auth/me)"; exit 0; }
  sleep 1
done
echo "pu-api: không phản hồi sau khi restart"; journalctl -u pu-api -n 30 --no-pager | tail -30; exit 1
