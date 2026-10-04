#!/usr/bin/env bash
# ==============================================================================
# Cài đặt một lần trên VPS: khóa mã hóa backup, cron backup + healthcheck, logrotate.
# Idempotent: chạy lại không tạo trùng. One-time VPS setup (idempotent).
# ==============================================================================
set -euo pipefail
APP_DIR="${APP_DIR:-/var/www/pu-connector}"
ENV_FILE="$APP_DIR/.env"
OPS="$APP_DIR/scripts/ops"
chmod +x "$OPS"/*.sh

# 1. Khóa mã hóa backup (sinh ngẫu nhiên, KHÔNG in ra màn hình)
if ! grep -q '^BACKUP_PASSPHRASE=' "$ENV_FILE"; then
  cp "$ENV_FILE" "$ENV_FILE.bak.$(date +%Y%m%d%H%M%S)"
  printf '\n# Khóa mã hóa backup DB - MẤT KHÓA = KHÔNG KHÔI PHỤC ĐƯỢC. Lưu bản sao ngoài VPS.\nBACKUP_PASSPHRASE=%s\n' \
    "$(openssl rand -base64 36 | tr -d '\n')" >> "$ENV_FILE"
  echo "Đã tạo BACKUP_PASSPHRASE trong .env (hãy sao lưu khóa này ngoài VPS)"
fi
chmod 600 "$ENV_FILE"

# 2. Cron (thay thế khối cũ nếu có)
CRON_TMP=$(mktemp)
crontab -l 2>/dev/null | sed '/# >>> pu-connector ops/,/# <<< pu-connector ops/d' > "$CRON_TMP" || true
cat >> "$CRON_TMP" <<CRON
# >>> pu-connector ops
17 3 * * * /bin/bash $OPS/backup-db.sh >> /var/log/pu-backup.log 2>&1
*/5 * * * * /bin/bash $OPS/healthcheck.sh >> /var/log/pu-monitor.log 2>&1
# <<< pu-connector ops
CRON
crontab "$CRON_TMP"; rm -f "$CRON_TMP"

# 3. Xoay vòng log
cat > /etc/logrotate.d/pu-connector <<LOGR
/var/log/pu-backup.log /var/log/pu-monitor.log {
  weekly
  rotate 4
  compress
  missingok
  notifempty
}
LOGR
echo "Cron đã cài:"; crontab -l | sed -n '/# >>> pu-connector ops/,/# <<< pu-connector ops/p'
