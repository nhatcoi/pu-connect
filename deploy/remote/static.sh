#!/usr/bin/env bash
# Chạy trên VPS: build Admin SPA hoặc Docs SPA (nginx phục vụ trực tiếp apps/<app>/dist, không cần restart).
# Dùng: static.sh admin | docs
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
case "${1:-}" in
  admin) PKG=@pu/admin; DIR=apps/admin ;;
  docs)  PKG=@pu/docs;  DIR=apps/docs ;;
  *) echo "Dùng: static.sh admin|docs"; exit 2 ;;
esac
bash deploy/remote/build.sh "$PKG..."
[ -f "$DIR/dist/index.html" ] || { echo "Lỗi: $DIR/dist/index.html không có sau khi build."; exit 1; }
echo "$1: build xong ($(find "$DIR/dist" -type f | wc -l | tr -d ' ') file)."
