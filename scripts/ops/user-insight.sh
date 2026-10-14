#!/usr/bin/env bash
# Xem dữ liệu cá nhân hóa của 1 user (chỉ đọc) / Read-only personalisation snapshot
# Dùng / Usage: pnpm user:insight <username>          → DB stage (qua SSH)
#               pnpm user:insight <username> --local  → DB local ($DATABASE_URL)
set -euo pipefail

USERNAME="${1:-}"
if [[ -z "$USERNAME" || ! "$USERNAME" =~ ^[A-Za-z0-9._-]+$ ]]; then
  echo "Usage: pnpm user:insight <username> [--local]" >&2
  exit 1
fi

SQL="$(dirname "$0")/sql/user-insight.sql"
VPS_HOST="${VPS_HOST:-root@103.195.237.112}"

if [[ "${2:-}" == "--local" ]]; then
  psql "${DATABASE_URL:-postgresql://pu_user:pu_password@localhost:5432/pu_connector_db}" \
    -X -q -v username="$USERNAME" -f "$SQL"
else
  ssh -o BatchMode=yes "$VPS_HOST" \
    "docker exec -i pu_postgres psql -U pu_user -d pu_connector_db -X -q -v username=$USERNAME" < "$SQL"
fi
