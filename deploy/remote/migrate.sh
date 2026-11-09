#!/usr/bin/env bash
# Chạy trên VPS (hoặc local để thử): áp dụng migration trong deploy/migrations.list theo thứ tự.
# MIGRATIONS_STRICT=1 (mặc định): file nào lỗi SQL thì dừng ngay (psql ON_ERROR_STOP). =0: ghi lỗi rồi chạy tiếp.
set -Eeuo pipefail
cd "$(dirname "$0")/../.."
STRICT="${MIGRATIONS_STRICT:-1}"
DB_DIR=apps/api/src/database
PSQL=(docker exec -i -e PGOPTIONS='-c client_min_messages=warning' pu_postgres psql -U pu_user -d pu_connector_db -q -v ON_ERROR_STOP=1)

# Bước 2 đơn vị: xóa hẳn khoa / ngành / lớp / khóa cũ. Sao lưu cả DB trước khi xóa (chỉ khi còn bảng cũ), giữ 5 bản gần nhất
backup_before_legacy_units_drop() {
  [ -n "$(docker exec pu_postgres psql -U pu_user -d pu_connector_db -tAc "SELECT to_regclass('faculties')")" ] || return 0
  mkdir -p /var/backups/pu-connector
  local backup=/var/backups/pu-connector/pre-legacy-units-drop-$(date +%Y%m%d-%H%M%S).dump
  docker exec pu_postgres pg_dump -U pu_user -Fc pu_connector_db > "$backup" || { echo "Sao lưu thất bại — dừng, chưa xóa gì."; rm -f "$backup"; exit 1; }
  echo "Đã sao lưu DB trước khi xóa bảng cũ: $backup ($(du -h "$backup" | cut -f1))"
  ls -1t /var/backups/pu-connector/pre-legacy-units-drop-*.dump | tail -n +6 | xargs -r rm -f
}

applied=0; failed=0
while IFS= read -r name || [ -n "$name" ]; do
  case "$name" in ''|'#'*) continue ;; esac
  if [ ! -f "$DB_DIR/$name" ]; then echo "✗ Thiếu file migration: $name"; failed=$((failed + 1)); [ "$STRICT" = 1 ] && break; continue; fi
  [ "$name" = legacy-units-drop-upgrade.sql ] && backup_before_legacy_units_drop
  if out=$("${PSQL[@]}" < "$DB_DIR/$name" 2>&1); then
    applied=$((applied + 1))
  else
    echo "✗ $name"; echo "$out" | grep -iE 'error|fatal' | head -3 | sed 's/^/    /'
    failed=$((failed + 1)); [ "$STRICT" = 1 ] && break
  fi
done < deploy/migrations.list

if [ "$failed" -gt 0 ]; then
  echo "Migration: $applied file OK, $failed LỖI."
  [ "$STRICT" = 1 ] && { echo "Dừng deploy (strict). API/Web đang chạy giữ nguyên. Sửa file lỗi rồi chạy lại (migration idempotent)."; exit 1; }
else
  echo "Migration: $applied file OK."
fi
