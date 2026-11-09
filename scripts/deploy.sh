#!/usr/bin/env bash
# Giữ để tương thích lệnh cũ (pnpm run deploy:vps). Mọi logic deploy nằm ở thư mục deploy/ — xem deploy/README.md.
# Thêm migration: sửa deploy/migrations.list (KHÔNG thêm lệnh vào file này).
exec bash "$(cd "$(dirname "$0")/.." && pwd)/deploy/all.sh" "$@"
