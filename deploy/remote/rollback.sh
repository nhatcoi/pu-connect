#!/usr/bin/env bash
# Chạy trên VPS: đưa Web về slot ghi trong .web-slot.env.prev (chỉ Web; không đụng API, DB, Admin, Nginx).
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
[ -f .web-slot.env.prev ] || { echo "Không có .web-slot.env.prev — chưa từng chuyển slot bằng deploy mới, không rollback tự động được."; exit 1; }
PREV=$(sed -n 's/^NEXT_DIST_DIR=//p' .web-slot.env.prev)
CUR=$(sed -n 's/^NEXT_DIST_DIR=//p' .web-slot.env)
[ -n "$PREV" ] && [ "$PREV" != "$CUR" ] || { echo "Slot trước ($PREV) trùng slot hiện tại ($CUR)."; exit 1; }
[ -f "apps/web/$PREV/BUILD_ID" ] || { echo "Slot $PREV không còn bản build hợp lệ (thiếu BUILD_ID) — không rollback."; exit 1; }
echo "NEXT_DIST_DIR=$CUR" > .web-slot.env.prev   # rollback lần nữa = quay lại bản vừa gỡ
echo "NEXT_DIST_DIR=$PREV" > .web-slot.env
systemctl restart pu-web
sleep 3
systemctl is-active --quiet pu-web && echo "Rollback Web: $CUR → $PREV (pu-web ACTIVE)" || { echo "pu-web không chạy sau rollback"; exit 1; }
