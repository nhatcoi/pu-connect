#!/usr/bin/env bash
# ==============================================================================
# Sao lưu Postgres hằng ngày: pg_dump -> gzip -> mã hóa AES-256 -> R2 + giữ bản local
# Daily Postgres backup: dump, compress, encrypt (bucket is public), upload to R2
# ==============================================================================
set -euo pipefail
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib.sh"
load_env R2_ACCOUNT_ID R2_ACCESS_KEY_ID R2_SECRET_ACCESS_KEY R2_ENDPOINT R2_BUCKET_NAME \
  BACKUP_PASSPHRASE TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID

LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pu-connector}"
LOCAL_KEEP="${BACKUP_LOCAL_KEEP:-7}"        # số bản giữ trên VPS / local copies kept
REMOTE_KEEP_DAYS="${BACKUP_REMOTE_DAYS:-30}" # số ngày giữ trên R2 / days kept on R2
PREFIX="backups/db/"
CONTAINER="${PG_CONTAINER:-pu_postgres}"

trap 'alert "Backup DB THẤT BẠI (dòng $LINENO) trên $(hostname). Xem /var/log/pu-backup.log"' ERR

[ -n "${BACKUP_PASSPHRASE:-}" ] || { echo "Thiếu BACKUP_PASSPHRASE trong .env"; false; }
mkdir -p "$LOCAL_DIR"; chmod 700 "$LOCAL_DIR"

STAMP=$(date +%Y%m%d-%H%M%S)
OUT="$LOCAL_DIR/pu-$STAMP.sql.gz.enc"
TMP="$OUT.part"

PG_USER=$(docker exec "$CONTAINER" printenv POSTGRES_USER)
PG_DB=$(docker exec "$CONTAINER" printenv POSTGRES_DB)

# Dump nhất quán (một snapshot), nén, mã hóa; mật khẩu qua biến môi trường, không lộ trong ps
docker exec "$CONTAINER" pg_dump -U "$PG_USER" -d "$PG_DB" --no-owner --no-privileges \
  | gzip -9 \
  | BACKUP_PASSPHRASE="$BACKUP_PASSPHRASE" openssl enc -aes-256-cbc -pbkdf2 -iter 200000 -salt -pass env:BACKUP_PASSPHRASE \
  > "$TMP"
mv "$TMP" "$OUT"
chmod 600 "$OUT"

SIZE=$(stat -c%s "$OUT")
# Dump rỗng/quá nhỏ = lỗi (gzip rỗng ~20B + header mã hóa 16B)
[ "$SIZE" -gt 2048 ] || { echo "Backup quá nhỏ ($SIZE bytes)"; false; }

node "$HERE/r2.mjs" put "$OUT" "${PREFIX}$(basename "$OUT")"

# Xoay vòng: local giữ N bản mới nhất; R2 xóa bản cũ hơn M ngày
ls -1t "$LOCAL_DIR"/pu-*.sql.gz.enc 2>/dev/null | tail -n +$((LOCAL_KEEP + 1)) | xargs -r rm -f
CUTOFF=$(date -u -d "-${REMOTE_KEEP_DAYS} days" +%Y-%m-%dT%H:%M:%S)
node "$HERE/r2.mjs" list "$PREFIX" | while IFS=$'\t' read -r ts _ key; do
  [ -n "$key" ] && [[ "$ts" < "$CUTOFF" ]] && node "$HERE/r2.mjs" delete "$key"
done || true

echo "[$(date '+%F %T')] backup OK: $(basename "$OUT") ($SIZE bytes)"
