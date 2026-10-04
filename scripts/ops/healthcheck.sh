#!/usr/bin/env bash
# ==============================================================================
# Giám sát tối thiểu (cron mỗi 5 phút). Chỉ cảnh báo khi TRẠNG THÁI ĐỔI (không spam).
# Minimal monitoring: alerts only on state change (problem found / recovered).
# ==============================================================================
export PATH="/usr/local/bin:/usr/bin:/bin:$PATH"
HERE="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$HERE/lib.sh"
load_env TELEGRAM_BOT_TOKEN TELEGRAM_CHAT_ID BACKUP_LOCAL_DIR

SITE="${SITE_URL:-https://puc.vnhat.dev}"
STATE_DIR="/var/lib/pu-monitor"; mkdir -p "$STATE_DIR"
PROBLEMS=()

# 1. Site + API (qua nginx, từ chính VPS)
code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$SITE/") || code=000
[ "$code" = "200" ] || PROBLEMS+=("Web $SITE trả $code")
code=$(curl -s -m 15 -o /dev/null -w '%{http_code}' "$SITE/api/auth/me") || code=000
[ "$code" = "401" ] || PROBLEMS+=("API /api/auth/me trả $code (mong đợi 401)")

# 2. Dịch vụ systemd + container
for svc in pu-api pu-web nginx; do
  systemctl is-active --quiet "$svc" || PROBLEMS+=("Dịch vụ $svc không chạy")
done
for c in pu_postgres pu_redis; do
  [ "$(docker inspect -f '{{.State.Running}}' "$c" 2>/dev/null)" = "true" ] || PROBLEMS+=("Container $c không chạy")
done

# 3. Postgres nhận kết nối
docker exec pu_postgres pg_isready -q 2>/dev/null || PROBLEMS+=("Postgres không sẵn sàng")

# 4. Tài nguyên: đĩa > 85%, RAM khả dụng < 150MB
disk=$(df --output=pcent / | tail -1 | tr -dc '0-9')
[ "${disk:-0}" -lt 85 ] || PROBLEMS+=("Đĩa đầy ${disk}%")
mem=$(awk '/MemAvailable/ {print int($2/1024)}' /proc/meminfo)
[ "${mem:-999}" -gt 150 ] || PROBLEMS+=("RAM khả dụng chỉ ${mem}MB")

# 5. Backup mới nhất không quá 26 giờ
LOCAL_DIR="${BACKUP_LOCAL_DIR:-/var/backups/pu-connector}"
latest=$(ls -1t "$LOCAL_DIR"/pu-*.sql.gz.enc 2>/dev/null | head -1)
if [ -z "$latest" ]; then PROBLEMS+=("Chưa có backup DB nào")
elif [ $(( $(date +%s) - $(stat -c %Y "$latest") )) -gt 93600 ]; then PROBLEMS+=("Backup DB cũ hơn 26 giờ"); fi

# So sánh với trạng thái lần trước; chỉ báo khi đổi
CURRENT=$(printf '%s\n' "${PROBLEMS[@]}" | sort)
PREV=$(cat "$STATE_DIR/last" 2>/dev/null || true)
if [ "$CURRENT" != "$PREV" ]; then
  echo "$CURRENT" > "$STATE_DIR/last"
  if [ ${#PROBLEMS[@]} -gt 0 ]; then
    alert "$(printf '• %s\n' "${PROBLEMS[@]}")"
  else
    notify_ok "Hệ thống đã hoạt động bình thường trở lại"
  fi
fi
exit 0
