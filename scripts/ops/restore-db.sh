#!/usr/bin/env bash
# ==============================================================================
# Khôi phục backup. Mặc định chỉ KIỂM TRA vào DB tạm rồi xóa (an toàn).
#   restore-db.sh [file.enc|r2-key]            -> kiểm tra khôi phục vào DB tạm
#   restore-db.sh <file> --into-live           -> GHI ĐÈ DB thật (cần gõ xác nhận)
# Restore a backup. Default: verify into a scratch DB, then drop it.
# ==============================================================================
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib.sh"
load_env R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET_NAME BACKUP_PASSPHRASE \
  TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID

LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pu-connector}"
CONTAINER="${PG_CONTAINER:-pu_postgres}"
SRC="${1:-}"; MODE="${2:-verify}"
[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "Thiếu BACKUP_PASSPHRASE"; exit 1; }

WORK=$(mktemp -d); trap 'rm -rf "$WORK"' EXIT
if [ -z "$SRC" ]; then SRC=$(ls -1t "$LOCAL_DIR"/pu-*.sql.gz.enc | head -1); fi
if [ ! -f "$SRC" ]; then
  node "$HERE/r2.mjs" get "$SRC" "$WORK/dl.enc"; SRC="$WORK/dl.enc"
fi
echo "Nguồn: $SRC"

PG_USER=$(docker exec "$CONTAINER" printenv POSTGRES_USER)
PG_DB=$(docker exec "$CONTAINER" printenv POSTGRES_DB)
decrypt() { BACKUP_PASSPHRASE="$BACKUP_PASSPHRASE" openssl enc -d -aes-256-cbc -pbkdf2 -iter 200000 -pass env:BACKUP_PASSPHRASE -in "$SRC" | gunzip; }

if [ "$MODE" = "--into-live" ]; then
  read -r -p "Ghi đè DB '$PG_DB' bằng backup này? Gõ đúng tên DB để xác nhận: " ans
  [ "$ans" = "$PG_DB" ] || { echo "Hủy."; exit 1; }
  echo "Dừng API trước khi khôi phục…"; systemctl stop pu-api
  docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 \
    -c "DROP DATABASE \"$PG_DB\" WITH (FORCE)" -c "CREATE DATABASE \"$PG_DB\" OWNER \"$PG_USER\""
  decrypt | docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -v ON_ERROR_STOP=1 -q
  systemctl start pu-api; echo "Đã khôi phục và khởi động lại API."; exit 0
fi

SCRATCH="pu_restore_check_$$"
docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -v ON_ERROR_STOP=1 -q -c "CREATE DATABASE $SCRATCH"
cleanup() { docker exec "$CONTAINER" psql -U "$PG_USER" -d postgres -q -c "DROP DATABASE IF EXISTS $SCRATCH WITH (FORCE)" >/dev/null 2>&1 || true; }
trap 'cleanup; rm -rf "$WORK"' EXIT
decrypt | docker exec -i "$CONTAINER" psql -U "$PG_USER" -d "$SCRATCH" -v ON_ERROR_STOP=1 -q >/dev/null
TABLES=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d "$SCRATCH" -tAc "SELECT count(*) FROM information_schema.tables WHERE table_schema='public'")
USERS=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d "$SCRATCH" -tAc "SELECT count(*) FROM users")
LIVE_USERS=$(docker exec "$CONTAINER" psql -U "$PG_USER" -d "$PG_DB" -tAc "SELECT count(*) FROM users")
echo "Khôi phục thử OK: $TABLES bảng, $USERS users (DB thật: $LIVE_USERS users)"
[ "$TABLES" -gt 10 ] && [ "$USERS" -gt 0 ] || { alert "Khôi phục thử backup thất bại (bảng=$TABLES users=$USERS)"; exit 1; }
