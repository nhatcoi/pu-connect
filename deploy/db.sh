#!/usr/bin/env bash
# Deploy DB: Postgres/Redis + migration (deploy/migrations.list) + bot/dữ liệu mẫu lần đầu. Không build, không restart.
# MIGRATIONS_STRICT=0 để migration lỗi không dừng deploy (mặc định dừng).  Dùng: bash deploy/db.sh  (pnpm run deploy:db)
source "$(dirname "$0")/lib.sh"
begin db
step "db" "Áp dụng migration..."
REMOTE_ENV="MIGRATIONS_STRICT=${MIGRATIONS_STRICT:-1}" remote db.sh
ok "DB xong"
