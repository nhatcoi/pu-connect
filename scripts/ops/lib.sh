#!/usr/bin/env bash
# Dùng chung cho script vận hành / Shared helpers for ops scripts
APP_DIR="${APP_DIR:-/var/www/pu-connector}"
ENV_FILE="$APP_DIR/.env"

# Chỉ đọc các khóa cần thiết từ .env (không export toàn bộ secret)
# Read only the needed keys from .env
load_env() {
  local key val
  for key in "$@"; do
    val=$(grep -E "^${key}=" "$ENV_FILE" 2>/dev/null | tail -1 | cut -d= -f2- | sed -e 's/^"//' -e 's/"$//' || true)
    [ -n "$val" ] && export "$key=$val"
  done
  return 0
}

# Gửi cảnh báo Telegram (tùy chọn); luôn ghi log / Telegram alert (optional), always logs
alert() {
  local msg="$1"
  echo "[$(date '+%F %T')] ALERT: $msg"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -m 15 -o /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=🚨 PU Connector: ${msg}" || true
  fi
}

notify_ok() {
  local msg="$1"
  echo "[$(date '+%F %T')] OK: $msg"
  if [ -n "${TELEGRAM_BOT_TOKEN:-}" ] && [ -n "${TELEGRAM_CHAT_ID:-}" ]; then
    curl -s -m 15 -o /dev/null "https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage" \
      --data-urlencode "chat_id=${TELEGRAM_CHAT_ID}" \
      --data-urlencode "text=✅ PU Connector: ${msg}" || true
  fi
}
